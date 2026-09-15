import { allCoordinates, coordinateKey, isOnBoard, sameCoordinate } from './coordinates';
import type { RandomSource } from './random';
import {
  FLEET,
  type AI,
  type Coordinate,
  type OpponentView,
  type Orientation,
  type ShipId,
} from './types';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const DIFFICULTY_BLURBS: Readonly<Record<Difficulty, string>> = {
  easy: 'Fires at random.',
  medium: 'Parity search, then hunts down every hit.',
  hard: 'Scores every placement still possible and fires at the likeliest cell.',
};

type Axis = { readonly dRow: number; readonly dCol: number };

const AXES: readonly Axis[] = [
  { dRow: 0, dCol: 1 },
  { dRow: 1, dCol: 0 },
];

const NEIGHBOURS: readonly Axis[] = [
  { dRow: -1, dCol: 0 },
  { dRow: 1, dCol: 0 },
  { dRow: 0, dCol: -1 },
  { dRow: 0, dCol: 1 },
];

/** How much more a placement counts for each unresolved hit it would explain. */
const HIT_WEIGHT = 16;
/** Nudge towards cells touching a hit whose ship is still afloat. */
const ADJACENT_BONUS = 1.5;

/**
 * Everything the AIs deduce from `view.shots` alone: which cells are spent,
 * which hits belong to ships already sunk, and which ships are still afloat.
 */
export type Knowledge = {
  readonly fired: ReadonlySet<string>;
  readonly misses: ReadonlySet<string>;
  /** Hits attributed to ships that have been sunk; nothing else can sit there. */
  readonly sunkCells: ReadonlySet<string>;
  /** Hits on ships that are still afloat, in the order they were scored. */
  readonly unresolvedHits: readonly Coordinate[];
  readonly remainingSizes: readonly number[];
};

export function readView(view: OpponentView): Knowledge {
  const fired = new Set<string>();
  const misses = new Set<string>();
  const sunkCells = new Set<string>();
  const sunkIds = new Set<ShipId>();
  let pending: Coordinate[] = [];

  for (const shot of view.shots) {
    fired.add(coordinateKey(shot.at));
    if (shot.outcome.kind === 'miss') {
      misses.add(coordinateKey(shot.at));
      continue;
    }
    pending = [...pending, shot.at];
    const { outcome } = shot;
    if (outcome.kind === 'sunk') {
      sunkIds.add(outcome.shipId);
      const size = FLEET.find((spec) => spec.id === outcome.shipId)?.size ?? 1;
      const hull = carveHull(pending, shot.at, size);
      const hullKeys = new Set(hull.map(coordinateKey));
      for (const key of hullKeys) sunkCells.add(key);
      pending = pending.filter((cell) => !hullKeys.has(coordinateKey(cell)));
    }
  }

  return {
    fired,
    misses,
    sunkCells,
    unresolvedHits: pending,
    remainingSizes: FLEET.filter((spec) => !sunkIds.has(spec.id)).map((spec) => spec.size),
  };
}

/**
 * Which of the outstanding hits the ship that just sank was made of. Several
 * runs of hits through `at` can hold the ship — two ships lying end to end look
 * like one long run — so only the cells every candidate agrees on are called
 * sunk. The rest stay outstanding: a wrongly retired cell would tell the AI a
 * live ship's hull is dead ground and stop it finishing that ship off.
 */
function carveHull(pending: readonly Coordinate[], at: Coordinate, size: number): Coordinate[] {
  const hits = new Set(pending.map(coordinateKey));
  const candidates: Coordinate[][] = [];

  for (const axis of AXES) {
    const run = [at, ...walk(hits, at, axis, 1), ...walk(hits, at, axis, -1)].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    );
    if (run.length < size) continue;
    const index = run.findIndex((cell) => sameCoordinate(cell, at));
    const first = Math.max(0, index - size + 1);
    const last = Math.min(index, run.length - size);
    for (let start = first; start <= last; start += 1) {
      candidates.push(run.slice(start, start + size));
    }
  }

  if (candidates.length === 0) return [at];
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const cell of candidate) {
      counts.set(coordinateKey(cell), (counts.get(coordinateKey(cell)) ?? 0) + 1);
    }
  }
  return candidates[0]!.filter((cell) => counts.get(coordinateKey(cell)) === candidates.length);
}

function walk(
  hits: ReadonlySet<string>,
  from: Coordinate,
  axis: Axis,
  sign: number,
): Coordinate[] {
  const found: Coordinate[] = [];
  for (let step = 1; ; step += 1) {
    const cell = { row: from.row + axis.dRow * sign * step, col: from.col + axis.dCol * sign * step };
    if (!isOnBoard(cell) || !hits.has(coordinateKey(cell))) return found;
    found.push(cell);
  }
}

function unfiredCells(view: OpponentView, knowledge: Knowledge): Coordinate[] {
  return allCoordinates().filter(
    (cell) =>
      cell.row < view.boardSize &&
      cell.col < view.boardSize &&
      !knowledge.fired.has(coordinateKey(cell)),
  );
}

function pick(cells: readonly Coordinate[], random: RandomSource): Coordinate {
  const index = Math.min(cells.length - 1, Math.floor(random() * cells.length));
  return cells[index]!;
}

/**
 * Fires uniformly at random among cells this AI has not fired at yet. It only
 * ever reads `view`, which carries no ship positions.
 */
export function createRandomAI(random: RandomSource): AI {
  return {
    name: 'Easy',
    nextShot(view: OpponentView): Coordinate {
      const available = unfiredCells(view, readView(view));
      if (available.length === 0) throw new Error('No cells left to fire at');
      return pick(available, random);
    },
  };
}

/**
 * Hunt and target. While no hit is outstanding it sweeps a parity lattice whose
 * stride is the length of the smallest ship still afloat, so it cannot step over
 * that ship; once something is hit it works outwards, preferring the axis two
 * collinear hits already imply.
 */
export function createMediumAI(random: RandomSource): AI {
  return {
    name: 'Medium',
    nextShot(view: OpponentView): Coordinate {
      return mediumShot(view, readView(view), random);
    },
  };
}

function mediumShot(view: OpponentView, knowledge: Knowledge, random: RandomSource): Coordinate {
  const available = unfiredCells(view, knowledge);
  if (available.length === 0) throw new Error('No cells left to fire at');

  const targets = targetCandidates(knowledge, available);
  if (targets.length > 0) return pick(targets, random);

  const stride = Math.max(2, Math.min(...knowledge.remainingSizes));
  const parity = available.filter((cell) => (cell.row + cell.col) % stride === 0);
  return pick(parity.length > 0 ? parity : available, random);
}

/**
 * Cells worth firing at given the hits still outstanding: the ends of any run of
 * collinear hits if there is one, otherwise the neighbours of a lone hit.
 */
function targetCandidates(
  knowledge: Knowledge,
  available: readonly Coordinate[],
): Coordinate[] {
  if (knowledge.unresolvedHits.length === 0) return [];
  const open = new Set(available.map(coordinateKey));
  const hits = new Set(knowledge.unresolvedHits.map(coordinateKey));

  const ends: Coordinate[] = [];
  for (const hit of knowledge.unresolvedHits) {
    for (const axis of AXES) {
      if (!hits.has(coordinateKey({ row: hit.row + axis.dRow, col: hit.col + axis.dCol }))) continue;
      for (const sign of [1, -1]) {
        const run = walk(hits, hit, axis, sign);
        const last = run[run.length - 1] ?? hit;
        ends.push({ row: last.row + axis.dRow * sign, col: last.col + axis.dCol * sign });
      }
    }
  }

  const collinear = keepOpen(ends, open);
  if (collinear.length > 0) return collinear;

  return keepOpen(
    knowledge.unresolvedHits.flatMap((hit) =>
      NEIGHBOURS.map((axis) => ({ row: hit.row + axis.dRow, col: hit.col + axis.dCol })),
    ),
    open,
  );
}

function keepOpen(cells: readonly Coordinate[], open: ReadonlySet<string>): Coordinate[] {
  const seen = new Set<string>();
  return cells.filter((cell) => {
    const key = coordinateKey(cell);
    if (!open.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Probability density. Every legal placement of every ship still afloat is
 * enumerated against the misses, hits and sunk hulls read out of `view.shots`;
 * each one votes for the unfired cells it would occupy, placements that explain
 * an outstanding hit vote much harder, and the AI fires at the winning cell.
 */
export function createHardAI(random: RandomSource): AI {
  return {
    name: 'Hard',
    nextShot(view: OpponentView): Coordinate {
      const knowledge = readView(view);
      return densityShot(view, knowledge, random) ?? mediumShot(view, knowledge, random);
    },
  };
}

function densityShot(
  view: OpponentView,
  knowledge: Knowledge,
  random: RandomSource,
): Coordinate | null {
  const size = view.boardSize;
  const density = new Float64Array(size * size);
  const hits = new Set(knowledge.unresolvedHits.map(coordinateKey));

  for (const shipSize of knowledge.remainingSizes) {
    for (const placement of placements(size, shipSize)) {
      if (!isConsistent(placement, knowledge)) continue;
      let covered = 0;
      for (const cell of placement) if (hits.has(coordinateKey(cell))) covered += 1;
      const weight = HIT_WEIGHT ** covered;
      for (const cell of placement) {
        if (knowledge.fired.has(coordinateKey(cell))) continue;
        const index = cell.row * size + cell.col;
        density[index] = (density[index] ?? 0) + weight;
      }
    }
  }

  for (const hit of knowledge.unresolvedHits) {
    for (const axis of NEIGHBOURS) {
      const cell = { row: hit.row + axis.dRow, col: hit.col + axis.dCol };
      if (!isOnBoard(cell) || knowledge.fired.has(coordinateKey(cell))) continue;
      const index = cell.row * size + cell.col;
      density[index] = (density[index] ?? 0) * ADJACENT_BONUS;
    }
  }

  let best: Coordinate[] = [];
  let bestScore = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const score = density[row * size + col]!;
      if (score <= 0) continue;
      if (score > bestScore) {
        bestScore = score;
        best = [{ row, col }];
      } else if (score === bestScore) {
        best.push({ row, col });
      }
    }
  }

  return best.length > 0 ? pick(best, random) : null;
}

/** A placement is possible only if it avoids every miss and every sunk hull. */
function isConsistent(placement: readonly Coordinate[], knowledge: Knowledge): boolean {
  return placement.every((cell) => {
    const key = coordinateKey(cell);
    return !knowledge.misses.has(key) && !knowledge.sunkCells.has(key);
  });
}

const placementCache = new Map<string, readonly (readonly Coordinate[])[]>();

/** Every on-board position of a ship of `shipSize`, computed once per board. */
function placements(boardSize: number, shipSize: number): readonly (readonly Coordinate[])[] {
  const cacheKey = `${boardSize}:${shipSize}`;
  const cached = placementCache.get(cacheKey);
  if (cached) return cached;

  const all: Coordinate[][] = [];
  const orientations: readonly Orientation[] = ['horizontal', 'vertical'];
  for (const orientation of orientations) {
    const rows = orientation === 'vertical' ? boardSize - shipSize + 1 : boardSize;
    const cols = orientation === 'horizontal' ? boardSize - shipSize + 1 : boardSize;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cells: Coordinate[] = [];
        for (let step = 0; step < shipSize; step += 1) {
          cells.push(
            orientation === 'horizontal'
              ? { row, col: col + step }
              : { row: row + step, col },
          );
        }
        all.push(cells);
      }
    }
  }

  placementCache.set(cacheKey, all);
  return all;
}

export function createAI(difficulty: Difficulty, random: RandomSource): AI {
  if (difficulty === 'easy') return createRandomAI(random);
  if (difficulty === 'medium') return createMediumAI(random);
  return createHardAI(random);
}
