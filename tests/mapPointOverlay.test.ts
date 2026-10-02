import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapPointOverlay } from '../src/lib/mapPointOverlay';

test('projected markers keep fixed pixel dimensions across zoom and clean up their DOM', () => {
  let scale = 1;
  let attached: any;
  let removed = false;
  const element = { style: {}, className: '', setAttribute() {}, addEventListener() {}, removeEventListener() {}, remove() { removed = true; } } as any;
  const original = globalThis.document;
  globalThis.document = { createElement: () => element } as any;
  class OverlayView {
    onAdd() {} draw() {} onRemove() {}
    setMap(map: unknown) { if (map) { this.onAdd(); this.draw(); } else this.onRemove(); }
    getPanes() { return { overlayMouseTarget: { appendChild(el: any) { attached = el; } } }; }
    getProjection() { return { fromLatLngToDivPixel: () => ({ x: 30 * scale, y: 60 * scale }) }; }
    static preventMapHitsAndGesturesFrom() {}
  }
  try {
    const overlay = createMapPointOverlay({ OverlayView, LatLng: class {} }, {}, { lat: 6, lng: -75 }, 'destination', 'Destino');
    assert.equal(attached.style.width, '44px');
    assert.equal(attached.style.height, '44px');
    assert.match(attached.innerHTML, /path/);
    scale = 16;
    overlay.draw();
    assert.equal(attached.style.left, '480px');
    assert.equal(attached.style.width, '44px');
    assert.equal(attached.style.height, '44px');
    overlay.setMap(null);
    assert.equal(removed, true);
  } finally { globalThis.document = original; }
});
