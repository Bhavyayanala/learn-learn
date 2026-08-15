// LearnNest — text-to-speech wrapper (master prompt section 10: short
// confirmations only, never reading whole pages aloud automatically).

export function speak(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  window.speechSynthesis.cancel(); // don't stack overlapping confirmations
  window.speechSynthesis.speak(utterance);
}
