import type { GameController, UiSnapshot } from '../controller/GameController';
import { PALETTE } from '../game/blocks';
import { CHARACTER_IDS } from '../game/characters';
import { MISSIONS } from '../game/missions';
import { CS } from '../i18n/cs';
import { iconFor } from './blockIcons';
import {
  IconBuild,
  IconClose,
  IconErase,
  IconFlag,
  IconGear,
  IconHint,
  IconMinus,
  IconPlus,
  IconRotateLeft,
  IconRotateRight,
  IconSpeaker,
} from './Icons';
import { MissionIcon, ProgressSlots } from './MissionIcon';

interface Props {
  game: GameController;
  ui: UiSnapshot;
}

export function Hud({ game, ui }: Props) {
  return (
    <>
      <TopBar game={game} ui={ui} />
      <div className="side left">
        <button
          className={`big-btn mode ${ui.mode === 'build' ? 'active' : ''}`}
          aria-label="Stavět"
          aria-pressed={ui.mode === 'build'}
          onClick={() => game.setMode('build')}
        >
          <IconBuild />
        </button>
        <button
          className={`big-btn mode erase ${ui.mode === 'erase' ? 'active' : ''}`}
          aria-label="Guma"
          aria-pressed={ui.mode === 'erase'}
          onClick={() => game.setMode('erase')}
        >
          <IconErase />
        </button>
      </div>
      <div className="side right">
        <div className="cam-row">
          <button className="big-btn cam" aria-label="Otočit doleva" onClick={() => game.rotate(-1)}>
            <IconRotateLeft />
          </button>
          <button className="big-btn cam" aria-label="Otočit doprava" onClick={() => game.rotate(1)}>
            <IconRotateRight />
          </button>
        </div>
        <div className="cam-row">
          <button className="big-btn cam" aria-label="Oddálit" onClick={() => game.zoom(1 / 1.25)}>
            <IconMinus />
          </button>
          <button className="big-btn cam" aria-label="Přiblížit" onClick={() => game.zoom(1.25)}>
            <IconPlus />
          </button>
        </div>
      </div>
      <Palette game={game} ui={ui} />
    </>
  );
}

function TopBar({ game, ui }: Props) {
  const m = ui.mission;
  return (
    <div className="topbar">
      {m ? (
        <div className={`mission-hud ${m.done ? 'done' : ''}`}>
          <div className="mission-hud-icon">
            <MissionIcon id={m.id} />
          </div>
          <ProgressSlots id={m.id} progress={m.progress} target={m.target} />
          <button className="round-btn" aria-label="Zopakovat pokyn" onClick={() => game.repeatInstruction()}>
            <IconSpeaker />
          </button>
          <button className="round-btn hint" aria-label="Nápověda" onClick={() => game.showHint()}>
            <IconHint />
          </button>
          <button className="round-btn ghost" aria-label="Ukončit úkol" onClick={() => game.quitMission()}>
            <IconClose />
          </button>
        </div>
      ) : (
        <button className="big-btn missions-btn" aria-label="Úkoly" onClick={() => game.openMissions()}>
          <IconFlag />
          <span className="mini-stars">
            {MISSIONS.map((d) => (
              <span key={d.id} className={ui.completed.includes(d.id) ? 'on' : ''} />
            ))}
          </span>
        </button>
      )}
      <div className="top-right">
        <div className="char-btns">
          {CHARACTER_IDS.map((id) => (
            <button
              key={id}
              className={`char-btn ${ui.selectedCharacter === id ? 'selected' : ''}`}
              aria-label={CS.voice.characters[id].name}
              aria-pressed={ui.selectedCharacter === id}
              onClick={() => game.selectCharacter(ui.selectedCharacter === id ? null : id)}
            >
              <span className="char-face" aria-hidden>
                {id === 'ondra' ? '👦' : '👧'}
              </span>
              <span className="char-name">{CS.voice.characters[id].name}</span>
            </button>
          ))}
        </div>
        <button className="parent-btn" aria-label={CS.ui.parents} onClick={() => game.openParents()}>
          <IconGear />
        </button>
      </div>
    </div>
  );
}

function Palette({ game, ui }: Props) {
  return (
    <div className="palette" role="toolbar" aria-label="Materiály">
      {PALETTE.map((t) => {
        const selected = ui.mode === 'build' && ui.material === t;
        return (
          <button
            key={t}
            className={`swatch ${selected ? 'selected' : ''} ${ui.highlightMaterial === t ? 'pulse' : ''}`}
            aria-label={CS.blockNames[t]}
            aria-pressed={selected}
            onClick={() => game.setMaterial(t)}
          >
            <img src={iconFor(t)} alt="" draggable={false} />
          </button>
        );
      })}
    </div>
  );
}
