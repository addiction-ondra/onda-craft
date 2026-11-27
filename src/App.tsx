import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GameController } from './controller/GameController';
import { Hud } from './ui/Hud';
import { BreakOverlay, MissionIntro, MissionMenu, StartScreen, Success } from './ui/Overlays';
import { ParentZone } from './ui/ParentZone';
import { QuizOverlay } from './ui/QuizOverlay';

export default function App() {
  const [game] = useState(() => new GameController());
  const ui = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (host.current) game.mount(host.current);
    return () => game.unmount();
  }, [game]);

  const o = ui.overlay;
  return (
    <div className="app">
      <div ref={host} className="canvas-host" />
      {ui.started && <Hud game={game} ui={ui} />}
      {o?.kind === 'missions' && <MissionMenu game={game} ui={ui} />}
      {o?.kind === 'intro' && <MissionIntro game={game} id={o.mission} />}
      {o?.kind === 'success' && <Success game={game} ui={ui} id={o.mission} />}
      {o?.kind === 'parents' && <ParentZone game={game} ui={ui} />}
      {o?.kind === 'break' && <BreakOverlay game={game} />}
      {o?.kind === 'quiz' && <QuizOverlay game={game} quiz={o.quiz} wrong={o.wrong} solved={o.solved} help={o.help} />}
      {!ui.started && <StartScreen game={game} />}
    </div>
  );
}
