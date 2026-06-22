import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteOption } from '../lib/routing';
import type { WalkStep } from '../lib/osrm';
import { getWalkSteps } from '../lib/osrm';
import { distanceTo, nearestPointOnPath, type LatLng } from '../lib/geo';
import { speak, stopSpeaking } from '../lib/tts';

// ---------------------------------------------------------------------------
// Walking-only, turn-by-turn navigation.
// Guides the user along the foot segments of a transit route. While on transit
// the guidance pauses and waits for the user to tap "Siguiente tramo" (or for
// the GPS to report board/alight).
// ---------------------------------------------------------------------------

export type NavState =
  | 'idle'         // not started
  | 'locating'     // acquiring first fix
  | 'navigating'   // actively guiding a foot segment
  | 'at_station'   // arrived at a boarding point; guidance paused
  | 'arrived';     // reached final destination

export interface NavCue {
  /** Spanish instruction for the upcoming maneuver. */
  instruction: string;
  /** Distance (m) to the start of this maneuver. */
  distanceToManeuver: number;
  /** Next maneuver after this one, for the secondary banner line. */
  nextInstruction?: string;
  /** Total ETA in seconds (remaining walking time on the active leg). */
  eta: number;
  /** Remaining walking distance on the active leg, in meters. */
  remainingDistance: number;
}

export interface NavigationContext {
  state: NavState;
  pos: LatLng | null;
  /** Heading in degrees [0,360). Null until known. */
  heading: number | null;
  cue: NavCue | null;
  /** True when recalculating after the user strayed off-route. */
  recalculating: boolean;
  /** Current station/transport context shown while paused (at_station). */
  boardingLabel: string | null;
  /** Total number of legs and the one we're on (1-indexed). */
  legIndex: number;
  legCount: number;
  muted: boolean;
  start: (route: RouteOption) => Promise<void>;
  stop: () => void;
  nextLeg: () => void;
  toggleMute: () => void;
}

interface Leg {
  /** Origin waypoint [lat,lng]. */
  from: LatLng;
  /** Destination waypoint [lat,lng]. */
  to: LatLng;
  /** OSRM turn-by-turn steps for this walking leg. */
  steps: WalkStep[];
  /** Flattened path of all step coordinates, for off-route detection. */
  path: LatLng[];
  /** After arriving at `to`, the transport label to announce (e.g. "Metro A"). */
  boardingLabel?: string;
}

const OFF_ROUTE_THRESHOLD_M = 40;
const ARRIVE_RADIUS_M = 25;
const RECALC_MIN_INTERVAL_MS = 10000;
const SPEED_ON_VEHICLE_MS = 7; // ~25 km/h — heuristics to auto-advance

export function useNavigation(): NavigationContext {
  const [state, setState] = useState<NavState>('idle');
  const [pos, setPos] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [cue, setCue] = useState<NavCue | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [boardingLabel, setBoardingLabel] = useState<string | null>(null);
  const [legIndex, setLegIndex] = useState(1);
  const [legCount, setLegCount] = useState(1);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('metrobot_nav_muted') === '1'; } catch { return false; }
  });

  const legsRef = useRef<Leg[]>([]);
  const currentLegRef = useRef(0);
  const activeStepRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const lastFixRef = useRef<{ pos: LatLng; t: number } | null>(null);
  const lastRecalcRef = useRef(0);
  const lastSpokenStepRef = useRef(-1);
  const lastSpokenEarlyRef = useRef<Set<number>>(new Set());
  const mutedRef = useRef(muted);
  // Keep a ref to stop() so callbacks defined earlier in the component can call it.
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ----- Speech helpers ----------------------------------------------------
  const say = useCallback((text: string) => {
    speak(text, { muted: mutedRef.current });
  }, []);

  // ----- Build legs from a RouteOption ------------------------------------
  const buildLegs = useCallback(async (route: RouteOption): Promise<Leg[]> => {
    const out: Leg[] = [];
    const userOrigin = route.userOrigin;
    const userDest = route.userDest;

    // Collect all waypoint stations in route order.
    type WP = LatLng & { name?: string; mode?: string };
    const stations: WP[] = [];
    if (route.originStation) stations.push({ ...route.originStation, name: route.originStation.name, mode: route.steps[0]?.mode });
    for (const s of route.steps) {
      if (s.station && typeof s.station.lat === 'number' && typeof s.station.lng === 'number') {
        stations.push({ lat: s.station.lat, lng: s.station.lng, name: s.station.name || s.station.nameRef, mode: s.mode });
      }
    }
    if (route.destinationStation) stations.push({ ...route.destinationStation, name: route.destinationStation.name });

    // Leg 1: user origin -> first station (always walking).
    if (userOrigin && stations.length > 0) {
      const to = stations[0];
      const steps = await getWalkSteps([[userOrigin.lat, userOrigin.lng], [to.lat, to.lng]], 'foot');
      out.push({
        from: { lat: userOrigin.lat, lng: userOrigin.lng },
        to,
        steps,
        path: steps.flatMap(s => s.coordinates).map(([lat, lng]) => ({ lat, lng })),
        boardingLabel: transportLabel(to.mode, route),
      });
    }

    // Intermediate legs: walk between consecutive stations only when both are
    // non-transit (walk/encicla). Transit gaps (metro->metro) are NOT walked;
    // they're announced as boarding.
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i];
      const b = stations[i + 1];
      const isWalk = a.mode === 'walk' || a.mode === 'encicla' || b.mode === 'walk';
      if (isWalk) {
        const steps = await getWalkSteps([[a.lat, a.lng], [b.lat, b.lng]], 'foot');
        out.push({
          from: a,
          to: b,
          steps,
          path: steps.flatMap(s => s.coordinates).map(([lat, lng]) => ({ lat, lng })),
          boardingLabel: transportLabel(b.mode, route),
        });
      }
    }

    // Final leg: last station -> user destination (walking).
    if (userDest && stations.length > 0) {
      const from = stations[stations.length - 1];
      const steps = await getWalkSteps([[from.lat, from.lng], [userDest.lat, userDest.lng]], 'foot');
      out.push({
        from,
        to: { lat: userDest.lat, lng: userDest.lng },
        steps,
        path: steps.flatMap(s => s.coordinates).map(([lat, lng]) => ({ lat, lng })),
        boardingLabel: undefined, // arrival, no boarding
      });
    } else if (userDest && stations.length === 0) {
      // No stations at all — pure walk.
      const steps = await getWalkSteps([[userOrigin!.lat, userOrigin!.lng], [userDest.lat, userDest.lng]], 'foot');
      out.push({
        from: { lat: userOrigin!.lat, lng: userOrigin!.lng },
        to: { lat: userDest.lat, lng: userDest.lng },
        steps,
        path: steps.flatMap(s => s.coordinates).map(([lat, lng]) => ({ lat, lng })),
      });
    }

    return out.filter(l => l.path.length >= 2);
  }, []);

  // ----- Compute cue for a given position on the current leg --------------
  const computeCue = useCallback((position: LatLng): { cue: NavCue | null; arrived: boolean; offRoute: boolean } => {
    const leg = legsRef.current[currentLegRef.current];
    if (!leg) return { cue: null, arrived: false, offRoute: false };

    const nearest = nearestPointOnPath(position, leg.path);
    if (!nearest) return { cue: null, arrived: false, offRoute: false };
    const offRoute = nearest.distance > OFF_ROUTE_THRESHOLD_M;

    // Find which step we're currently inside by matching projected point to step coords.
    let stepIdx = activeStepRef.current;
    let bestStep = stepIdx;
    let bestStepDist = Infinity;
    for (let i = stepIdx; i < leg.steps.length; i++) {
      const step = leg.steps[i];
      if (!step.coordinates.length) continue;
      const np = nearestPointOnPath(position, step.coordinates.map(([lat, lng]) => ({ lat, lng })));
      if (np && np.distance < bestStepDist) { bestStepDist = np.distance; bestStep = i; }
    }
    stepIdx = bestStep;
    activeStepRef.current = stepIdx;

    const currentStep = leg.steps[stepIdx];
    const nextStep = leg.steps[stepIdx + 1];

    // Distance to the maneuver of the CURRENT step (its own start) — but we
    // want distance to the NEXT maneuver's point. Use end of current step.
    const stepEnd = currentStep?.coordinates?.[currentStep.coordinates.length - 1];
    const distanceToManeuver = stepEnd ? distanceTo(position, { lat: stepEnd[0], lng: stepEnd[1] }) : 0;

    // Remaining distance: from projection to end of path.
    let remaining = 0;
    if (nearest.index + 1 < leg.path.length) {
      remaining += distanceTo(position, leg.path[nearest.index + 1]);
      for (let i = nearest.index + 1; i < leg.path.length - 1; i++) remaining += distanceTo(leg.path[i], leg.path[i + 1]);
    }
    const eta = remaining / 1.4; // ~5 km/h walking pace

    const arrived = distanceTo(position, leg.to) <= ARRIVE_RADIUS_M;

    return {
      cue: {
        instruction: nextStep?.instruction || currentStep?.instruction || 'Continúa',
        distanceToManeuver,
        nextInstruction: nextStep ? (leg.steps[stepIdx + 2]?.instruction) : undefined,
        eta,
        remainingDistance: remaining,
      },
      arrived,
      offRoute,
    };
  }, []);

  // ----- Recalculate the current leg from current position ---------------
  const recalc = useCallback(async () => {
    const now = Date.now();
    if (now - lastRecalcRef.current < RECALC_MIN_INTERVAL_MS) return;
    lastRecalcRef.current = now;
    const leg = legsRef.current[currentLegRef.current];
    if (!leg || !pos) return;
    setRecalculating(true);
    try {
      const steps = await getWalkSteps([[pos.lat, pos.lng], [leg.to.lat, leg.to.lng]], 'foot');
      const path = steps.flatMap(s => s.coordinates).map(([lat, lng]) => ({ lat, lng }));
      if (path.length >= 2) {
        legsRef.current[currentLegRef.current] = { ...leg, steps, path };
        activeStepRef.current = 0;
        lastSpokenStepRef.current = -1;
        lastSpokenEarlyRef.current = new Set();
        say('Recalculando ruta');
      }
    } finally {
      setRecalculating(false);
    }
  }, [pos, say]);

  // ----- Handle a position update -----------------------------------------
  const onPosition = useCallback((p: LatLng) => {
    setPos(p);
    if (state !== 'navigating') return;

    const prev = lastFixRef.current;
    const now = Date.now();
    lastFixRef.current = { pos: p, t: now };

    // Auto-advance past at_station if user is clearly moving on a vehicle.
    // (handled via nextLeg, not here; left as a hook for future use.)
    if (prev) {
      const dt = (now - prev.t) / 1000;
      const d = distanceTo(prev.pos, p);
      if (d > SPEED_ON_VEHICLE_MS * dt) {
        // Fast movement — likely on transit. We rely on nextLeg() being tapped.
      }
    }

    const { cue: newCue, arrived, offRoute } = computeCue(p);
    setCue(newCue);

    // Speech: announce the upcoming maneuver at ~80m (early) and at ~20m (final).
    const leg = legsRef.current[currentLegRef.current];
    if (leg && newCue) {
      const nextStepIdx = activeStepRef.current + 1;
      const nextStep = leg.steps[nextStepIdx];
      if (nextStep) {
        const finalSpoken = lastSpokenStepRef.current === nextStepIdx;
        const earlySpoken = lastSpokenEarlyRef.current.has(nextStepIdx);
        if (newCue.distanceToManeuver <= 20 && !finalSpoken) {
          lastSpokenStepRef.current = nextStepIdx;
          say(nextStep.instruction);
        } else if (newCue.distanceToManeuver <= 80 && !earlySpoken && !finalSpoken) {
          lastSpokenEarlyRef.current.add(nextStepIdx);
          say(`En ${Math.round(newCue.distanceToManeuver)} metros, ${nextStep.instruction}`);
        }
      }
    }

    if (offRoute) {
      void recalc();
    }

    if (arrived) {
      const arrivedLeg = legsRef.current[currentLegRef.current];
      if (arrivedLeg?.boardingLabel) {
        setBoardingLabel(arrivedLeg.boardingLabel);
        setState('at_station');
        say(`Llegaste. Sube al ${arrivedLeg.boardingLabel}.`);
      } else if (currentLegRef.current < legsRef.current.length - 1) {
        currentLegRef.current += 1;
        setLegIndex(currentLegRef.current + 1);
        activeStepRef.current = 0;
        lastSpokenStepRef.current = -1;
        lastSpokenEarlyRef.current = new Set();
        say('Continúa con el siguiente tramo.');
      } else {
        setState('arrived');
        say('Has llegado a tu destino.');
        stopRef.current();
      }
    }
  }, [state, computeCue, recalc, say]);

  // ----- watchPosition lifecycle ------------------------------------------
  useEffect(() => {
    if (state === 'idle' || state === 'arrived') {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch?.(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        onPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
        if (typeof position.coords.heading === 'number' && !Number.isNaN(position.coords.heading)) {
          setHeading(position.coords.heading);
        }
      },
      (err) => {
        console.warn('navigation watchPosition error', err);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [state, onPosition]);

  // ----- deviceorientation for compass heading ----------------------------
  useEffect(() => {
    if (state !== 'navigating' && state !== 'locating') return;
    const handler = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const h = (typeof e.webkitCompassHeading === 'number') ? e.webkitCompassHeading : (typeof e.alpha === 'number' ? 360 - e.alpha : null);
      if (h !== null && !Number.isNaN(h)) setHeading(h);
    };
    window.addEventListener('deviceorientation', handler as EventListener);
    return () => window.removeEventListener('deviceorientation', handler as EventListener);
  }, [state]);

  // ----- Public API --------------------------------------------------------
  const start = useCallback(async (route: RouteOption) => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización, necesaria para la navegación.');
      return;
    }
    setState('locating');
    say('Iniciando navegación.');
    // Acquire a first fix to confirm permission before building legs.
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const first = { lat: p.coords.latitude, lng: p.coords.longitude };
          setPos(first);
          lastFixRef.current = { pos: first, t: Date.now() };
          resolve();
        },
        () => {
          alert('No se pudo obtener tu ubicación. Revisa los permisos de ubicación del navegador.');
          setState('idle');
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    const legs = await buildLegs(route);
    if (legs.length === 0) {
      alert('Esta ruta no tiene tramos a pie para guiar. Toca "Ver en mapa" en su lugar.');
      setState('idle');
      return;
    }
    legsRef.current = legs;
    currentLegRef.current = 0;
    activeStepRef.current = 0;
    lastSpokenStepRef.current = -1;
    lastSpokenEarlyRef.current = new Set();
    setLegIndex(1);
    setLegCount(legs.length);
    setBoardingLabel(null);
    setState('navigating');
    say(legs[0].steps[0]?.instruction || 'Comienza a caminar.');
  }, [buildLegs, say]);

  const stop = useCallback(() => {
    setState('idle');
    setCue(null);
    setBoardingLabel(null);
    setHeading(null);
    stopSpeaking();
    legsRef.current = [];
    currentLegRef.current = 0;
    activeStepRef.current = 0;
  }, []);
  // Expose stop via ref so earlier callbacks can reference it safely.
  stopRef.current = stop;

  const nextLeg = useCallback(() => {
    if (currentLegRef.current < legsRef.current.length - 1) {
      currentLegRef.current += 1;
      setLegIndex(currentLegRef.current + 1);
      activeStepRef.current = 0;
      lastSpokenStepRef.current = -1;
      lastSpokenEarlyRef.current = new Set();
      setBoardingLabel(null);
      setState('navigating');
      const leg = legsRef.current[currentLegRef.current];
      say(leg?.steps[0]?.instruction || 'Continúa con el siguiente tramo.');
    } else {
      setState('arrived');
      say('Has llegado a tu destino.');
      stopSpeaking();
    }
  }, [say]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      try { localStorage.setItem('metrobot_nav_muted', next ? '1' : '0'); } catch {}
      if (next) stopSpeaking();
      return next;
    });
  }, []);

  return {
    state,
    pos,
    heading,
    cue,
    recalculating,
    boardingLabel,
    legIndex,
    legCount,
    muted,
    start,
    stop,
    nextLeg,
    toggleMute,
  };
}

/** Human label for what vehicle to board at a given station, e.g. "Metro línea A". */
function transportLabel(mode: string | undefined, route: RouteOption): string | undefined {
  if (!mode || mode === 'walk') return undefined;
  const names: Record<string, string> = {
    metro: 'Metro', metrocable: 'Metrocable', tranvia: 'Tranvía',
    metroplus: 'Metroplús', bus: 'Bus', bus_articulado: 'Bus integrado', encicla: 'EnCicla',
  };
  const base = names[mode] || 'transporte';
  const line = route.steps.find(s => s.mode === mode)?.line;
  return line ? `${base} ${line}` : base;
}
