import { useMemo } from 'react';
import type { GameController, UiSnapshot } from '../controller/GameController';
import { MISSIONS, type MissionId } from '../game/missions';
import { CS } from '../i18n/cs';
import { iconFor } from './blockIcons';
import { IconBuild, IconClose, IconPlay, IconSpeaker, IconStar } from './Icons';
import { MissionDemo } from './MissionDemo';
import { MissionIcon } from './MissionIcon';

interface Props {
  game: GameController;
  ui: UiSnapshot;
}

export function StartScreen({ game }: { game: GameController }) {
  return (
    <div className="overlay start">
      <div className="logo" aria-label={CS.appName}>
        <div className="logo-blocks">
          {(['grass', 'wood', 'red', 'blue', 'sand'] as const).map((t, i) => (
            <img key={t} src={iconFor(t)} alt="" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <h1>
          <span>ONDA</span> <span>CRAFT</span>
        </h1>
      </div>
      <button className="play-btn" aria-label={CS.ui.play} onClick={() => game.start()}>
        <IconPlay />
      </button>
    </div>
  );
}

export function MissionMenu({ game, ui }: Props) {
  return (
    <div className="overlay dim" onClick={() => game.closeOverlay()}>
      <div className="card menu-card" onClick={(e) => e.stopPropagation()}>
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="menu-grid">
          <button className="menu-item free" aria-label="Volné stavění" onClick={() => game.closeOverlay()}>
            <span className="menu-pic">
              <IconBuild />
            </span>
          </button>
          {MISSIONS.map((m) => (
            <button key={m.id} className="menu-item" aria-label={CS.missions[m.id].title} onClick={() => game.chooseMission(m.id)}>
              <span className="menu-pic">
                <MissionIcon id={m.id} />
              </span>
              <span className="menu-star">
                <IconStar filled={ui.completed.includes(m.id)} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MissionIntro({ game, id }: { game: GameController; id: MissionId }) {
  return (
    <div className="overlay dim">
      <div className="card intro-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="intro-head">
          <span className="intro-icon">
            <MissionIcon id={id} />
          </span>
          <h2>{CS.missions[id].title}</h2>
          <button className="round-btn" aria-label="Zopakovat" onClick={() => game.chooseMission(id)}>
            <IconSpeaker />
          </button>
        </div>
        <MissionDemo id={id} />
        <button className="go-btn" onClick={() => game.beginMission(id)}>
          <IconPlay /> <span>{CS.ui.go}</span>
        </button>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ffa94d'];

export function Success({ game, ui, id }: Props & { id: MissionId }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.2 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: Math.random() * 360,
      })),
    [],
  );
  const next = MISSIONS.find((m) => m.id !== id && !ui.completed.includes(m.id));
  return (
    <div className="overlay dim success">
      <div className="confetti" aria-hidden>
        {pieces.map((p, i) => (
          <span
            key={i}
            style={{
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              transform: `rotate(${p.rot}deg)`,
            }}
          />
        ))}
      </div>
      <div className="card success-card">
        <div className="success-star">
          <IconStar />
        </div>
        <div className="success-mission">
          <MissionIcon id={id} />
        </div>
        <div className="success-actions">
          <button className="go-btn secondary" aria-label={CS.ui.continue} onClick={() => game.closeOverlay()}>
            <IconBuild />
          </button>
          {next && (
            <button className="go-btn" aria-label={CS.ui.next} onClick={() => game.chooseMission(next.id)}>
              <MissionIcon id={next.id} />
              <IconPlay />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BreakOverlay({ game }: { game: GameController }) {
  return (
    <div className="overlay dim">
      <div className="card break-card">
        <div className="break-pic" aria-hidden>
          🧸🥤🤸
        </div>
        <h2>{CS.ui.breakTitle}</h2>
        <button className="go-btn" onClick={() => game.closeOverlay()}>
          {CS.ui.breakOk}
        </button>
      </div>
    </div>
  );
}
