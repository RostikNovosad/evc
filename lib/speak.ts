export type Accent = 'en-US' | 'en-GB';

export function speak(text: string, accent: Accent) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = accent;
  u.rate = 0.9;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-') === accent);
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
