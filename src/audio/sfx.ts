/** Krátké, měkké zvuky syntetizované přes Web Audio – žádné soubory, žádné ostré tóny. */
export type SfxName = 'place' | 'remove' | 'select' | 'collect' | 'success' | 'soft' | 'animal' | 'click';

type Ctx = AudioContext;

/** 0,1 s ticha jako WAV – přepne iOS do režimu „přehrávání“, který ignoruje tichý přepínač. */
function silentWavUrl(): string {
  const rate = 8000;
  const samples = 800;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); // 8 bit
  str(36, 'data');
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128); // ticho
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class Sfx {
  enabled = true;
  private ctx: Ctx | null = null;
  private silentAudio: HTMLAudioElement | null = null;

  /**
   * Volat z uživatelského gesta (iOS). Lze volat opakovaně – obnoví zvuk
   * i po návratu aplikace z pozadí (stav „interrupted“).
   */
  unlock(): void {
    try {
      // Safari 17+: zvuk hry má hrát i při zapnutém tichém režimu (jako video).
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session && session.type !== 'playback') session.type = 'playback';
    } catch {
      /* ignore */
    }
    // Starší iOS: přehrání <audio> v gestu přepne zvukovou relaci na „playback“.
    try {
      if (!this.silentAudio) {
        this.silentAudio = new Audio(silentWavUrl());
        this.silentAudio.setAttribute('playsinline', '');
      }
      void this.silentAudio.play().catch(() => {});
    } catch {
      /* ignore */
    }

    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    this.resume();
    // Krátký neslyšitelný buffer – definitivně „probudí“ Web Audio na iOS.
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }

  /** Volat při každém dotyku: když iOS zvuk mezitím uspal (pozadí, hovor), znovu ho odemkne. */
  wake(): void {
    if (this.ctx && this.ctx.state !== 'running') this.unlock();
  }

  private resume(): void {
    // iOS používá i nestandardní stav „interrupted“ – obnovujeme vše, co neběží.
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
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
    this.resume();
    switch (name) {
      case 'place':
        this.tone(420, 0, 0.12, 'triangle', 0.3, 700);
        break;
      case 'remove':
        this.tone(600, 0, 0.14, 'triangle', 0.25, 300);
        break;
      case 'select':
      case 'click':
        this.tone(880, 0, 0.07, 'sine', 0.18);
        break;
      case 'soft':
        this.tone(330, 0, 0.18, 'sine', 0.18, 290);
        break;
      case 'collect':
        [784, 988, 1319].forEach((f, i) => this.tone(f, i * 0.07, 0.18, 'sine', 0.22));
        break;
      case 'animal':
        this.tone(500, 0, 0.18, 'sine', 0.22, 900);
        break;
      case 'success':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i * 0.13, 0.25, 'triangle', 0.25));
        break;
    }
  }
}
