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

  /**
   * Připraví syntézu na iOS – volat přímo v obsluze ťuknutí.
   * (Samotné odemknutí zajistí první `say()` ve stejném gestu.)
   */
  unlock(): void {
    if (!this.synth) return;
    if (!this.voice) this.pickVoice();
    try {
      // iOS Safari občas nechá syntézu „zaseknutou“ v pauze.
      if (this.synth.paused) this.synth.resume();
    } catch {
      /* ignore */
    }
  }

  /** iOS zahodí promluvu, na kterou nevede žádný odkaz – držíme ji, dokud nedomluví. */
  private current: SpeechSynthesisUtterance | null = null;
  /** Rozhovor: repliky se říkají postupně, další až po skončení předchozí. */
  private dialog: Array<{ text: string; pitch?: number; onStart?: () => void }> = [];
  private dialogTimer: number | undefined;
  private dialogToken = 0;

  private makeUtterance(text: string, pitch?: number): SpeechSynthesisUtterance {
    if (!this.voice) this.pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'cs-CZ';
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate;
    u.pitch = pitch ?? 1.1;
    u.volume = 1;
    return u;
  }

  /** Řekne větu. Předchozí nedořečenou větu (i rozhovor) přeruší – dítě nečeká na frontu. */
  say(text: string, opts: { interrupt?: boolean; pitch?: number } = {}): void {
    if (!this.enabled || !this.synth || !text) return;
    if (opts.interrupt !== false) this.cancelDialog();
    try {
      const busy = this.synth.speaking || this.synth.pending;
      if (opts.interrupt !== false && busy) {
        // iOS Safari po cancel() spolkne větu řečenou ve stejném okamžiku – chvilku počkáme.
        this.synth.cancel();
        const token = this.dialogToken;
        window.setTimeout(() => token === this.dialogToken && this.speakNow(text, opts.pitch), 120);
        return;
      }
      this.speakNow(text, opts.pitch);
    } catch {
      /* hlas je jen bonus – hra funguje i bez něj */
    }
  }

  private speakNow(text: string, pitch?: number, onEnd?: () => void): void {
    if (!this.synth) return;
    try {
      if (this.synth.paused) this.synth.resume();
      const u = this.makeUtterance(text, pitch);
      u.onend = u.onerror = () => {
        if (this.current === u) this.current = null;
        onEnd?.();
      };
      this.current = u;
      this.synth.speak(u);
    } catch {
      onEnd?.();
    }
  }

  /**
   * Rozhovor (např. Ondra a Laura). Repliky jdou po sobě, `onStart` se zavolá
   * na začátku každé (bublina nad tím, kdo mluví). Funguje i s vypnutým hlasem –
   * pak repliky „běží“ podle odhadu délky, aby bubliny dál ukazovaly, kdo mluví.
   */
  sayLines(lines: Array<{ text: string; pitch?: number; onStart?: () => void }>): void {
    this.cancelDialog();
    const token = ++this.dialogToken;
    this.dialog = [...lines];
    if (this.synth && (this.synth.speaking || this.synth.pending)) this.synth.cancel();
    // malá pauza – iOS po cancel() potřebuje chvilku
    this.dialogTimer = window.setTimeout(() => this.nextLine(token), 150);
  }

  private nextLine(token: number): void {
    if (token !== this.dialogToken) return;
    const line = this.dialog.shift();
    if (!line) return;
    line.onStart?.();
    if (!line.text) {
      // jen vizuální krok (např. srdíčka na konci), nic se neříká
      this.dialogTimer = window.setTimeout(() => this.nextLine(token), 50);
      return;
    }
    // Pojistka: když iOS konec věty neohlásí, pokračujeme podle odhadu délky.
    const estimate = 900 + line.text.length * 75;
    let done = false;
    const next = () => {
      if (done || token !== this.dialogToken) return;
      done = true;
      window.clearTimeout(this.dialogTimer);
      this.dialogTimer = window.setTimeout(() => this.nextLine(token), 350);
    };
    if (this.enabled && this.synth) {
      this.speakNow(line.text, line.pitch, next);
      this.dialogTimer = window.setTimeout(next, estimate + 2500);
    } else {
      this.dialogTimer = window.setTimeout(next, estimate);
    }
  }

  private cancelDialog(): void {
    this.dialogToken++;
    this.dialog = [];
    window.clearTimeout(this.dialogTimer);
  }

  stop(): void {
    this.cancelDialog();
    this.synth?.cancel();
  }
}
