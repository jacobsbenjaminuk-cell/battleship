import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  BOARD_SIZE,
  COLUMN_LETTERS,
  coordinateKey,
  formatCoordinate,
  isOnBoard,
  type Coordinate,
} from '../core';
import { MARK_LABEL, type CellMark, type MarkMap } from './marks';

const MARK_CLASS: Record<CellMark, string> = {
  empty: 'bg-sea',
  ship: 'bg-steel',
  'ship-hit': 'bg-ember',
  'ship-sunk': 'bg-ember-bright',
  miss: 'bg-sea text-miss-mark',
  hit: 'bg-ember',
  sunk: 'bg-ember-bright',
  preview: 'bg-steel/70',
  'preview-invalid': 'bg-ember/40',
};

type GridProps = {
  readonly title: string;
  readonly marks: MarkMap;
  readonly active?: boolean;
  readonly interactive?: boolean;
  /** Move keyboard focus into the grid when it first renders. */
  readonly autoFocus?: boolean;
  /** Pointer pressed on a cell (start of a click or drag). */
  readonly onCellDown?: (coord: Coordinate) => void;
  /** Pointer released over a cell, or Enter/Space on the focused cell. */
  readonly onCellUp?: (coord: Coordinate) => void;
  /** Pointer moved over a cell, or focus moved to it with the arrow keys. */
  readonly onCellEnter?: (coord: Coordinate) => void;
  readonly onPointerLeaveGrid?: () => void;
};

const rows = Array.from({ length: BOARD_SIZE }, (_, index) => index);

const ARROWS: Record<string, Coordinate> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

/** Which cell sits under a pointer, whichever element implicitly captured it. */
function cellAtPoint(x: number, y: number): Coordinate | null {
  const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-row]');
  if (!cell || !cell.dataset.row || !cell.dataset.col) return null;
  const coord = { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
  return isOnBoard(coord) ? coord : null;
}

/**
 * A 10×10 board exposed as a WAI-ARIA grid: one roving tab stop, arrow keys to
 * move between cells and Enter or Space to act on the focused one. Pointer
 * input is resolved from the point under the pointer so a touch drag works the
 * same as a mouse drag.
 */
export function Grid({
  title,
  marks,
  active = false,
  interactive = false,
  autoFocus = false,
  onCellDown,
  onCellUp,
  onCellEnter,
  onPointerLeaveGrid,
}: GridProps) {
  const [focus, setFocus] = useState<Coordinate>({ row: 0, col: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  const hovered = useRef<string | null>(null);
  const pendingFocus = useRef(autoFocus);

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-row="${focus.row}"][data-col="${focus.col}"]`)
      ?.focus();
  }, [focus]);

  const enter = useCallback(
    (coord: Coordinate) => {
      const key = coordinateKey(coord);
      if (hovered.current === key) return;
      hovered.current = key;
      onCellEnter?.(coord);
    },
    [onCellEnter],
  );

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const coord = cellAtPoint(event.clientX, event.clientY);
    if (coord) enter(coord);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const coord = cellAtPoint(event.clientX, event.clientY);
    if (coord) {
      setFocus(coord);
      onCellUp?.(coord);
    }
  };

  const leaveGrid = () => {
    hovered.current = null;
    onPointerLeaveGrid?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, coord: Coordinate) => {
    const step = ARROWS[event.key];
    if (step) {
      event.preventDefault();
      const next = { row: coord.row + step.row, col: coord.col + step.col };
      if (!isOnBoard(next)) return;
      pendingFocus.current = true;
      setFocus(next);
      if (interactive) enter(next);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = { row: coord.row, col: event.key === 'Home' ? 0 : BOARD_SIZE - 1 };
      pendingFocus.current = true;
      setFocus(next);
      if (interactive) enter(next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!interactive) return;
      onCellDown?.(coord);
      onCellUp?.(coord);
    }
  };

  return (
    <section className="flex w-full min-w-0 max-w-md flex-col gap-3 lg:flex-1 lg:basis-0">
      <h2 className="text-xs tracking-[0.2em] text-muted uppercase">{title}</h2>
      <div
        ref={gridRef}
        role="grid"
        aria-label={title}
        aria-readonly={!interactive}
        className={`block w-full touch-none p-2 select-none ${
          active ? 'bg-panel outline outline-1 outline-steel' : 'bg-panel'
        }`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={leaveGrid}
        onPointerLeave={leaveGrid}
      >
        <div
          role="row"
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `1.5rem repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
        >
          <div role="columnheader" aria-label="Row" className="h-6" />
          {COLUMN_LETTERS.map((letter) => (
            <div
              key={letter}
              role="columnheader"
              className="flex h-6 items-center justify-center text-xs text-muted"
            >
              {letter}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div
            key={row}
            role="row"
            className="grid gap-[2px] pt-[2px]"
            style={{ gridTemplateColumns: `1.5rem repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
          >
            <div role="rowheader" className="flex items-center justify-center text-xs text-muted">
              {row + 1}
            </div>
            {COLUMN_LETTERS.map((_, col) => {
              const coord: Coordinate = { row, col };
              const mark = marks.get(coordinateKey(coord)) ?? 'empty';
              const focused = focus.row === row && focus.col === col;
              return (
                <Cell
                  key={col}
                  coord={coord}
                  mark={mark}
                  focused={focused}
                  interactive={interactive}
                  onKeyDown={handleKeyDown}
                  onFocus={setFocus}
                  {...(onCellDown ? { onPointerDown: onCellDown } : {})}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

type CellProps = {
  readonly coord: Coordinate;
  readonly mark: CellMark;
  readonly focused: boolean;
  readonly interactive: boolean;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>, coord: Coordinate) => void;
  readonly onFocus: (coord: Coordinate) => void;
  readonly onPointerDown?: (coord: Coordinate) => void;
};

function Cell({ coord, mark, focused, interactive, onKeyDown, onFocus, onPointerDown }: CellProps) {
  const fired = mark === 'miss' || mark === 'hit' || mark === 'sunk';
  return (
    <div
      role="gridcell"
      tabIndex={focused ? 0 : -1}
      data-row={coord.row}
      data-col={coord.col}
      aria-label={`${formatCoordinate(coord)}, ${MARK_LABEL[mark]}`}
      aria-disabled={!interactive || fired || undefined}
      onKeyDown={(event) => onKeyDown(event, coord)}
      onFocus={() => onFocus(coord)}
      onPointerDown={() => interactive && onPointerDown?.(coord)}
      className={`relative flex aspect-square w-full min-w-6 items-center justify-center text-xs transition-colors duration-[120ms] ease-out outline-offset-[-2px] focus:z-10 focus:outline-2 focus:outline-ink sm:min-w-7 ${
        MARK_CLASS[mark]
      } ${interactive ? (mark === 'empty' ? 'cursor-crosshair hover:bg-sea-hover' : 'cursor-crosshair') : 'cursor-default'}`}
    >
      <MarkIcon mark={mark} />
    </div>
  );
}

/** Miss is a ring, hit a cross, sunk a diamond: three shapes, not just three colours. */
function MarkIcon({ mark }: { readonly mark: CellMark }) {
  switch (mark) {
    case 'miss':
      return (
        <svg aria-hidden viewBox="0 0 16 16" className="h-[45%] w-[45%]">
          <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'hit':
    case 'ship-hit':
      return (
        <svg aria-hidden viewBox="0 0 16 16" className="h-[60%] w-[60%] text-ink">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
        </svg>
      );
    case 'sunk':
    case 'ship-sunk':
      return (
        <svg aria-hidden viewBox="0 0 16 16" className="h-[60%] w-[60%] text-ink">
          <path d="M8 1.5L14.5 8 8 14.5 1.5 8z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}
