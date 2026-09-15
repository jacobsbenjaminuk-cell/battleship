import { useCallback, useState } from 'react';
import type { GameAction } from './core';
import { Announcer } from './ui/Announcer';
import { FairnessNote } from './ui/Fairness';
import { GameOver } from './ui/GameOver';
import { PlacementPhase } from './ui/PlacementPhase';
import { PlayPhase } from './ui/PlayPhase';
import { useBattleship } from './ui/useBattleship';

export default function App() {
  const { state, dispatch, difficulty, setDifficulty, seed, commitment } = useBattleship();
  const [round, setRound] = useState(0);
  const act = useCallback(
    (action: GameAction) => {
      if (action.type === 'reset') setRound((current) => current + 1);
      dispatch(action);
    },
    [dispatch],
  );

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-sm tracking-[0.35em] uppercase">Battleship</h1>
        <span className="text-xs text-muted">10 × 10 · fleet 5 4 3 3 2</span>
      </header>
      <Announcer state={state} />

      {state.phase === 'gameover' && (
        <GameOver
          state={state}
          dispatch={act}
          commitment={commitment}
          seed={seed}
          difficulty={difficulty}
        />
      )}
      {state.phase === 'placement' ? (
        <PlacementPhase
          key={round}
          state={state}
          dispatch={act}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          autoFocus={round > 0}
        />
      ) : (
        <PlayPhase state={state} dispatch={dispatch} />
      )}

      {state.phase !== 'gameover' && <FairnessNote commitment={commitment} />}
    </main>
  );
}
