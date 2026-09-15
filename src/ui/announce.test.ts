import { describe, expect, it } from 'vitest';
import {
  createGameReducer,
  createInitialState,
  createSeededRandom,
  type Coordinate,
  type GameState,
} from '../core';
import { announce } from './announce';
import { targetBoardMarks } from './marks';

function readyToPlay(seed: number): { state: GameState; reducer: ReturnType<typeof createGameReducer> } {
  const random = createSeededRandom(seed);
  const reducer = createGameReducer(random);
  const state = reducer(reducer(createInitialState(random), { type: 'randomise' }), { type: 'start' });
  return { state, reducer };
}

describe('announce', () => {
  it('narrates placement, the start of battle and a reset', () => {
    const random = createSeededRandom(1);
    const reducer = createGameReducer(random);
    const empty = createInitialState(random);
    const placed = reducer(empty, {
      type: 'place',
      shipId: 'carrier',
      origin: { row: 0, col: 0 },
      orientation: 'horizontal',
    });
    expect(announce(empty, placed)).toBe('Carrier placed across from A1 to E1.');

    const blocked = reducer(placed, {
      type: 'place',
      shipId: 'cruiser',
      origin: { row: 0, col: 8 },
      orientation: 'horizontal',
    });
    expect(announce(placed, blocked)).toBe('That ship does not fit on the board.');

    const cleared = reducer(placed, { type: 'clear' });
    expect(announce(placed, cleared)).toBe('Board cleared.');

    const full = reducer(cleared, { type: 'randomise' });
    expect(announce(cleared, full)).toMatch(/^Fleet randomised: Carrier (across|down) from [A-J]\d+ to [A-J]\d+, Battleship/);
    const started = reducer(full, { type: 'start' });
    expect(announce(full, started)).toMatch(/^Battle started\. Your turn/);
    expect(announce(started, reducer(started, { type: 'reset' }))).toBe('New game. Place your fleet.');
  });

  it('narrates every shot, names sunk ships and the turn that follows', () => {
    const { state, reducer } = readyToPlay(5);
    const enemyShip = state.opponent.board.ships[0]!;
    const ownShip = state.player.board.ships[4]!;

    let current = state;
    for (const [index, cell] of enemyShip.cells.entries()) {
      const after = reducer(current, { type: 'fire', by: 'player', at: cell });
      const said = announce(current, after);
      expect(said).toContain('You fired at');
      if (index === enemyShip.cells.length - 1) {
        expect(said).toContain(`you sank the enemy ${enemyShip.name}`);
        expect(targetBoardMarks(after.player.shots, after.opponent.board).get(`${cell.row},${cell.col}`)).toBe('sunk');
      } else {
        expect(said).toMatch(/Hit\.$/);
      }
      current = after;

      const enemyAt: Coordinate = ownShip.cells[index] ?? nextFree(current);
      const replied = reducer(current, { type: 'fire', by: 'opponent', at: enemyAt });
      const heard = announce(current, replied);
      expect(heard).toContain('Enemy fired at');
      expect(heard).toMatch(/Your turn\.$/);
      if (index === 0) expect(heard).toContain(`Your ${ownShip.name} is hit`);
      if (index === ownShip.size - 1) expect(heard).toContain(`Your ${ownShip.name} is sunk`);
      current = replied;
    }
  });

  it('repeats a rejected shot and announces the end of the battle', () => {
    const { state, reducer } = readyToPlay(9);
    const target = state.opponent.board.ships[0]!.cells[0]!;
    const once = reducer(state, { type: 'fire', by: 'player', at: target });
    const back = reducer(once, { type: 'fire', by: 'opponent', at: { row: 0, col: 0 } });
    const again = reducer(back, { type: 'fire', by: 'player', at: target });
    expect(announce(back, again)).toMatch(/^[A-J]\d+ has already been fired at\.$/);

    let current = state;
    for (const ship of state.opponent.board.ships) {
      for (const cell of ship.cells) {
        const next = reducer(current, { type: 'fire', by: 'player', at: cell });
        if (next.phase === 'gameover') {
          expect(announce(current, next)).toMatch(/You destroyed the enemy fleet\.$/);
          return;
        }
        current = reducer(next, { type: 'fire', by: 'opponent', at: nextFree(next) });
      }
    }
    throw new Error('game never ended');
  });
});

function nextFree(state: GameState): Coordinate {
  const fired = new Set(state.player.board.incoming.map((c) => `${c.row},${c.col}`));
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (!fired.has(`${row},${col}`)) return { row, col };
    }
  }
  throw new Error('board full');
}
