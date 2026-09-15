import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  DIFFICULTY_BLURBS,
  DIFFICULTY_LABELS,
  FLEET,
  dragPlacement,
  placeShip,
  removeShip,
  shipCells,
  type Coordinate,
  type Difficulty,
  type GameState,
  type Orientation,
  type ShipId,
} from '../core';
import type { GameAction } from '../core';
import { Grid } from './Grid';
import { ownBoardMarks, withPreview } from './marks';

type PlacementPhaseProps = {
  readonly state: GameState;
  readonly dispatch: (action: GameAction) => void;
  readonly difficulty: Difficulty;
  readonly onDifficultyChange: (difficulty: Difficulty) => void;
};

export function PlacementPhase({
  state,
  dispatch,
  difficulty,
  onDifficultyChange,
}: PlacementPhaseProps) {
  const board = state.player.board;
  const placed = useMemo(() => new Set(board.ships.map((ship) => ship.id)), [board.ships]);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [selected, setSelected] = useState<ShipId>('carrier');
  const [hover, setHover] = useState<Coordinate | null>(null);
  const [dragOrigin, setDragOrigin] = useState<Coordinate | null>(null);

  const nextUnplaced = FLEET.find((ship) => !placed.has(ship.id))?.id;
  const previouslyPlaced = useRef(placed);

  useEffect(() => {
    const justPlaced = !previouslyPlaced.current.has(selected) && placed.has(selected);
    previouslyPlaced.current = placed;
    if (justPlaced && nextUnplaced) setSelected(nextUnplaced);
  }, [placed, selected, nextUnplaced]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'r' || event.key === 'R') && !event.metaKey && !event.ctrlKey) {
        setOrientation((current) => (current === 'horizontal' ? 'vertical' : 'horizontal'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const spec = FLEET.find((ship) => ship.id === selected) ?? FLEET[0]!;

  const place = useCallback(
    (origin: Coordinate, direction: Orientation) => {
      dispatch({ type: 'place', shipId: spec.id, origin, orientation: direction });
    },
    [dispatch, spec.id],
  );

  const handleUp = (coord: Coordinate) => {
    const start = dragOrigin;
    setDragOrigin(null);
    if (!start || (start.row === coord.row && start.col === coord.col)) {
      place(coord, orientation);
      return;
    }
    const drag = dragPlacement(start, coord, spec.size);
    if (drag) setOrientation(drag.orientation);
    dispatch({ type: 'drag-place', shipId: spec.id, from: start, to: coord });
  };

  const preview = useMemo(() => {
    const base = ownBoardMarks(board);
    if (!hover) return base;
    const dragging =
      dragOrigin && (dragOrigin.row !== hover.row || dragOrigin.col !== hover.col)
        ? dragOrigin
        : null;
    const drag = dragging ? dragPlacement(dragging, hover, spec.size) : null;
    // A drag released too far away is rejected, so preview it as invalid.
    if (dragging && !drag) {
      return withPreview(base, shipCells(dragging, orientation, spec.size), false);
    }
    const origin = drag?.origin ?? hover;
    const direction: Orientation = drag?.orientation ?? orientation;
    const cells = shipCells(origin, direction, spec.size);
    const valid = placeShip(removeShip(board, spec.id), spec.id, origin, direction).ok;
    return withPreview(base, cells, valid);
  }, [board, hover, dragOrigin, orientation, spec.id, spec.size]);

  const ready = board.ships.length === FLEET.length;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <Grid
        title="Your waters — place your fleet"
        marks={preview}
        active
        interactive
        onCellDown={setDragOrigin}
        onCellUp={handleUp}
        onCellEnter={setHover}
        onPointerLeaveGrid={() => {
          setHover(null);
          setDragOrigin(null);
        }}
      />

      <div className="flex w-full max-w-xs flex-col gap-4">
        <p className="text-xs leading-relaxed text-muted">
          Tap a cell to drop the selected ship, or drag from bow to stern. With the keyboard,
          arrow to a cell and press Enter. Press
          <span className="mx-1 bg-sea px-1 py-0.5 text-ink">R</span>
          to rotate.
        </p>

        <ul className="flex flex-col gap-[2px]">
          {FLEET.map((ship) => {
            const isPlaced = placed.has(ship.id);
            const isSelected = ship.id === selected;
            return (
              <li key={ship.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelected(ship.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors duration-[120ms] ease-out ${
                    isSelected ? 'bg-sea-hover text-ink' : 'bg-panel text-muted hover:bg-sea'
                  }`}
                >
                  <span>{ship.name}</span>
                  <span className="flex items-center gap-3">
                    <span>
                      {ship.size}
                      <span className="sr-only"> cells</span>
                    </span>
                    <span className={isPlaced ? 'text-steel' : 'text-muted'}>
                      {isPlaced ? (
                        'placed'
                      ) : (
                        <>
                          <span aria-hidden>—</span>
                          <span className="sr-only">not placed</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2">
          <span className="text-xs tracking-[0.2em] text-muted uppercase">Enemy skill</span>
          <div className="flex gap-[2px]">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={level === difficulty}
                onClick={() => onDifficultyChange(level)}
                className={`flex-1 px-3 py-2 text-xs transition-colors duration-[120ms] ease-out ${
                  level === difficulty ? 'bg-ember text-ink' : 'bg-panel text-muted hover:bg-sea'
                }`}
              >
                {DIFFICULTY_LABELS[level]}
              </button>
            ))}
          </div>
          <p className="min-h-8 text-xs leading-relaxed text-muted">{DIFFICULTY_BLURBS[difficulty]}</p>
        </div>

        <div className="flex flex-wrap gap-[2px]">
          <ToolButton
            label={`Rotate, currently ${orientation}`}
            onClick={() => setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))}
          >
            Rotate · {orientation === 'horizontal' ? 'H' : 'V'}
          </ToolButton>
          <ToolButton onClick={() => dispatch({ type: 'randomise' })}>Randomise</ToolButton>
          <ToolButton onClick={() => dispatch({ type: 'clear' })}>Clear</ToolButton>
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => dispatch({ type: 'start' })}
          className={`px-4 py-3 text-sm tracking-[0.15em] uppercase transition-colors duration-[120ms] ease-out ${
            ready ? 'bg-ember text-ink hover:bg-ember-bright' : 'bg-panel text-muted'
          }`}
        >
          Start battle
        </button>

        <p className="min-h-4 text-xs text-miss-mark" aria-hidden>
          {state.message}
        </p>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      {...(label ? { 'aria-label': label } : {})}
      onClick={onClick}
      className="bg-panel px-3 py-2 text-xs text-ink transition-colors duration-[120ms] ease-out hover:bg-sea-hover"
    >
      {children}
    </button>
  );
}
