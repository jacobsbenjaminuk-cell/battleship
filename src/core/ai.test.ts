import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, createAI, createHardAI, createMediumAI, readView } from './ai';
import { allCoordinates, coordinateKey } from './coordinates';
import { createGameReducer, createInitialState, opponentView } from './game';
import { randomBoard } from './board';
import { createSeededRandom } from './random';
import { TOTAL_SHIP_CELLS, type Coordinate, type Difficulty, type GameState, type Shot } from './index';

function view(shots: readonly Shot[]) {
  return { boardSize: 10, shots };
}

function hit(row: number, col: number): Shot {
  return { at: { row, col }, outcome: { kind: 'hit' } };
}

function miss(row: number, col: number): Shot {
  return { at: { row, col }, outcome: { kind: 'miss' } };
}

function sunk(row: number, col: number, shipId: 'destroyer' | 'cruiser'): Shot {
  return {
    at: { row, col },
    outcome: { kind: 'sunk', shipId, shipName: shipId },
  };
}

/** Plays one seeded game with the AI in the `player` seat, which moves first. */
function playAgainstRandomFleet(
  difficulty: Difficulty,
  seed: number,
): { readonly shots: number; readonly cells: readonly string[]; readonly state: GameState } {
  const random = createSeededRandom(seed);
  const reducer = createGameReducer(random);
  const ai = createAI(difficulty, random);

  let state = createInitialState(random);
  state = { ...state, player: { ...state.player, board: randomBoard(random) } };
  state = reducer(state, { type: 'start' });

  const ships = new Set(state.player.board.ships.flatMap((s) => s.cells.map(coordinateKey)));
  const sparring: Coordinate[] = [
    ...allCoordinates().filter((cell) => !ships.has(coordinateKey(cell))),
    ...allCoordinates().filter((cell) => ships.has(coordinateKey(cell))),
  ];
  let next = 0;

  while (state.phase === 'play') {
    state =
      state.turn === 'player'
        ? reducer(state, { type: 'fire', by: 'player', at: ai.nextShot(opponentView(state, 'player')) })
        : reducer(state, { type: 'fire', by: 'opponent', at: sparring[next++]! });
  }

  return {
    shots: state.player.shots.length,
    cells: state.player.shots.map((shot) => coordinateKey(shot.at)),
    state,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

describe('view reconstruction', () => {
  it('attributes the hits of a sunk ship and leaves the rest outstanding', () => {
    const knowledge = readView(
      view([miss(0, 0), hit(4, 4), hit(4, 5), sunk(4, 6, 'cruiser'), hit(9, 9)]),
    );

    expect([...knowledge.sunkCells].sort()).toEqual(['4,4', '4,5', '4,6']);
    expect(knowledge.unresolvedHits.map(coordinateKey)).toEqual(['9,9']);
    expect(knowledge.misses.has('0,0')).toBe(true);
    expect(knowledge.remainingSizes).toEqual([5, 4, 3, 2]);
  });

  it('separates a sunk ship from an adjacent ship on the other axis', () => {
    const knowledge = readView(view([hit(2, 2), hit(3, 2), sunk(1, 2, 'cruiser'), hit(2, 3)]));

    expect([...knowledge.sunkCells].sort()).toEqual(['1,2', '2,2', '3,2']);
    expect(knowledge.unresolvedHits.map(coordinateKey)).toEqual(['2,3']);
  });
});

describe('every difficulty', () => {
  it.each(DIFFICULTIES)('%s never fires at the same cell twice', (difficulty) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const game = playAgainstRandomFleet(difficulty, seed);
      expect(new Set(game.cells).size).toBe(game.cells.length);
      expect(game.state.winner).toBe('player');
      expect(game.shots).toBeLessThanOrEqual(100);
      expect(
        game.state.player.shots.filter((shot) => shot.outcome.kind !== 'miss'),
      ).toHaveLength(TOTAL_SHIP_CELLS);
    }
  });

  it.each(DIFFICULTIES)('%s replays identically from the same seed', (difficulty) => {
    expect(playAgainstRandomFleet(difficulty, 99).cells).toEqual(
      playAgainstRandomFleet(difficulty, 99).cells,
    );
  });
});

describe('medium', () => {
  it('hunts on the parity of the smallest ship afloat', () => {
    const ai = createMediumAI(createSeededRandom(5));
    for (let turn = 0; turn < 20; turn += 1) {
      const shots: Shot[] = Array.from({ length: turn }, (_, index) =>
        miss(Math.floor(index / 10), index % 10),
      );
      const at = ai.nextShot(view(shots));
      expect((at.row + at.col) % 2).toBe(0);
    }
  });

  it('follows up a lone hit on one of its four neighbours', () => {
    const ai = createMediumAI(createSeededRandom(11));
    const at = ai.nextShot(view([hit(5, 5)]));
    expect(Math.abs(at.row - 5) + Math.abs(at.col - 5)).toBe(1);
  });

  it('extends along the axis two collinear hits imply', () => {
    const ai = createMediumAI(createSeededRandom(3));
    const at = ai.nextShot(view([hit(5, 5), hit(5, 6)]));
    expect(at.row).toBe(5);
    expect([4, 7]).toContain(at.col);
  });
});

describe('hard', () => {
  it('opens in the middle, where most placements overlap', () => {
    const at = createHardAI(createSeededRandom(1)).nextShot(view([]));
    expect(at.row).toBeGreaterThanOrEqual(3);
    expect(at.row).toBeLessThanOrEqual(6);
    expect(at.col).toBeGreaterThanOrEqual(3);
    expect(at.col).toBeLessThanOrEqual(6);
  });

  it('fires next to an outstanding hit rather than anywhere else', () => {
    const at = createHardAI(createSeededRandom(2)).nextShot(view([miss(0, 0), hit(5, 5)]));
    expect(Math.abs(at.row - 5) + Math.abs(at.col - 5)).toBe(1);
  });

  it('falls back to the medium search instead of throwing when nothing fits', () => {
    // Every cell a surviving ship could occupy has been missed, so no legal
    // placement is left; the AI still has to name an unfired cell.
    const shots = allCoordinates()
      .filter((cell) => !(cell.row === 9 && cell.col === 9))
      .map((cell) => miss(cell.row, cell.col));
    const at = createHardAI(createSeededRandom(4)).nextShot(view(shots));
    expect(at).toEqual({ row: 9, col: 9 });
  });
});

describe('difficulty ordering', () => {
  it('needs fewer shots as the difficulty rises', () => {
    const seeds = Array.from({ length: 60 }, (_, index) => 500 + index);
    const medians = DIFFICULTIES.map((difficulty) =>
      median(seeds.map((seed) => playAgainstRandomFleet(difficulty, seed).shots)),
    );

    expect(medians[2]!).toBeLessThan(medians[1]!);
    expect(medians[1]!).toBeLessThan(medians[0]!);
  });
});
