import { FEED_ORDER, type MissionId } from '../game/missions';
import { iconFor } from './blockIcons';
import { IconBridge, IconSearch } from './Icons';

const ANIMAL_EMOJI = { sheep: '🐑', chick: '🐤', dog: '🐶' } as const;

/** Obrázková ikonka mise – dítě ji pozná i bez čtení. */
export function MissionIcon({ id }: { id: MissionId }) {
  if (id === 'wood5')
    return (
      <span className="mission-icon">
        <img src={iconFor('wood')} alt="" />
        <b className="badge-num">5</b>
      </span>
    );
  if (id === 'findRed')
    return (
      <span className="mission-icon">
        <img src={iconFor('red')} alt="" />
        <span className="badge-search">
          <IconSearch />
        </span>
      </span>
    );
  if (id === 'feed')
    return (
      <span className="mission-icon">
        <img src={iconFor('grass')} alt="" />
        <span className="badge-emoji">🐑</span>
      </span>
    );
  if (id === 'doghouse')
    return (
      <span className="mission-icon">
        <img src={iconFor('wood')} alt="" />
        <span className="badge-emoji">🐶</span>
      </span>
    );
  return (
    <span className="mission-icon">
      <IconBridge />
    </span>
  );
}

const slotBlock = { wood5: 'wood', findRed: 'red', bridge: 'wood', doghouse: 'wood', feed: 'grass' } as const;

/** Políčka průběhu – plní se kostičkami (u krmení zvířátky), žádná čísla ani časomíra. */
export function ProgressSlots({ id, progress, target, fed }: { id: MissionId; progress: number; target: number; fed?: string[] }) {
  return (
    <div className="slots" aria-label={`${progress} z ${target}`}>
      {Array.from({ length: target }, (_, i) => {
        const filled = i < progress;
        if (id === 'feed') {
          const animal = FEED_ORDER[i];
          const isFed = (fed ?? []).includes(animal);
          return (
            <span key={i} className={`slot emoji ${isFed ? 'filled' : ''}`}>
              {ANIMAL_EMOJI[animal]}
              {isFed && <b className="slot-heart">❤️</b>}
            </span>
          );
        }
        return (
          <span key={i} className={`slot ${filled ? 'filled' : ''}`}>
            {filled ? <img src={iconFor(slotBlock[id])} alt="" /> : id === 'wood5' ? <small>{i + 1}</small> : null}
          </span>
        );
      })}
    </div>
  );
}
