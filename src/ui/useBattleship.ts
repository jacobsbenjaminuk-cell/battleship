import { useEffect, useMemo, useReducer } from 'react';
import {
  createGameReducer,
  createInitialState,
  createRandomAI,
  createSeededRandom,
  opponentView,
} from '../core';

const AI_DELAY_MS = 450;

/** One seed drives both fleets and every AI shot, so a game can be replayed. */
export function useBattleship(seed: number = Date.now()) {
  const engine = useMemo(() => {
    const random = createSeededRandom(seed);
    return {
      random,
      reducer: createGameReducer(random),
      ai: createRandomAI(random),
    };
  }, [seed]);

  const [state, dispatch] = useReducer(engine.reducer, engine, ({ random }) =>
    createInitialState(random),
  );

  useEffect(() => {
    if (state.phase !== 'play' || state.turn !== 'opponent') return;
    const view = opponentView(state, 'opponent');
    const timer = window.setTimeout(() => {
      dispatch({ type: 'fire', by: 'opponent', at: engine.ai.nextShot(view) });
    }, AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, engine]);

  return { state, dispatch };
}
