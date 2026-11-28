import { useEffect, useRef, useState } from 'react';
import type { GameController } from '../controller/GameController';
import { CS } from '../i18n/cs';
import { IconClose, IconStar } from './Icons';

/** Obrázky na kartičkách (vlastní výběr – moře a piráti, bez strašidel). */
const SYMBOLS: Array<{ id: string; emoji: string }> = [
  { id: 'parrot', emoji: '🦜' },
  { id: 'anchor', emoji: '⚓' },
  { id: 'shell', emoji: '🐚' },
  { id: 'crab', emoji: '🦀' },
  { id: 'palm', emoji: '🌴' },
  { id: 'fish', emoji: '🐠' },
];
const PAIRS = 4;

interface Card {
  key: number;
  id: string;
  emoji: string;
  open: boolean;
  matched: boolean;
}

function deal(): Card[] {
  const pick = [...SYMBOLS].sort(() => Math.random() - 0.5).slice(0, PAIRS);
  const cards = [...pick, ...pick].map((s, i) => ({ key: i, id: s.id, emoji: s.emoji, open: false, matched: false }));
  return cards.sort(() => Math.random() - 0.5).map((c, i) => ({ ...c, key: i }));
}

/** Pexeso kostlivce Kostíka: najdi dvě stejné kartičky. Bez časomíry, bez počítání tahů. */
export function MemoryGame({ game }: { game: GameController }) {
  const [cards, setCards] = useState<Card[]>(deal);
  const busy = useRef(false);
  const won = cards.every((c) => c.matched);
  const reported = useRef(false);

  useEffect(() => {
    game.sayLine(CS.memory.hint);
  }, [game]);

  useEffect(() => {
    if (won && !reported.current) {
      reported.current = true;
      window.setTimeout(() => game.npcGameDone('skeleton'), 400);
    }
  }, [won, game]);

  const flip = (card: Card) => {
    if (busy.current || card.open || card.matched) return;
    game.playSfx('click');
    const open = cards.filter((c) => c.open && !c.matched);
    const next = cards.map((c) => (c.key === card.key ? { ...c, open: true } : c));
    setCards(next);
    if (open.length !== 1) return;
    const first = open[0];
    if (first.id === card.id) {
      // dvojice – zůstane otočená
      game.playSfx('collect');
      game.sayLine(`${CS.memory.names[card.id] ?? ''}! ${CS.memory.pair[Math.floor(Math.random() * CS.memory.pair.length)]}`);
      setCards(next.map((c) => (c.id === card.id ? { ...c, matched: true } : c)));
      return;
    }
    // nejsou stejné – chvíli se ukážou a zase se otočí (žádný trest)
    busy.current = true;
    game.playSfx('soft');
    window.setTimeout(() => {
      game.sayLine(CS.memory.again);
      setCards((cs) => cs.map((c) => (c.matched ? c : { ...c, open: false })));
      busy.current = false;
    }, 1100);
  };

  const again = () => {
    reported.current = false;
    game.playSfx('click');
    setCards(deal());
    game.sayLine(CS.memory.hint);
  };

  return (
    <div className="overlay dim">
      <div className="card memory-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="puzzle-head" aria-hidden>
          🦴🃏
        </div>
        <div className="memory-grid">
          {cards.map((c) => (
            <button
              key={c.key}
              className={`memory-tile ${c.open || c.matched ? 'open' : ''} ${c.matched ? 'matched' : ''}`}
              data-symbol={c.id}
              aria-label={c.open || c.matched ? CS.memory.names[c.id] : '?'}
              onClick={() => flip(c)}
            >
              <span className="memory-face">{c.open || c.matched ? c.emoji : ''}</span>
            </button>
          ))}
        </div>
        <div className="success-actions">
          <button className="go-btn secondary" aria-label={CS.sling.again} onClick={again}>
            🔄
          </button>
          {won && (
            <>
              <span className="sling-won" aria-hidden>
                <IconStar width="56" height="56" />
                <IconStar width="56" height="56" />
                <IconStar width="56" height="56" />
              </span>
              <button className="go-btn sling-done" aria-label={CS.sling.done} onClick={() => game.closeOverlay()}>
                ✔
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
