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
  if (id === 'feed') {
    // ovečka s bublinou trávy → ruka vybere trávu → ťukne na ovečku → srdíčko
    return (
      <div className="demo demo-feed" aria-hidden>
        <div className="demo-ground" />
        <div className="demo-sheep">🐑</div>
        <div className="demo-bubble">
          <img src={iconFor('grass')} alt="" />
        </div>
        <div className="demo-heart">❤️</div>
        <img className="demo-food-pick" src={iconFor('grass')} alt="" />
        <div className="demo-hand demo-hand-feed">👆</div>
      </div>
    );
  }
  if (id === 'doghouse') {
    // svítící místa se postupně zaplní kostkami, pak Frený vleze dovnitř
    return (
      <div className="demo demo-doghouse" aria-hidden>
        <div className="demo-ground" />
        <div className="demo-hut">
          {['wall-l', 'wall-r', 'roof'].map((k, i) => (
            <img key={k} className={`demo-hut-part ${k}`} src={iconFor('wood')} alt="" style={{ animationDelay: `${0.6 + i * 0.8}s` }} />
          ))}
        </div>
        <div className="demo-dog demo-dog-home">🐶</div>
      </div>
    );
  }
  if (id === 'snowman' || id === 'tower5') {
    // kostky se staví na sebe a čísla se rozsvěcují
    const n = id === 'snowman' ? 3 : 5;
    const block = id === 'snowman' ? 'snow' : 'ice';
    return (
      <div className="demo demo-stack" aria-hidden>
        <div className="demo-ground snow" />
        <div className="demo-column">
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="demo-stack-item" style={{ animationDelay: `${0.4 + i * 0.7}s` }}>
              <img src={iconFor(block)} alt="" />
              <span className="demo-num side">{i + 1}</span>
            </div>
          ))}
        </div>
        {id === 'snowman' && <div className="demo-dog demo-snowfriend">⛄</div>}
      </div>
    );
  }
  if (id === 'pattern') {
    const row = ['ice', 'wood', 'ice', 'wood', 'ice', 'wood'] as const;
    return (
      <div className="demo demo-pattern" aria-hidden>
        <div className="demo-ground snow" />
        {row.map((b, i) => (
          <div key={i} className={`demo-pattern-item ${i >= 3 ? 'todo' : ''}`} style={{ left: `${4 + i * 16}%`, animationDelay: `${1 + (i - 3) * 0.9}s` }}>
            <img src={iconFor(b)} alt="" />
            {i >= 3 && <span className="demo-q">?</span>}
          </div>
        ))}
      </div>
    );
  }
  if (id === 'crystals') {
    return (
      <div className="demo demo-red" aria-hidden>
        <div className="demo-ground snow" />
        {[14, 46, 78].map((left, i) => (
          <div key={i} className="demo-hidden" style={{ left: `${left}%` }}>
            <img className="demo-red-block" src={iconFor('crystal')} alt="" style={{ animationDelay: `${0.8 + i * 1.2}s` }} />
            <img className="demo-bush" src={iconFor('snow')} alt="" />
            <span className="demo-sparkle" style={{ animationDelay: `${0.8 + i * 1.2}s` }}>
              ✨
            </span>
          </div>
        ))}
        <div className="demo-hand demo-hand-red">👆</div>
      </div>
    );
  }
  if (id === 'numbers') {
    const nums = [3, 1, 5, 2, 4];
    return (
      <div className="demo demo-numbers" aria-hidden>
        <div className="demo-ground snow" />
        {nums.map((n, i) => (
          <div key={i} className="demo-ball" style={{ left: `${6 + i * 18}%` }}>
            <img src={iconFor('snow')} alt="" />
            <span className="demo-ball-num" style={{ animationDelay: `${0.5 + (n - 1) * 0.8}s` }}>
              {n}
            </span>
          </div>
        ))}
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
