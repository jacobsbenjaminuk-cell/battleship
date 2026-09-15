import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  createAI,
  createGameReducer,
  createInitialState,
  createSeededRandom,
  opponentView,
  type Board,
  type Difficulty,
  type GameAction,
  type GameReducer,
  type GameState,
  type RandomSource,
} from '../core';
import {
  fleetLayout,
  layoutPreimage,
  randomSalt,
  sha256Hex,
  type Commitment,
} from './fairness';

const AI_DELAY_MS = 450;

type Engine = {
  readonly seed: number;
  readonly random: RandomSource;
  readonly reducer: GameReducer;
};

function createEngine(seed: number): Engine {
  const random = createSeededRandom(seed);
  return { seed, random, reducer: createGameReducer(random) };
}

/** Replaces the whole game, for when a restart deals from a new stream. */
type LoadAction = { readonly type: 'load'; readonly state: GameState };

/**
 * One seed drives both fleets and every AI shot, so a game can be replayed. The
 * seed is captured once rather than read per render, and a restart takes a new
 * seed with a new stream, so the seed shipped in the export always describes
 * the game it came from.
 */
export function useBattleship(initialSeed?: number) {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [engine, setEngine] = useState<Engine>(() => createEngine(initialSeed ?? Date.now()));
  const current = useRef(engine);
  current.current = engine;

  const [state, dispatch] = useReducer(
    (previous: GameState, action: GameAction | LoadAction): GameState =>
      action.type === 'load' ? action.state : current.current.reducer(previous, action),
    engine,
    ({ random }) => createInitialState(random),
  );

  const play = useCallback((action: GameAction) => {
    if (action.type !== 'reset') {
      dispatch(action);
      return;
    }
    const next = createEngine(Date.now());
    current.current = next;
    setEngine(next);
    dispatch({ type: 'load', state: createInitialState(next.random) });
  }, []);

  const ai = useMemo(() => createAI(difficulty, engine.random), [difficulty, engine]);

  useEffect(() => {
    if (state.phase !== 'play' || state.turn !== 'opponent') return;
    const view = opponentView(state, 'opponent');
    const timer = window.setTimeout(() => {
      play({ type: 'fire', by: 'opponent', at: ai.nextShot(view) });
    }, AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, ai, play]);

  const commitment = useCommitment(state.opponent.board);

  return { state, dispatch: play, difficulty, setDifficulty, seed: engine.seed, ai, commitment };
}

/**
 * Publishes a hash of the enemy fleet as soon as it exists, and a fresh one
 * whenever a new fleet is dealt. Hits change the board object but not the
 * layout, so the commitment is keyed on the layout itself and stays put for the
 * whole game; until the hash for the layout in play is ready there is no
 * commitment to show, rather than the previous game's.
 */
function useCommitment(board: Board): Commitment | null {
  const layout = useMemo(() => fleetLayout(board), [board.ships]);
  const layoutKey = useMemo(() => layoutPreimage(layout, ''), [layout]);
  const latest = useRef(layout);
  latest.current = layout;

  const [published, setPublished] = useState<{ key: string; commitment: Commitment } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fleet = latest.current;
    if (fleet.length === 0) {
      setPublished(null);
      return;
    }
    const salt = randomSalt();
    const preimage = layoutPreimage(fleet, salt);
    void sha256Hex(preimage).then((hash) => {
      if (!cancelled) {
        setPublished({ key: layoutKey, commitment: { hash, salt, layout: fleet, preimage } });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [layoutKey]);

  return published !== null && published.key === layoutKey ? published.commitment : null;
}
