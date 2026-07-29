# Realtime Walking Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the MetroBOT mapping system to MapLibre GL for WebGL 3D rendering and implement smooth real-time walking navigation, compass stabilization, screen wake lock, and an updated mobile navigation HUD.

**Architecture:** Replacing the 2D Leaflet canvas with `react-map-gl` and `maplibre-gl`. In navigation mode, the camera tilts to a 3D perspective and rotates smoothly matching the user's heading (compass). Geolocation orientation will be smoothed via an Exponential Moving Average (EMA) filter.

**Tech Stack:** React 19, TypeScript, react-map-gl, maplibre-gl, Web APIs (SpeechSynthesis, Geolocation, DeviceOrientation, Wake Lock).

---

### Task 1: Package Dependencies Setup

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add MapLibre GL and update react-map-gl**
  Edit `package.json` to include `"maplibre-gl": "^4.5.0"` in dependencies, and ensure `react-map-gl` is configured:
  ```json
  "dependencies": {
    ...
    "maplibre-gl": "^4.5.0",
    "react-map-gl": "^8.1.0"
  }
  ```

- [x] **Step 2: Install dependencies**
  Run: `npm install`
  Expected: Successful dependency installation.

- [x] **Step 3: Run project compilation test**
  Run: `npm run lint`
  Expected: Successful compilation with zero errors.

- [x] **Step 4: Commit dependencies**
  Run:
  ```bash
  git add package.json package-lock.json
  git commit -m "chore: add maplibre-gl and update react-map-gl dependencies"
  ```

---

### Task 2: Sensor Smoothing, IOS Permission and Wake Lock in useNavigation

**Files:**
- Modify: `src/hooks/useNavigation.ts`

- [x] **Step 1: Implement Compass Heading Smoothing (EMA Filter)**
  Add compass smoothing utility to prevent map orientation jitter:
  ```typescript
  const EMA_ALPHA = 0.1;
  const smoothHeading = (prev: number | null, next: number) => {
    if (prev === null) return next;
    let diff = next - prev;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return (prev + EMA_ALPHA * diff + 360) % 360;
  };
  ```

- [x] **Step 2: Integrate Screen Wake Lock API**
  Add active wake lock state and requested screen locking in the hook's `start` and `stop` functions:
  ```typescript
  let wakeLockSentinel: any = null;
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request failed', err);
      }
    }
  };
  const releaseWakeLock = async () => {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  };
  ```
  Call `requestWakeLock()` inside the navigation `start` routine, and `releaseWakeLock()` inside `stop`.

- [x] **Step 3: Add Safari iOS DeviceOrientation request permission handler**
  Expose a method `requestOrientationPermission` in the hook context to prompt for iOS compass permission:
  ```typescript
  const requestOrientationPermission = async (): Promise<boolean> => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        return response === 'granted';
      } catch (err) {
        console.error('iOS Motion Permission rejected', err);
        return false;
      }
    }
    return true;
  };
  ```

- [x] **Step 4: Run compilation check**
  Run: `npm run lint`
  Expected: Successful compilation.

- [x] **Step 5: Commit Sensor enhancements**
  Run:
  ```bash
  git add src/hooks/useNavigation.ts
  git commit -m "feat: implement heading EMA smoothing, iOS permissions and wake lock in useNavigation"
  ```

---

### Task 3: Migrate MapComponent to MapLibre GL

**Files:**
- Modify: `src/components/Map/MapComponent.tsx`
- Modify: `src/components/Map/UserLocationMarker.tsx`

- [x] **Step 1: Rewrite MapComponent to use react-map-gl and maplibre-gl**
  Replace react-leaflet imports and containers with `react-map-gl` `<Map>` component:
  ```typescript
  import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';
  import 'maplibre-gl/dist/maplibre-gl.css';
  ```
  Load CartoDB Voyager Style:
  `style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"`

- [x] **Step 2: Bind camera pitch (tilt) and rotation (bearing) parameters**
  Add state and effect handlers to track `viewState`:
  - When `isNavigating` is true, bind camera `pitch` to `60` and `bearing` to `userHeading` (EMA smoothed).
  - Center map around `userPosition`.
  - Handle manual user drags to temporarily pause auto-follow and show a "Recentrar" button.

- [x] **Step 3: Implement route shapes rendering using GeoJSON layers**
  Convert the route segment polylines (`routePaths`) to a GeoJSON Source and Layer:
  - Transit layers get solid colors mapping to transport modes.
  - Walk layers get dotted/dashed line styling.

- [x] **Step 4: Refactor UserLocationMarker to 3D MapLibre Marker**
  Rewrite `UserLocationMarker.tsx` using `react-map-gl`'s `<Marker>` to render the blue location halo and rotating navigation arrow, adapting the rotation styling for map-aligned bearing.

- [x] **Step 5: Run lint and production builds**
  Run: `npm run build`
  Expected: Successful production build with no WebGL or typing errors.

- [x] **Step 6: Commit Map migration**
  Run:
  ```bash
  git add src/components/Map/MapComponent.tsx src/components/Map/UserLocationMarker.tsx
  git commit -m "feat: migrate MapComponent from Leaflet to MapLibre GL 3D vector map"
  ```

---

### Task 4: Re-design HUD Navigation Banners

**Files:**
- Modify: `src/components/Map/NavigationOverlay.tsx`

- [ ] **Step 1: Enhance instructions banner layout**
  Update the top-positioned instruction overlay. Style the text and navigation maneuvers using a solid, high-contrast dark green or dark slate style. Make the maneuver icon, turn direction, and distance highly visible.

- [ ] **Step 2: Add status bar with ETA and cancel controls**
  Modify the footer panel to collapse chat sheet when navigating. Instead, render a clean, bottom-anchored, horizontal mobile HUD displaying:
  - Remaining walk duration (minutes) in green.
  - Remaining distance (meters).
  - ETA timestamp.
  - Quick cancel (`X`) button.
  - Volume toggle.

- [ ] **Step 3: Test and compile overlay**
  Run: `npm run lint`
  Expected: Successful compilation.

- [ ] **Step 4: Commit HUD modifications**
  Run:
  ```bash
  git add src/components/Map/NavigationOverlay.tsx
  git commit -m "feat: implement high-contrast mobile navigation HUD overlay"
  ```

---

### Task 5: App.tsx Layout Integration

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Link navigation activation with Safari compass requests**
  In the `handleStartNav` routine, invoke the newly added `requestOrientationPermission()` before calling `nav.start()`.

- [ ] **Step 2: Collapse sheet and recenter camera on navigation init**
  Ensure that when navigation is initialized, sheet height collapses to `min` to allow complete Map visibility.

- [ ] **Step 3: Run final project validation tests**
  Run: `npm run build`
  Expected: Successful deployment bundle compilation with zero warnings or errors.

- [ ] **Step 4: Commit layout integration**
  Run:
  ```bash
  git add src/App.tsx
  git commit -m "feat: integrate layout collapser and compass permission trigger in App.tsx"
  ```
