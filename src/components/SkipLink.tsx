// SkipLink.tsx
// -----------------------------------------------------------------------------
// Hidden-until-focused link that lets keyboard users jump straight to the map
// region, skipping the chat sheet.
// -----------------------------------------------------------------------------

import React from 'react';

export function SkipLink() {
  return (
    <a
      href="#map-region"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:rounded-full focus:bg-sitva-green focus:text-white focus:px-3 focus:py-2 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
    >
      Saltar al mapa
    </a>
  );
}
