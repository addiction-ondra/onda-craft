import type { MissionId } from '../game/missions';
import { iconFor } from './blockIcons';

/**
 * Názorná animovaná ukázka úkolu (smyčka). Pedagogicky: nejdřív ukázat, pak hrát.
 * Čistě CSS animace – viz styles.css (.demo-*)
 */
export function MissionDemo({ id }: { id: MissionId }) {
  if (id === 'wood5') {
    return (
      <div className="demo demo-wood" aria-hidden>
        <div className="demo-ground" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="demo-block" style={{ left: `${8 + i * 18}%`, animationDelay: `${i * 0.7}s` }}>
            <img src={iconFor('wood')} alt="" />
            <span className="demo-num" style={{ animationDelay: `${i * 0.7}s` }}>
              {i + 1}
            </span>
          </div>
        ))}
        <div className="demo-hand demo-hand-wood">👆</div>
      </div>
    );
  }
  if (id === 'findRed') {
    return (
      <div className="demo demo-red" aria-hidden>
        <div className="demo-ground" />
        {[14, 46, 78].map((left, i) => (
          <div key={i} className="demo-hidden" style={{ left: `${left}%` }}>
            <img className="demo-red-block" src={iconFor('red')} alt="" style={{ animationDelay: `${0.8 + i * 1.2}s` }} />
            <img className="demo-bush" src={iconFor('leaves')} alt="" />
            <span className="demo-sparkle" style={{ animationDelay: `${0.8 + i * 1.2}s` }}>
              ⭐
            </span>
          </div>
        ))}
        <div className="demo-hand demo-hand-red">👆</div>
      </div>
    );
  }
  return (
    <div className="demo demo-bridge" aria-hidden>
      <div className="demo-bank left" />
      <div className="demo-river" />
      <div className="demo-bank right" />
      <img className="demo-bridge-block b1" src={iconFor('wood')} alt="" />
      <img className="demo-bridge-block b2" src={iconFor('wood')} alt="" />
      <div className="demo-dog">🐶</div>
    </div>
  );
}
