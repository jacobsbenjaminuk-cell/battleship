import { describe, expect, it } from 'vitest';
import { createRandomAI } from './ai';
import { allCoordinates, coordinateKey } from './coordinates';
import { createGameReducer, createInitialState, opponentView } from './game';
import { createSeededRandom } from './random';
import type { Coordinate, GameState } from './types';

/**
 * Plays a whole game from one seed: both fleets and every AI shot draw from the
 * same stream, and the player fires cells in a fixed order.
 */
function playSeededGame(seed: number): {
  readonly state: GameState;
  readonly playerCells: readonly string[];
  readonly aiCells: readonly string[];
} {
  const random = createSeededRandom(seed);
  const reducer = createGameReducer(random);
  const ai = createRandomAI(random);

  let state = reducer(createInitialState(random), { type: 'randomise' });
  state = reducer(state, { type: 'start' });

  const targets: Coordinate[] = allCoordinates();
  let next = 0;
  while (state.phase === 'play') {
    if (state.turn === 'player') {
      state = reducer(state, { type: 'fire', by: 'player', at: targets[next++]! });
    } else {
      const at = ai.nextShot(opponentView(state, 'opponent'));
      state = reducer(state, { type: 'fire', by: 'opponent', at });
    }
  }

  return {
    state,
    playerCells: state.player.shots.map((shot) => coordinateKey(shot.at)),
    aiCells: state.opponent.shots.map((shot) => coordinateKey(shot.at)),
  };
}

function fleetKeys(state: GameState, side: 'player' | 'opponent'): string[] {
  return state[side].board.ships.flatMap((ship) => ship.cells.map(coordinateKey));
}

describe('seeded games', () => {
  it('replays the same boards and the same shot sequence from one seed', () => {
    const first = playSeededGame(20260915);
    const second = playSeededGame(20260915);

    expect(fleetKeys(second.state, 'player')).toEqual(fleetKeys(first.state, 'player'));
    expect(fleetKeys(second.state, 'opponent')).toEqual(fleetKeys(first.state, 'opponent'));
    expect(second.aiCells).toEqual(first.aiCells);
    expect(second.playerCells).toEqual(first.playerCells);
    expect(second.state.winner).toBe(first.state.winner);
  });

  it('gives different games to different seeds', () => {
    const a = playSeededGame(1);
    const b = playSeededGame(2);
    expect(b.aiCells).not.toEqual(a.aiCells);
  });

  it('keeps randomise and reset on the injected source rather than Math.random', () => {
    const reducer = createGameReducer(createSeededRandom(7));
    const again = createGameReducer(createSeededRandom(7));

    const randomised = reducer(createInitialState(createSeededRandom(7)), { type: 'randomise' });
    const randomisedAgain = again(createInitialState(createSeededRandom(7)), { type: 'randomise' });
    expect(fleetKeys(randomisedAgain, 'player')).toEqual(fleetKeys(randomised, 'player'));

    const reset = reducer(randomised, { type: 'reset' });
    const resetAgain = again(randomisedAgain, { type: 'reset' });
    expect(fleetKeys(resetAgain, 'opponent')).toEqual(fleetKeys(reset, 'opponent'));
  });
});
