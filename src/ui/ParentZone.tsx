import { useMemo, useState } from 'react';
import type { GameController, UiSnapshot } from '../controller/GameController';
import type { Settings } from '../game/settings';
import { CS } from '../i18n/cs';
import { IconClose } from './Icons';

interface Props {
  game: GameController;
  ui: UiSnapshot;
}

const newQuestion = () => {
  const a = 6 + Math.floor(Math.random() * 7);
  const b = 5 + Math.floor(Math.random() * 7);
  return { a, b };
};

/** Rodičovská brána: dvouciferný součet, který čtyřleté dítě náhodou netrefí. */
export function ParentZone({ game, ui }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <div className="overlay dim parent">
      <div className="card parent-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        {unlocked ? <ParentSettings game={game} ui={ui} /> : <Gate onPass={() => setUnlocked(true)} />}
      </div>
    </div>
  );
}

function Gate({ onPass }: { onPass: () => void }) {
  const [q, setQ] = useState(newQuestion);
  const [value, setValue] = useState('');
  const press = (d: string) => {
    const v = (value + d).slice(0, 2);
    setValue(v);
    if (v.length === 2 || Number(v) === q.a + q.b) {
      if (Number(v) === q.a + q.b) onPass();
      else {
        setValue('');
        setQ(newQuestion());
      }
    }
  };
  return (
    <div className="gate">
      <p className="gate-hint">{CS.ui.gateHint}</p>
      <h2>{CS.ui.gateQuestion(q.a, q.b)}</h2>
      <div className="gate-display">{value || ' '}</div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
          <button key={d} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button onClick={() => setValue('')} aria-label="Smazat">
          ⌫
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <button className={`switch ${value ? 'on' : ''}`} role="switch" aria-checked={value} onClick={() => onChange(!value)}>
        <span />
      </button>
    </label>
  );
}

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ v: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ParentSettings({ game, ui }: Props) {
  const s = ui.settings;
  const [confirm, setConfirm] = useState<null | 'world' | 'missions'>(null);
  const up = (p: Partial<Settings>) => game.updateSettings(p);
  const version = useMemo(() => __APP_VERSION__, []);

  return (
    <div className="settings">
      <h2>{CS.ui.settingsTitle}</h2>
      <Toggle label={CS.ui.voice} value={s.voice} onChange={(v) => up({ voice: v })} />
      {s.voice && (
        <>
          <Choice
            label={CS.ui.voiceRate}
            value={s.voiceRate}
            options={[
              { v: 'slow', label: CS.ui.slow },
              { v: 'normal', label: CS.ui.normal },
            ]}
            onChange={(v) => up({ voiceRate: v })}
          />
          <div className="setting-row">
            <span />
            <button className="text-btn" onClick={() => game.testVoice()}>
              {CS.ui.testVoice}
            </button>
          </div>
          {(!ui.speechSupported || !ui.hasCzechVoice) && <p className="note">{CS.ui.noCzechVoice}</p>}
        </>
      )}
      <Toggle label={CS.ui.sounds} value={s.sounds} onChange={(v) => up({ sounds: v })} />
      <Toggle label={CS.ui.autoHints} value={s.autoHints} onChange={(v) => up({ autoHints: v })} />
      <Choice
        label={CS.ui.breakReminder}
        value={s.breakReminderMin}
        options={[
          { v: 0, label: CS.ui.off },
          { v: 15, label: CS.ui.minutes(15) },
          { v: 30, label: CS.ui.minutes(30) },
        ]}
        onChange={(v) => up({ breakReminderMin: v })}
      />

      <div className="danger">
        {confirm ? (
          <div className="confirm">
            <p>{confirm === 'world' ? CS.ui.confirmReset : CS.ui.confirmMissions}</p>
            <button
              className="text-btn danger-btn"
              onClick={() => {
                if (confirm === 'world') game.resetWorld();
                else game.resetMissions();
                setConfirm(null);
              }}
            >
              {CS.ui.yes}
            </button>
            <button className="text-btn" onClick={() => setConfirm(null)}>
              {CS.ui.no}
            </button>
          </div>
        ) : (
          <>
            <button className="text-btn" onClick={() => setConfirm('missions')}>
              {CS.ui.resetMissions}
            </button>
            <button className="text-btn danger-btn" onClick={() => setConfirm('world')}>
              {CS.ui.resetWorld}
            </button>
          </>
        )}
      </div>

      <div className="info">
        <h3>{CS.ui.installTitle}</h3>
        <p>{CS.ui.installText}</p>
        <p>{CS.ui.privacy}</p>
        <p className="muted">
          {CS.ui.version} {version}
        </p>
      </div>
    </div>
  );
}
