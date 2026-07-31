import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MobileBottomSheet,
  nextSheetPresentation,
} from '../src/components/MobileBottomSheet';
import { MobileExploreActions } from '../src/components/MobileExploreActions';
import { MobileExploreSurface } from '../src/components/MobileExploreSurface';

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
  assert.match(html, /aria-labelledby="mobile-sheet-title"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />Planifica tu viaje</);
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
