import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MobileBottomSheet,
  nextSheetPresentation,
} from '../src/components/MobileBottomSheet';
import { MobileExploreActions } from '../src/components/MobileExploreActions';
import { MobileExploreSurface } from '../src/components/MobileExploreSurface';
import { RouteCard } from '../src/components/RouteCards/RouteCard';
import type { RouteOption } from '../src/lib/routing';

const routeFixture: RouteOption = {
  id: 'route-fixture',
  modes: ['walk', 'metro', 'walk'],
  duration: 24,
  cost: 3430,
  transfers: 0,
  steps: [
    { instruction: 'Camina a la estación', mode: 'walk', duration: 4, cost: 0 },
    { instruction: 'Toma el Metro', mode: 'metro', duration: 16, cost: 3430 },
    { instruction: 'Camina al destino', mode: 'walk', duration: 4, cost: 0 },
  ],
};

test('explore actions expose one primary trip action and a secondary assistant action', () => {
  const html = renderToStaticMarkup(
    <MobileExploreActions onPlanTrip={() => {}} onAskMetroBot={() => {}} />,
  );
  assert.match(html, />Planear un viaje</);
  assert.match(html, />Pregúntale a MetroBot</);
  assert.match(html, /aria-label="Planear un viaje"/);
});

test('bottom sheet exposes its title and expansion state', () => {
  const html = renderToStaticMarkup(
    <MobileBottomSheet
      presentation="compact"
      title="Planifica tu viaje"
      onPresentationChange={() => {}}
    >
      <p>Contenido</p>
    </MobileBottomSheet>,
  );
  const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(titleId);
  assert.match(html, new RegExp(`id="${titleId}"`));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />Planifica tu viaje</);
});

test('multiple bottom sheets keep accessible title ids unique', () => {
  const html = renderToStaticMarkup(
    <>
      <MobileBottomSheet presentation="compact" title="Primero" onPresentationChange={() => {}}>
        <p>Contenido</p>
      </MobileBottomSheet>
      <MobileBottomSheet presentation="medium" title="Segundo" onPresentationChange={() => {}}>
        <p>Contenido</p>
      </MobileBottomSheet>
    </>,
  );
  const labelledByIds = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(labelledByIds).size, 2);
  for (const id of labelledByIds) assert.match(html, new RegExp(`id="${id}"`));
});

test('bottom sheet owns contained scrolling and can expose a non-resizable handle', () => {
  const html = renderToStaticMarkup(
    <MobileBottomSheet
      presentation="medium"
      title="Rutas disponibles"
      resizable={false}
      onPresentationChange={() => {}}
    >
      <p>Contenido</p>
    </MobileBottomSheet>,
  );
  assert.match(html, /data-mobile-sheet-scroll-owner="true" class="[^"]*mobile-sheet-scroll/);
  assert.match(html, /aria-label="Tamaño del panel fijo"[^>]*disabled/);
});

test('bottom sheet uses theme tokens instead of fixed light colors', () => {
  const html = renderToStaticMarkup(
    <MobileBottomSheet presentation="compact" title="MetroBot" onPresentationChange={() => {}}>
      <p>Contenido</p>
    </MobileBottomSheet>,
  );
  assert.match(html, /\bbg-card\b/);
  assert.match(html, /\btext-foreground\b/);
  assert.doesNotMatch(html, /\bbg-white\b/);
  assert.doesNotMatch(html, /\btext-slate-950\b/);
});

test('bottom sheet can keep a redundant title accessible without consuming layout space', () => {
  const html = renderToStaticMarkup(
    <MobileBottomSheet
      presentation="expanded"
      title="Pregúntale a MetroBot"
      titleVisuallyHidden
      onPresentationChange={() => {}}
    >
      <p>Contenido</p>
    </MobileBottomSheet>,
  );
  assert.match(html, /<h2[^>]*class="sr-only"[^>]*>Pregúntale a MetroBot<\/h2>/);
});

test('bottom sheet lets the desktop side panel own its height', () => {
  const html = renderToStaticMarkup(
    <MobileBottomSheet
      presentation="medium"
      title="Planifica tu viaje"
      onPresentationChange={() => {}}
    >
      <p>Contenido</p>
    </MobileBottomSheet>,
  );
  assert.match(html, /class="[^"]*\blg:h-full\b/);
  assert.doesNotMatch(html, /style="(?:height:|[^"]*;height:)/);
});

test('bottom sheet presentation cycle returns to compact after expanded', () => {
  assert.equal(nextSheetPresentation('compact'), 'medium');
  assert.equal(nextSheetPresentation('medium'), 'expanded');
  assert.equal(nextSheetPresentation('expanded'), 'compact');
});

test('compact explore keeps both core actions, rain, and quick picks outside the sheet scroll owner', () => {
  const html = renderToStaticMarkup(
    <MobileExploreSurface
      mapSelectionMode={null}
      hasAvailableRoutes
      isRaining
      quickPicks={<button type="button">Casa</button>}
      onPlanTrip={() => {}}
      onAskMetroBot={() => {}}
      onShowResults={() => {}}
      onPresentationChange={() => {}}
    />,
  );

  const overlayStart = html.indexOf('data-mobile-explore-overlay="true"');
  const sheetScrollOwner = html.indexOf('data-mobile-sheet-scroll-owner="true"');
  assert.ok(overlayStart >= 0, 'Explore must expose a map overlay');
  assert.ok(sheetScrollOwner > overlayStart, 'The compact sheet must follow the map overlay');
  assert.ok(html.indexOf('Planear un viaje') < sheetScrollOwner, 'The destination action must stay outside compact-sheet scrolling');
  assert.ok(html.indexOf('Pregúntale a MetroBot') < sheetScrollOwner, 'The assistant action must stay outside compact-sheet scrolling');
  assert.ok(html.indexOf('Llueve en Medellín') >= overlayStart && html.indexOf('Llueve en Medellín') < sheetScrollOwner, 'Rain context must stay with the map-first destination cluster');
  assert.ok(html.indexOf('Casa') < sheetScrollOwner, 'Quick picks must stay outside compact-sheet scrolling');
  assert.match(html, /--mobile-sheet-height:112px/);
});

test('a route result exposes selection and navigation as separate controls', () => {
  const html = renderToStaticMarkup(
    <RouteCard
      route={routeFixture}
      isSelected={false}
      routeIndex={0}
      onSelect={() => {}}
      onStartNav={() => {}}
    />,
  );

  assert.match(html, /aria-label="Seleccionar Ruta 1: 24 minutos por A pie, Metro, A pie"/);
  assert.match(html, />Iniciar navegación</);
});

test('route mode icons expose a semantic Spanish transport summary', () => {
  const html = renderToStaticMarkup(
    <RouteCard route={routeFixture} routeIndex={0} onSelect={() => {}} />,
  );

  assert.match(html, /<ul[^>]*aria-label="Modos de transporte"/);
  assert.match(html, /class="sr-only">A pie</);
  assert.match(html, /class="sr-only">Metro</);
});

test('incomplete route steps retain a truthful walking and navigation summary', () => {
  const routeWithoutSteps = { ...routeFixture, steps: undefined } as unknown as RouteOption;
  const routeWithEmptySteps = { ...routeFixture, id: 'empty-steps', steps: [] };

  for (const route of [routeWithoutSteps, routeWithEmptySteps]) {
    assert.doesNotThrow(() => renderToStaticMarkup(
      <RouteCard route={route} routeIndex={0} onStartNav={() => {}} />,
    ));
    const html = renderToStaticMarkup(
      <RouteCard route={route} routeIndex={0} onStartNav={() => {}} />,
    );
    assert.match(html, />Incluye tramo a pie</);
    assert.match(html, />Iniciar navegación</);
  }
});

test('same-duration route results have distinct selection names', () => {
  const html = renderToStaticMarkup(
    <>
      <RouteCard route={routeFixture} routeIndex={0} onSelect={() => {}} />
      <RouteCard route={{ ...routeFixture, id: 'route-fixture-2' }} routeIndex={1} onSelect={() => {}} />
    </>,
  );

  assert.match(html, /aria-label="Seleccionar Ruta 1: 24 minutos por A pie, Metro, A pie"/);
  assert.match(html, /aria-label="Seleccionar Ruta 2: 24 minutos por A pie, Metro, A pie"/);
});
