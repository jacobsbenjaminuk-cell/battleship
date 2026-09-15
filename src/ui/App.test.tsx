// @vitest-environment happy-dom
import { act, useMemo, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGameReducer, createInitialState, createSeededRandom, type GameState } from '../core';
import { Grid } from './Grid';
import { PlacementPhase } from './PlacementPhase';
import { PlayPhase } from './PlayPhase';
import { ownBoardMarks } from './marks';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(element: React.ReactElement) {
  act(() => root.render(element));
}

function cell(row: number, col: number): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
  if (!found) throw new Error(`no cell ${row},${col}`);
  return found;
}

function playing(seed: number): GameState {
  const random = createSeededRandom(seed);
  const reducer = createGameReducer(random);
  return reducer(reducer(createInitialState(random), { type: 'randomise' }), { type: 'start' });
}

describe('Grid sizing', () => {
  it('takes its width from the layout, never from the marks inside it', () => {
    render(<Grid title="Test" marks={ownBoardMarks(playing(1).player.board)} />);
    const grid = container.querySelector<HTMLElement>('[role="grid"]')!;
    const section = grid.closest('section')!;
    // An inline-block grid over 1fr columns is sized by its contents, so a
    // percentage-sized mark in one cell changed the whole board's footprint
    // after the first shot. Both wrappers must be block-level and width-bound.
    expect(grid.className).not.toMatch(/inline-block/);
    expect(grid.className.split(' ')).toContain('w-full');
    expect(section.className.split(' ')).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-md', 'lg:flex-1', 'lg:basis-0']),
    );
  });

  it('gives both boards in the play phase the same sizing contract', () => {
    render(<PlayPhase state={playing(2)} dispatch={() => {}} />);
    const classes = [...container.querySelectorAll<HTMLElement>('[role="grid"]')].map((g) => g.className);
    expect(classes).toHaveLength(2);
    for (const className of classes) {
      expect(className).not.toMatch(/inline-block/);
      expect(className.split(' ')).toContain('w-full');
    }
  });
});

describe('PlacementPhase focus', () => {
  function placement(seed: number): GameState {
    return createInitialState(createSeededRandom(seed));
  }

  it('moves focus into the grid when asked to, so a reset never lands on <body>', () => {
    render(
      <PlacementPhase
        state={placement(1)}
        dispatch={() => {}}
        difficulty="medium"
        onDifficultyChange={() => {}}
        autoFocus
      />,
    );
    expect(document.activeElement).toBe(cell(0, 0));
  });

  it('leaves focus alone on first load', () => {
    render(
      <PlacementPhase
        state={placement(1)}
        dispatch={() => {}}
        difficulty="medium"
        onDifficultyChange={() => {}}
      />,
    );
    expect(document.activeElement).toBe(document.body);
  });
});

describe('PlacementPhase keyboard placement', () => {
  function Harness({ onState }: { readonly onState: (state: GameState) => void }) {
    const random = useMemo(() => createSeededRandom(3), []);
    const reducer = useMemo(() => createGameReducer(random), [random]);
    const [state, dispatch] = useReducer(reducer, random, createInitialState);
    onState(state);
    return (
      <PlacementPhase state={state} dispatch={dispatch} difficulty="medium" onDifficultyChange={() => {}} />
    );
  }

  it('moves a placed ship picked from the list, then goes back to the next unplaced one', () => {
    let latest: GameState | null = null;
    render(<Harness onState={(state) => (latest = state)} />);
    const press = (row: number) =>
      act(() => {
        cell(row, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
    press(0);
    press(2);
    expect(latest!.player.board.ships.map((ship) => ship.id)).toEqual(['carrier', 'battleship']);

    const carrierButton = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Carrier'))!;
    act(() => carrierButton.click());
    expect(carrierButton.getAttribute('aria-pressed')).toBe('true');
    press(4);
    expect(latest!.player.board.ships.map((ship) => [ship.id, ship.origin.row])).toEqual([
      ['battleship', 2],
      ['carrier', 4],
    ]);
    const cruiserButton = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Cruiser'))!;
    expect(cruiserButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('places five ships from five back-to-back Enter presses on distinct rows', async () => {
    let latest: GameState | null = null;
    render(<Harness onState={(state) => (latest = state)} />);

    // Fire the presses back to back without act() between them, the way real
    // key events arrive, and only then let React settle.
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      for (let row = 0; row < 5; row += 1) {
        cell(row * 2, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    } finally {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(latest!.player.board.ships.map((ship) => ship.id)).toEqual([
      'carrier',
      'battleship',
      'cruiser',
      'submarine',
      'destroyer',
    ]);
  });
});
