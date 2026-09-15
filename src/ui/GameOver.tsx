import { DIFFICULTY_LABELS, type Difficulty, type GameAction, type GameState } from '../core';
import { FairnessReveal } from './Fairness';
import type { Commitment } from './fairness';

type GameOverProps = {
  readonly state: GameState;
  readonly dispatch: (action: GameAction) => void;
  readonly commitment: Commitment | null;
  readonly seed: number;
  readonly difficulty: Difficulty;
};

export function GameOver({ state, dispatch, commitment, seed, difficulty }: GameOverProps) {
  const won = state.winner === 'player';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 bg-panel px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className={`text-sm tracking-[0.25em] uppercase ${won ? 'text-ember-bright' : 'text-steel'}`}>
            {won ? 'Enemy fleet destroyed' : 'Your fleet destroyed'}
          </span>
          <span className="text-xs text-muted">
            {state.player.shots.length} shots fired · {state.opponent.shots.length} taken ·{' '}
            {DIFFICULTY_LABELS[difficulty]} enemy
          </span>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'reset' })}
          className="bg-ember px-4 py-3 text-sm tracking-[0.15em] uppercase transition-colors duration-[120ms] ease-out hover:bg-ember-bright"
        >
          Play again
        </button>
      </div>

      <FairnessReveal
        commitment={commitment}
        state={state}
        seed={seed}
        difficulty={difficulty}
      />
    </div>
  );
}
