import React from 'react';
import { Info, Send, X } from 'lucide-react';
import { SupportChannels } from './SupportChannels';
import { SystemStatus } from './SystemStatus';
import { TariffInfo } from './TariffInfo';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantPanelProps {
  messages: AssistantMessage[];
  query: string;
  isLoading: boolean;
  showSupport: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onToggleSupport: () => void;
  onClose: () => void;
}

const suggestedPrompts = [
  '¿Cómo llego a Plaza Mayor?',
  '¿Cuál es la tarifa del Metro?',
  '¿Cómo está operando la Línea A?',
];

export function AssistantPanel({
  messages,
  query,
  isLoading,
  showSupport,
  onQueryChange,
  onSubmit,
  onToggleSupport,
  onClose,
}: AssistantPanelProps) {
  return (
    <section
      aria-label="Asistente MetroBot"
      className="flex h-full max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-background"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/30 bg-card px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-foreground">MetroBot</h2>
          <p className="text-xs text-muted-foreground">Asistente de viaje SITVA</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Información del sistema"
            aria-expanded={showSupport}
            onClick={onToggleSupport}
            className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-foreground transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sitva-green dark:hover:bg-slate-800"
          >
            <Info className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Cerrar asistente"
            onClick={onClose}
            className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-foreground transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sitva-green dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mobile-sheet-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {showSupport && (
          <section aria-labelledby="assistant-system-information" className="mb-4">
            <h3 id="assistant-system-information" className="sr-only">Información del sistema</h3>
            <SupportChannels />
            <TariffInfo />
            <SystemStatus />
          </section>
        )}

        {messages.length === 0 && (
          <section className="mb-4 rounded-2xl border border-sitva-green/20 bg-sitva-green/5 p-4">
            <h3 className="text-base font-semibold text-foreground">¡Hola! Soy MetroBot</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Puedo orientarte sobre rutas, tarifas y el estado del sistema para tu viaje en Medellín.
            </p>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Preguntas sugeridas">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onQueryChange(prompt)}
                  className="min-h-[44px] rounded-full border border-sitva-green/30 bg-card px-3 py-2 text-left text-sm font-medium text-sitva-green transition-colors hover:bg-sitva-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sitva-green"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        )}

        <div role="log" aria-live="polite" aria-relevant="additions text" className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <p className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                message.role === 'user'
                  ? 'rounded-br-sm bg-chat-bubble-user text-chat-bubble-user-text'
                  : 'rounded-bl-sm bg-chat-bubble-assistant text-chat-bubble-assistant-text'
              }`}>
                {message.content}
              </p>
            </div>
          ))}
          {isLoading && (
            <p className="text-sm text-muted-foreground" role="status">Consultando información…</p>
          )}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="shrink-0 border-t border-border/30 bg-card p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      >
        <label htmlFor="assistant-query" className="sr-only">Pregúntale a MetroBot</label>
        <div className="flex items-center gap-2">
          <input
            id="assistant-query"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Pregúntale a MetroBot"
            className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sitva-green"
          />
          <button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={!query.trim() || isLoading}
            className="flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl bg-sitva-green text-white transition-colors hover:bg-sitva-green/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sitva-green focus-visible:ring-offset-2"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
