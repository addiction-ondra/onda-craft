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
  IconWalker,
  IconHammer,
  IconCastle,
  IconKey,
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
      {ui.playMode === 'build' && (
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
      )}
      <div className="side right">
        <div className="mode-col" role="toolbar" aria-label="Režim">
          <button
            className={`big-btn modebtn ${ui.playMode === 'walk' ? 'active' : ''}`}
            aria-label={CS.ui.walk}
            aria-pressed={ui.playMode === 'walk'}
            onClick={() => game.setPlayMode('walk')}
          >
            <IconWalker />
          </button>
          <button
            className={`big-btn modebtn ${ui.playMode === 'build' ? 'active' : ''}`}
            aria-label={CS.ui.build}
            aria-pressed={ui.playMode === 'build'}
            onClick={() => game.setPlayMode('build')}
          >
            <IconHammer />
          </button>
          <button
            className={`big-btn modebtn ${ui.playMode === 'architect' ? 'active' : ''}`}
            aria-label={CS.ui.builder}
            aria-pressed={ui.playMode === 'architect'}
            onClick={() => game.setPlayMode('architect')}
          >
            <IconCastle />
          </button>
        </div>
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
      {ui.playMode === 'build' && <Palette game={game} ui={ui} />}
      {ui.playMode === 'walk' && <FriendBar game={game} ui={ui} />}
      {ui.playMode === 'architect' && <TemplateBar game={game} ui={ui} />}
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
          <ProgressSlots id={m.id} progress={m.progress} target={m.target} fed={m.fed} />
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
        {ui.keys.length > 0 && (
          <button className="keys-btn" aria-label={CS.ui.keys} onClick={() => game.tapKeys()}>
            {ui.keys.map((k) => (
              <span key={k} className="key-slot">
                <IconKey />
              </span>
            ))}
          </button>
        )}
        <button className="parent-btn" aria-label={CS.ui.parents} onClick={() => game.openParents()}>
          <IconGear />
        </button>
      </div>
    </div>
  );
}

/** Režim chození: velké obličeje kamarádů dole – vybrat, s kým chodit. */
function FriendBar({ game, ui }: Props) {
  return (
    <div className="palette friends" role="toolbar" aria-label="Kamarádi">
      {CHARACTER_IDS.map((id) => (
        <button
          key={id}
          className={`char-btn big ${ui.selectedCharacter === id ? 'selected' : ''} ${ui.nudgeCharacters && !ui.selectedCharacter ? 'nudge' : ''}`}
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
  );
}

/** Režim Stavitel: co stavím a kolik už je hotovo (bez časomíry). */
function TemplateBar({ game, ui }: Props) {
  const t = ui.template;
  return (
    <div className="palette template-bar">
      <button className="big-btn" aria-label={CS.ui.builder} onClick={() => game.openArchitect()}>
        <span className="tpl-emoji" aria-hidden>
          {t ? TEMPLATE_EMOJI[t.id] : '🏗️'}
        </span>
      </button>
      {t && (
        <div className="tpl-progress" aria-label={`${t.filled} z ${t.total}`}>
          <div className="tpl-fill" style={{ width: `${(100 * t.filled) / t.total}%` }} />
        </div>
      )}
    </div>
  );
}

export const TEMPLATE_EMOJI = { castle: '🏰', house: '🏠', farm: '🐄' } as const;

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
