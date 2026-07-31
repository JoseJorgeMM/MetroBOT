import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantPanel } from '../src/components/AssistantPanel';

const baseProps = {
  messages: [],
  query: '',
  isLoading: false,
  showSupport: false,
  onQueryChange: () => {},
  onSubmit: () => {},
  onToggleSupport: () => {},
  onClose: () => {},
};

test('assistant uses professional Spanish and a contextual welcome', () => {
  const html = renderToStaticMarkup(<AssistantPanel {...baseProps} />);

  assert.match(html, /¡Hola! Soy MetroBot/);
  assert.match(html, /Pregúntale a MetroBot/);
  assert.match(html, /¿Cómo llego a Plaza Mayor\?/);
  assert.match(html, /¿Cuál es la tarifa del Metro\?/);
  assert.match(html, /¿Cómo está operando la Línea A\?/);
  assert.doesNotMatch(html, /Que mas!/);
  assert.doesNotMatch(html, /Buses articulados ON/);
});

test('assistant preserves supplied messages in an accessible live log', () => {
  const html = renderToStaticMarkup(
    <AssistantPanel
      {...baseProps}
      messages={[
        { role: 'assistant', content: 'La Línea A opera con normalidad.' },
        { role: 'user', content: 'Gracias, MetroBot.' },
      ]}
      isLoading
    />,
  );

  assert.match(html, /role="log"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /La Línea A opera con normalidad\./);
  assert.match(html, /Gracias, MetroBot\./);
  assert.match(html, /Consultando información/);
});

test('assistant keeps system information hidden until explicitly opened', () => {
  const closedHtml = renderToStaticMarkup(<AssistantPanel {...baseProps} />);
  const openHtml = renderToStaticMarkup(<AssistantPanel {...baseProps} showSupport />);

  assert.match(closedHtml, /aria-label="Información del sistema"/);
  assert.match(closedHtml, /aria-label="Cerrar asistente"/);
  assert.doesNotMatch(closedHtml, /Canales de Atención SITVA/);
  assert.match(openHtml, /Canales de Atención SITVA/);
  assert.match(openHtml, /Tarifas SITVA 2026/);
  assert.match(openHtml, /Estado del Sistema/);
});

test('assistant exposes a mobile-safe composer and send target', () => {
  const html = renderToStaticMarkup(<AssistantPanel {...baseProps} />);

  assert.match(html, /text-base/);
  assert.match(html, /min-h-\[48px\]/);
  assert.match(html, /min-w-\[48px\]/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.match(html, /h-full/);
  assert.match(html, /100dvh/);
});
