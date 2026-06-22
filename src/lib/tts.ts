// ---------------------------------------------------------------------------
// Thin wrapper over the Web Speech API (SpeechSynthesis) for spoken
// navigation cues. Falls back silently when the API is unavailable so callers
// never need to guard for it.
// ---------------------------------------------------------------------------

let cachedVoices: SpeechSynthesisVoice[] | null = null;

function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  // Prefer Latin-American Spanish, then any Spanish.
  const prefs = ['es-CO', 'es-MX', 'es-US', 'es-AR', 'es-419', 'es-ES', 'es'];
  for (const code of prefs) {
    const match = voices.find(v => v.lang?.toUpperCase().replace('_', '-') === code.toUpperCase());
    if (match) return match;
  }
  const anySpanish = voices.find(v => v.lang?.toLowerCase().startsWith('es'));
  return anySpanish || null;
}

function loadVoices(): SpeechSynthesisVoice[] {
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;
  if (typeof speechSynthesis === 'undefined') return [];
  cachedVoices = speechSynthesis.getVoices();
  return cachedVoices;
}

// Chrome populates voices asynchronously.
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => { cachedVoices = speechSynthesis.getVoices(); };
}

/**
 * Speak a single navigation cue. Cancels any in-flight utterance so cues never
 * pile up when the user walks quickly through several maneuvers.
 */
export function speak(text: string, opts: { muted?: boolean } = {}): void {
  if (opts.muted) return;
  if (typeof speechSynthesis === 'undefined') return;

  // Cancel previous so rapid cues don't overlap.
  speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  const voice = pickSpanishVoice(loadVoices());
  if (voice) u.voice = voice;
  u.lang = voice?.lang || 'es-CO';
  u.rate = 1.0;
  u.pitch = 1.0;
  u.volume = 1.0;
  speechSynthesis.speak(u);
}

/** Stop any current/queued speech. */
export function stopSpeaking(): void {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** True if the browser exposes SpeechSynthesis at all. */
export function isSpeechSupported(): boolean {
  return typeof speechSynthesis !== 'undefined';
}
