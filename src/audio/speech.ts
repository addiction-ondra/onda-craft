/**
 * Hlasové pokyny přes Web Speech API (offline hlasy zařízení, žádné externí API).
 * iOS: první promluva musí vzniknout z uživatelského gesta – voláme `unlock()`
 * z tlačítka „Hrát“.
 */
export class Speech {
  enabled = true;
  rate = 0.9;
  private voice: SpeechSynthesisVoice | null = null;
  private readonly synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

  constructor() {
    if (!this.synth) return;
    this.pickVoice();
    this.synth.addEventListener?.('voiceschanged', () => this.pickVoice());
  }

  get supported(): boolean {
    return !!this.synth;
  }

  get hasCzechVoice(): boolean {
    return !!this.voice;
  }

  private pickVoice(): void {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    const cs = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('cs'));
    // Preferuj kvalitnější (enhanced/premium) hlasy, pokud jsou nainstalované.
    this.voice =
      cs.find((v) => /premium|enhanced|vylepšen/i.test(v.name)) ?? cs.find((v) => v.localService) ?? cs[0] ?? null;
  }

  /** Odemkne syntézu na iOS – volat přímo v obsluze ťuknutí. */
  unlock(): void {
    if (!this.synth) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'cs-CZ';
      this.synth.speak(u);
    } catch {
      /* ignore */
    }
  }

  /** Řekne větu. Předchozí nedořečenou větu přeruší (dítě nečeká na frontu). */
  say(text: string, opts: { interrupt?: boolean } = {}): void {
    if (!this.enabled || !this.synth || !text) return;
    try {
      if (opts.interrupt !== false) this.synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'cs-CZ';
      if (this.voice) u.voice = this.voice;
      u.rate = this.rate;
      u.pitch = 1.1;
      this.synth.speak(u);
    } catch {
      /* hlas je jen bonus – hra funguje i bez něj */
    }
  }

  stop(): void {
    this.synth?.cancel();
  }
}
