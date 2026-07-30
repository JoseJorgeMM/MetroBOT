import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileBottomSheet } from '../src/components/MobileBottomSheet';
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
