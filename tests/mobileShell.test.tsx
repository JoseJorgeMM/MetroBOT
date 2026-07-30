import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MobileBottomSheet,
  nextSheetPresentation,
} from '../src/components/MobileBottomSheet';
import { MobileExploreActions } from '../src/components/MobileExploreActions';

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
