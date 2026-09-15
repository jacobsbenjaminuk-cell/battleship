/**
 * Commit and reveal for the enemy fleet.
 *
 * The layout is fixed before the first shot, so the game publishes a SHA-256 of
 * it plus a random salt up front and reveals both at the end: the same hash
 * proves the fleet never moved. This lives in the UI layer because Web Crypto
 * is a DOM API and `src/core` has to stay DOM-free.
 */
import {
  FLEET,
  formatCoordinate,
  type Board,
  type Difficulty,
  type GameState,
  type Orientation,
  type ShipId,
  type Shot,
  type Side,
} from '../core';

export const SALT_BYTES = 32;

export type ShipLayout = {
  readonly shipId: ShipId;
  readonly origin: { readonly row: number; readonly col: number };
  readonly orientation: Orientation;
  readonly cells: readonly string[];
};

export type Commitment = {
  readonly hash: string;
  readonly salt: string;
  readonly layout: readonly ShipLayout[];
  /** Exactly the string that was hashed, so anyone can recompute the digest. */
  readonly preimage: string;
};

export function fleetLayout(board: Board): ShipLayout[] {
  const order = new Map(FLEET.map((spec, index) => [spec.id, index]));
  return [...board.ships]
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((ship) => ({
      shipId: ship.id,
      origin: { row: ship.origin.row, col: ship.origin.col },
      orientation: ship.orientation,
      cells: ship.cells.map(formatCoordinate),
    }));
}

/** Canonical text form of a layout: same fleet, same string, every time. */
export function layoutPreimage(layout: readonly ShipLayout[], salt: string): string {
  const fleet = layout
    .map((ship) => `${ship.shipId}:${ship.orientation}:${ship.cells.join('-')}`)
    .join('|');
  return `battleship-v1|${salt}|${fleet}`;
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(new Uint8Array(digest));
}

export async function commitFleet(board: Board, salt: string): Promise<Commitment> {
  const layout = fleetLayout(board);
  const preimage = layoutPreimage(layout, salt);
  return { hash: await sha256Hex(preimage), salt, layout, preimage };
}

/** Recomputes the digest from the revealed layout and salt. */
export async function verifyCommitment(
  commitment: Commitment,
  revealed: readonly ShipLayout[],
): Promise<boolean> {
  return (await sha256Hex(layoutPreimage(revealed, commitment.salt))) === commitment.hash;
}

export type GameExport = {
  readonly game: 'battleship';
  readonly version: 1;
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly commitment: { readonly hash: string; readonly salt: string; readonly preimage: string };
  readonly layouts: {
    readonly player: readonly ShipLayout[];
    readonly opponent: readonly ShipLayout[];
  };
  readonly shots: {
    readonly player: readonly ExportedShot[];
    readonly opponent: readonly ExportedShot[];
  };
  readonly winner: Side | null;
};

type ExportedShot = { readonly at: string; readonly result: string };

export function exportGame(
  state: GameState,
  commitment: Commitment,
  seed: number,
  difficulty: Difficulty,
): GameExport {
  return {
    game: 'battleship',
    version: 1,
    seed,
    difficulty,
    commitment: { hash: commitment.hash, salt: commitment.salt, preimage: commitment.preimage },
    layouts: {
      player: fleetLayout(state.player.board),
      opponent: commitment.layout,
    },
    shots: {
      player: state.player.shots.map(describeShot),
      opponent: state.opponent.shots.map(describeShot),
    },
    winner: state.winner,
  };
}

function describeShot({ at, outcome }: Shot): ExportedShot {
  return {
    at: formatCoordinate(at),
    result: outcome.kind === 'sunk' ? `sunk ${outcome.shipName}` : outcome.kind,
  };
}
