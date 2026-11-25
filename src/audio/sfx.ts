/** Krátké, měkké zvuky syntetizované přes Web Audio – žádné soubory, žádné ostré tóny. */
export type SfxName = 'place' | 'remove' | 'select' | 'collect' | 'success' | 'soft' | 'animal' | 'click';

type Ctx = AudioContext;

export class Sfx {
  enabled = true;
  private ctx: Ctx | null = null;

  /** Volat z uživatelského gesta (iOS). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, slideTo?: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  play(name: SfxName): void {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    switch (name) {
      case 'place':
        this.tone(420, 0, 0.12, 'triangle', 0.22, 700);
        break;
      case 'remove':
        this.tone(600, 0, 0.14, 'triangle', 0.18, 300);
        break;
      case 'select':
      case 'click':
        this.tone(880, 0, 0.07, 'sine', 0.12);
        break;
      case 'soft':
        this.tone(330, 0, 0.18, 'sine', 0.12, 290);
        break;
      case 'collect':
        [784, 988, 1319].forEach((f, i) => this.tone(f, i * 0.07, 0.18, 'sine', 0.16));
        break;
      case 'animal':
        this.tone(500, 0, 0.18, 'sine', 0.16, 900);
        break;
      case 'success':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i * 0.13, 0.25, 'triangle', 0.18));
        break;
    }
  }
}
