import {
  formatCoordinate,
  sameCoordinate,
  type Board,
  type GameState,
  type Orientation,
  type Ship,
  type Shot,
} from '../core';

function shipAt(board: Board, shot: Shot): Ship | undefined {
  return board.ships.find((ship) => ship.cells.some((cell) => sameCoordinate(cell, shot.at)));
}

function span(ship: Ship): string {
  const first = ship.cells[0];
  const last = ship.cells[ship.cells.length - 1];
  if (!first || !last) return '';
  return `${formatCoordinate(first)} to ${formatCoordinate(last)}`;
}

function orientationWord(orientation: Orientation): string {
  return orientation === 'horizontal' ? 'across' : 'down';
}

function playerShot(shot: Shot): string {
  const cell = formatCoordinate(shot.at);
  switch (shot.outcome.kind) {
    case 'miss':
      return `You fired at ${cell}. Miss.`;
    case 'hit':
      return `You fired at ${cell}. Hit.`;
    case 'sunk':
      return `You fired at ${cell}. Hit, and you sank the enemy ${shot.outcome.shipName}.`;
  }
}

function enemyShot(shot: Shot, board: Board): string {
  const cell = formatCoordinate(shot.at);
  const ship = shipAt(board, shot);
  switch (shot.outcome.kind) {
    case 'miss':
      return `Enemy fired at ${cell}. Miss.`;
    case 'hit':
      return `Enemy fired at ${cell}. Your ${ship?.name ?? 'ship'} is hit.`;
    case 'sunk':
      return `Enemy fired at ${cell}. Your ${shot.outcome.shipName} is sunk.`;
  }
}

function ending(state: GameState): string {
  return state.winner === 'player'
    ? 'Battle over. You destroyed the enemy fleet.'
    : 'Battle over. Your fleet was destroyed.';
}

/**
 * The sentence a screen reader should speak after `previous` became `next`, or
 * null when nothing worth announcing happened. Every shot, every sinking and
 * every turn change is covered so the game can be followed without the board.
 */
export function announce(previous: GameState, next: GameState): string | null {
  if (previous === next) return null;

  if (next.phase === 'placement') {
    if (previous.phase !== 'placement') return 'New game. Place your fleet.';
    const changed = next.player.board.ships.filter(
      (ship) => !previous.player.board.ships.some((old) => old.id === ship.id && span(old) === span(ship)),
    );
    if (changed.length > 1) {
      return `Fleet randomised: ${changed
        .map((ship) => `${ship.name} ${orientationWord(ship.orientation)} from ${span(ship)}`)
        .join(', ')}.`;
    }
    const added = changed[0];
    if (added) {
      return `${added.name} placed ${orientationWord(added.orientation)} from ${span(added)}.`;
    }
    if (previous.player.board.ships.length > 0 && next.player.board.ships.length === 0) {
      return 'Board cleared.';
    }
    return next.message;
  }

  if (previous.phase === 'placement') {
    return 'Battle started. Your turn: move with the arrow keys and press Enter to fire.';
  }

  const parts: string[] = [];
  const yours = next.player.shots[next.player.shots.length - 1];
  if (yours && next.player.shots.length > previous.player.shots.length) {
    parts.push(playerShot(yours));
  }
  const theirs = next.opponent.shots[next.opponent.shots.length - 1];
  if (theirs && next.opponent.shots.length > previous.opponent.shots.length) {
    parts.push(enemyShot(theirs, next.player.board));
  }

  // No shot landed, so the reducer rejected something; repeat the reason even
  // if it is the same sentence as last time.
  if (parts.length === 0) return next.message;

  if (next.phase === 'gameover') {
    parts.push(ending(next));
  } else if (next.turn === 'player') {
    parts.push('Your turn.');
  }
  return parts.join(' ');
}
