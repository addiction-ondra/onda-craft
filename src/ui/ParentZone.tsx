import { useMemo, useState } from 'react';
import type { GameController, UiSnapshot } from '../controller/GameController';
import type { Settings } from '../game/settings';
import { CS } from '../i18n/cs';
import { WORLD_IDS } from '../game/worlds';
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
  const [confirm, setConfirm] = useState<null | 'world' | 'missions' | 'meadow'>(null);
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
      {!s.voice && (
        <div className="setting-row">
          <span />
          <button className="text-btn" onClick={() => game.testVoice()}>
            {CS.ui.testVoice}
          </button>
        </div>
      )}
      <p className="note">{CS.ui.soundHelp}</p>
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
            <p>{confirm === 'world' ? CS.ui.confirmReset : confirm === 'meadow' ? CS.ui.confirmMeadow : CS.ui.confirmMissions}</p>
            <button
              className="text-btn danger-btn"
              onClick={() => {
                if (confirm === 'world') game.resetWorld();
                else if (confirm === 'meadow') game.clearToMeadow();
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
            <button className="text-btn danger-btn" onClick={() => setConfirm('meadow')}>
              {CS.ui.meadowParent}
            </button>
            <button className="text-btn danger-btn" onClick={() => setConfirm('world')}>
              {CS.ui.resetWorld}
            </button>
          </>
        )}
      </div>

      <TestMode game={game} ui={ui} />

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

/** Testovací režim: malé tlačítko, po rozbalení rychlé skoky mezi světy a spouštění miniher. */
function TestMode({ game, ui }: Props) {
  const [open, setOpen] = useState(false);
  const t = CS.ui.test;
  return (
    <div className="test-mode">
      <button className="text-btn small" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t.hide : t.button}
      </button>
      {open && (
        <div className="test-panel" ref={(el) => el?.scrollIntoView({ block: 'end', behavior: 'smooth' })}>
          <p className="note">{t.note}</p>
          <div className="test-row">
            <span>{t.worlds}</span>
            {WORLD_IDS.map((w, i) => (
              <button key={w} className={`text-btn ${ui.worldId === w ? 'on' : ''}`} data-test-world={w} onClick={() => game.testJump(w)}>
                {CS.worlds.names[i]}
              </button>
            ))}
          </div>
          <div className="test-row">
            <button className="text-btn" data-test="complete" onClick={() => game.testCompleteAll()}>
              {t.completeAll}
            </button>
            <button className="text-btn" data-test="quiz" onClick={() => game.testOpen('quiz')}>
              {t.quiz}
            </button>
            <button className="text-btn" data-test="puzzle" onClick={() => game.testOpen('puzzle')}>
              {t.puzzle}
            </button>
            <button className="text-btn" data-test="sling" onClick={() => game.testOpen('sling')}>
              {t.sling}
            </button>
            <button className="text-btn" data-test="paint" onClick={() => game.testOpen('paint')}>
              {t.paint}
            </button>
            <button className="text-btn" data-test="memory" onClick={() => game.testOpen('memory')}>
              {t.memory}
            </button>
            <button className="text-btn" data-test="skate" onClick={() => game.testOpen('skate')}>
              {t.skate}
            </button>
            <button className="text-btn" data-test="dots" onClick={() => game.testOpen('dots')}>
              {t.dots}
            </button>
            <button className="text-btn" data-test="dig" onClick={() => game.testOpen('dig')}>
              {t.dig}
            </button>
            <button className="text-btn" data-test="travel" onClick={() => game.testOpen('travel')}>
              {t.travel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
