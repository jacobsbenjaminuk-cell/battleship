import { describe, expect, it } from 'vitest';
import {
  allCoordinates,
  coordinateKey,
  createAI,
  createGameReducer,
  createInitialState,
  createSeededRandom,
  opponentView,
  type Coordinate,
  type GameState,
  type RandomSource,
} from '../core';
import {
  SALT_BYTES,
  commitFleet,
  exportGame,
  fleetLayout,
  layoutPreimage,
  randomSalt,
  sha256Hex,
  toHex,
  verifyCommitment,
  type Commitment,
} from './fairness';

/** A salt drawn from the seeded stream, so the whole test is reproducible. */
function seededSalt(random: RandomSource): string {
  return toHex(Uint8Array.from({ length: SALT_BYTES }, () => Math.floor(random() * 256)));
}

/**
 * Plays one seeded game to the end: the enemy fleet is committed to before the
 * first shot and revealed from the finished state, exactly as the UI does it.
 */
async function playCommittedGame(
  seed: number,
): Promise<{ readonly state: GameState; readonly commitment: Commitment }> {
  const random = createSeededRandom(seed);
  const reducer = createGameReducer(random);
  const ai = createAI('medium', random);

  let state = reducer(createInitialState(random), { type: 'randomise' });
  const commitment = await commitFleet(state.opponent.board, seededSalt(random));
  state = reducer(state, { type: 'start' });

  const targets: Coordinate[] = allCoordinates();
  let next = 0;
  while (state.phase === 'play') {
    state =
      state.turn === 'player'
        ? reducer(state, { type: 'fire', by: 'player', at: targets[next++]! })
        : reducer(state, {
            type: 'fire',
            by: 'opponent',
            at: ai.nextShot(opponentView(state, 'opponent')),
          });
  }

  return { state, commitment };
}

describe('fairness commitment', () => {
  it('matches the revealed layout and salt across 100 seeded games', async () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const { state, commitment } = await playCommittedGame(seed);
      const revealed = fleetLayout(state.opponent.board);

      expect(revealed).toEqual(commitment.layout);
      expect(await verifyCommitment(commitment, revealed)).toBe(true);
      expect(await sha256Hex(commitment.preimage)).toBe(commitment.hash);
      expect(commitment.salt).toHaveLength(SALT_BYTES * 2);
    }
  });

  it('fails verification if a single ship is moved', async () => {
    const { state, commitment } = await playCommittedGame(7);
    const revealed = fleetLayout(state.opponent.board);
    const [first, ...rest] = revealed;
    const moved = [{ ...first!, cells: [...first!.cells].reverse() }, ...rest];

    expect(await verifyCommitment(commitment, moved)).toBe(false);
  });

  it('binds the hash to the salt as well as the layout', async () => {
    const random = createSeededRandom(42);
    const board = createInitialState(random).opponent.board;
    const one = await commitFleet(board, seededSalt(random));
    const two = await commitFleet(board, seededSalt(random));

    expect(two.salt).not.toBe(one.salt);
    expect(two.hash).not.toBe(one.hash);
    expect(layoutPreimage(one.layout, one.salt)).toBe(one.preimage);
  });

  it('draws a 32-byte salt from the platform CSPRNG', () => {
    const salt = randomSalt();
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    expect(randomSalt()).not.toBe(salt);
  });

  it('exports the seed, commitment, both layouts and every shot in order', async () => {
    const { state, commitment } = await playCommittedGame(3);
    const exported = exportGame(state, commitment, 3, 'medium');

    expect(exported.seed).toBe(3);
    expect(exported.difficulty).toBe('medium');
    expect(exported.commitment).toEqual({
      hash: commitment.hash,
      salt: commitment.salt,
      preimage: commitment.preimage,
    });
    expect(exported.layouts.opponent).toEqual(fleetLayout(state.opponent.board));
    expect(exported.layouts.player).toEqual(fleetLayout(state.player.board));
    expect(exported.shots.player.map((shot) => shot.at)).toEqual(
      state.player.shots.map((shot) => shot.at).map((at) => exportedName(at)),
    );
    expect(exported.shots.opponent).toHaveLength(state.opponent.shots.length);
    expect(exported.winner).toBe(state.winner);
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
  });
});

function exportedName(at: Coordinate): string {
  const columns = 'ABCDEFGHIJ';
  return `${columns[at.col]}${at.row + 1}`;
}

it('keeps one cell key per shot in the export', async () => {
  const { state, commitment } = await playCommittedGame(11);
  const exported = exportGame(state, commitment, 11, 'hard');
  const fired = new Set(state.opponent.shots.map((shot) => coordinateKey(shot.at)));

  expect(new Set(exported.shots.opponent.map((shot) => shot.at)).size).toBe(fired.size);
});
