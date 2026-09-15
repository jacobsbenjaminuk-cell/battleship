import { coordinateKey, isSunk, type Board, type Coordinate, type Shot } from '../core';

export type CellMark =
  | 'empty'
  | 'ship'
  | 'ship-hit'
  | 'ship-sunk'
  | 'miss'
  | 'hit'
  | 'sunk'
  | 'preview'
  | 'preview-invalid';

export type MarkMap = ReadonlyMap<string, CellMark>;

/** What a screen reader hears for each mark, after the coordinate. */
export const MARK_LABEL: Record<CellMark, string> = {
  empty: 'open water',
  ship: 'your ship',
  'ship-hit': 'your ship, hit',
  'ship-sunk': 'your ship, sunk',
  miss: 'miss',
  hit: 'hit',
  sunk: 'sunk',
  preview: 'placement preview',
  'preview-invalid': 'placement blocked',
};

export function ownBoardMarks(board: Board): MarkMap {
  const marks = new Map<string, CellMark>();
  for (const cell of board.incoming) marks.set(coordinateKey(cell), 'miss');
  for (const ship of board.ships) {
    const sunk = isSunk(ship);
    ship.cells.forEach((cell, index) => {
      marks.set(coordinateKey(cell), sunk ? 'ship-sunk' : ship.hits[index] ? 'ship-hit' : 'ship');
    });
  }
  return marks;
}

/**
 * The attacker's view of the enemy board. Only sunk ships are read from the
 * defender's board — every other cell comes from the attacker's own shots.
 */
export function targetBoardMarks(shots: readonly Shot[], defender: Board): MarkMap {
  const marks = new Map<string, CellMark>();
  for (const shot of shots) {
    marks.set(coordinateKey(shot.at), shot.outcome.kind === 'miss' ? 'miss' : 'hit');
  }
  for (const ship of defender.ships) {
    if (!isSunk(ship)) continue;
    for (const cell of ship.cells) marks.set(coordinateKey(cell), 'sunk');
  }
  return marks;
}

export function withPreview(marks: MarkMap, cells: readonly Coordinate[], valid: boolean): MarkMap {
  const next = new Map(marks);
  for (const cell of cells) {
    next.set(coordinateKey(cell), valid ? 'preview' : 'preview-invalid');
  }
  return next;
}
