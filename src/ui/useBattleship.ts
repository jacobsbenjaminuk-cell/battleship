import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  createAI,
  createGameReducer,
  createInitialState,
  createSeededRandom,
  opponentView,
  type Board,
  type Difficulty,
} from '../core';
import {
  fleetLayout,
  layoutPreimage,
  randomSalt,
  sha256Hex,
  type Commitment,
} from './fairness';

const AI_DELAY_MS = 450;

/** One seed drives both fleets and every AI shot, so a game can be replayed. */
export function useBattleship(seed: number = Date.now()) {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  const engine = useMemo(() => {
    const random = createSeededRandom(seed);
    return { random, reducer: createGameReducer(random) };
  }, [seed]);

  const ai = useMemo(() => createAI(difficulty, engine.random), [difficulty, engine]);

  const [state, dispatch] = useReducer(engine.reducer, engine, ({ random }) =>
    createInitialState(random),
  );

  useEffect(() => {
    if (state.phase !== 'play' || state.turn !== 'opponent') return;
    const view = opponentView(state, 'opponent');
    const timer = window.setTimeout(() => {
      dispatch({ type: 'fire', by: 'opponent', at: ai.nextShot(view) });
    }, AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, ai]);

  const commitment = useCommitment(state.opponent.board);

  return { state, dispatch, difficulty, setDifficulty, seed, ai, commitment };
}

/**
 * Publishes a hash of the enemy fleet as soon as it exists, and a fresh one
 * whenever a new fleet is dealt. Hits change the board object but not the
 * layout, so the commitment is keyed on the layout itself and stays put for the
 * whole game.
 */
function useCommitment(board: Board): Commitment | null {
  const layout = useMemo(() => fleetLayout(board), [board.ships]);
  const layoutKey = useMemo(() => layoutPreimage(layout, ''), [layout]);
  const latest = useRef(layout);
  latest.current = layout;

  const [commitment, setCommitment] = useState<Commitment | null>(null);

  useEffect(() => {
    let cancelled = false;
    const current = latest.current;
    if (current.length === 0) {
      setCommitment(null);
      return;
    }
    const salt = randomSalt();
    const preimage = layoutPreimage(current, salt);
    void sha256Hex(preimage).then((hash) => {
      if (!cancelled) setCommitment({ hash, salt, layout: current, preimage });
    });
    return () => {
      cancelled = true;
    };
  }, [layoutKey]);

  return commitment;
}
