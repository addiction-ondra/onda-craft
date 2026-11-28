/** Jazyk hry – vybírají ho děti vlajkou nahoře. */
export type Lang = 'cs' | 'en';

export interface Settings {
  /** Jazyk textů a hlasu. */
  lang: Lang;
  /** Hlasové pokyny (čeština). */
  voice: boolean;
  /** Krátké zvukové efekty. */
  sounds: boolean;
  /** Rychlost hlasu: pomalejší je pro malé děti srozumitelnější. */
  voiceRate: 'slow' | 'normal';
  /** Automatická nápověda po chvíli nečinnosti v misi. */
  autoHints: boolean;
  /** Jemné připomenutí přestávky v minutách (0 = vypnuto). */
  breakReminderMin: 0 | 15 | 30;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'cs',
  voice: true,
  sounds: true,
  voiceRate: 'slow',
  autoHints: true,
  breakReminderMin: 0,
};

/** Po kolika sekundách nečinnosti v misi přijde nápověda. */
export const HINT_DELAY_MS = 20_000;

export function sanitizeSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  if (r.lang === 'cs' || r.lang === 'en') s.lang = r.lang;
  if (typeof r.voice === 'boolean') s.voice = r.voice;
  if (typeof r.sounds === 'boolean') s.sounds = r.sounds;
  if (r.voiceRate === 'slow' || r.voiceRate === 'normal') s.voiceRate = r.voiceRate;
  if (typeof r.autoHints === 'boolean') s.autoHints = r.autoHints;
  if (r.breakReminderMin === 0 || r.breakReminderMin === 15 || r.breakReminderMin === 30) s.breakReminderMin = r.breakReminderMin;
  return s;
}
