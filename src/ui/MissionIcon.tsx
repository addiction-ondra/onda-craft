import type { MissionId } from '../game/missions';
import { iconFor } from './blockIcons';
import { IconBridge, IconSearch } from './Icons';

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
  return (
    <span className="mission-icon">
      <IconBridge />
    </span>
  );
}

const slotBlock = { wood5: 'wood', findRed: 'red', bridge: 'wood' } as const;

/** Políčka průběhu – plní se kostičkami, žádná čísla ani časomíra. */
export function ProgressSlots({ id, progress, target }: { id: MissionId; progress: number; target: number }) {
  return (
    <div className="slots" aria-label={`${progress} z ${target}`}>
      {Array.from({ length: target }, (_, i) => (
        <span key={i} className={`slot ${i < progress ? 'filled' : ''}`}>
          {i < progress ? <img src={iconFor(slotBlock[id])} alt="" /> : id === 'wood5' ? <small>{i + 1}</small> : null}
        </span>
      ))}
    </div>
  );
}
