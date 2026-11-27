import type { GameController } from '../controller/GameController';
import type { Quiz } from '../game/quiz';
import type { BlockType } from '../game/blocks';
import { CS } from '../i18n/cs';
import { iconFor } from './blockIcons';
import { IconClose, IconSpeaker } from './Icons';

interface Props {
  game: GameController;
  quiz: Quiz;
  wrong: string[];
  solved: boolean;
  help: boolean;
}

/** Tvary jako jednoduché SVG – čitelné i pro malé děti. */
function ShapeIcon({ shape }: { shape: string }) {
  const fill = { circle: '#4dabf7', square: '#69db7c', triangle: '#ffa94d', star: '#ffd43b', heart: '#ff6b81' }[shape] ?? '#adb5bd';
  const common = { fill, stroke: '#343a40', strokeWidth: 3, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
      {shape === 'circle' && <circle cx="32" cy="32" r="24" {...common} />}
      {shape === 'square' && <rect x="10" y="10" width="44" height="44" {...common} />}
      {shape === 'triangle' && <path d="M32 8 58 54H6Z" {...common} />}
      {shape === 'star' && <path d="M32 5l7.6 16.4 17.9 2-13.4 12.1 3.8 17.7L32 44.2 16.1 53.2l3.8-17.7L6.5 23.4l17.9-2Z" {...common} />}
      {shape === 'heart' && <path d="M32 56C10 40 4 28 12 17c6-8 16-6 20 2 4-8 14-10 20-2 8 11 2 23-20 39Z" {...common} />}
    </svg>
  );
}

function OptionContent({ quiz, option }: { quiz: Quiz; option: string }) {
  switch (quiz.kind) {
    case 'count':
      return <span className="quiz-number">{option}</span>;
    case 'color':
      return <img src={iconFor(option as BlockType)} alt="" className="quiz-block" />;
    case 'shape':
      return <ShapeIcon shape={option} />;
    case 'letter':
      return <span className="quiz-letter">{option}</span>;
  }
}

/** Co je nahoře v kartě: obrázky k počítání, nebo velký obrázek k písmenu. */
function QuizPicture({ quiz }: { quiz: Quiz }) {
  if (quiz.kind === 'count') {
    const emoji = CS.quiz.countEmoji[quiz.item ?? 'apple'];
    return (
      <div className="quiz-items" aria-hidden>
        {Array.from({ length: Number(quiz.answer) }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.15}s` }}>
            {emoji}
          </span>
        ))}
      </div>
    );
  }
  if (quiz.kind === 'letter') {
    return (
      <div className="quiz-items single" aria-hidden>
        <span>{CS.quiz.letterPics[quiz.answer]}</span>
      </div>
    );
  }
  if (quiz.kind === 'shape') {
    return (
      <div className="quiz-items single" aria-hidden>
        <span>🔍</span>
      </div>
    );
  }
  return (
    <div className="quiz-items single" aria-hidden>
      <span>🎨</span>
    </div>
  );
}

const optionLabel = (quiz: Quiz, o: string): string => {
  switch (quiz.kind) {
    case 'count':
      return CS.quiz.numbers[Number(o)] ?? o;
    case 'color':
      return CS.blockNames[o as BlockType];
    case 'shape':
      return CS.quiz.shapeSpoken[o] ?? o;
    case 'letter':
      return o;
  }
};

export function QuizOverlay({ game, quiz, wrong, solved, help }: Props) {
  return (
    <div className="overlay dim">
      <div className={`card quiz-card ${solved ? 'solved' : ''}`}>
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="quiz-head">
          <img className="quiz-box" src={iconFor('question')} alt="" />
          <button className="round-btn" aria-label="Zopakovat úkol" onClick={() => game.repeatQuiz()}>
            <IconSpeaker />
          </button>
        </div>
        <QuizPicture quiz={quiz} />
        <div className="quiz-options">
          {quiz.options.map((o) => {
            const isWrong = wrong.includes(o);
            const isAnswer = o === quiz.answer;
            const cls = [
              'quiz-option',
              isWrong ? 'wrong' : '',
              solved && isAnswer ? 'right' : '',
              help && !solved && isAnswer ? 'help' : '',
            ].join(' ');
            return (
              <button key={o} className={cls} aria-label={optionLabel(quiz, o)} disabled={isWrong || solved} onClick={() => game.answerQuiz(o)}>
                <OptionContent quiz={quiz} option={o} />
              </button>
            );
          })}
        </div>
        {solved && (
          <div className="quiz-stars" aria-hidden>
            ⭐⭐⭐
          </div>
        )}
      </div>
    </div>
  );
}
