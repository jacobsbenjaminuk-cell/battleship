# AGENTS.md

Battleship: a player-vs-AI Battleship game built with Vite, React, TypeScript
(strict), Tailwind and Vitest.

## Setup

```bash
nvm use 22        # any Node >= 20 works
npm install
```

## Commands

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Vite dev server on http://localhost:5173      |
| `npm test`       | Vitest, single run                            |
| `npm run test:watch` | Vitest in watch mode                      |
| `npm run build`  | Type-check (`tsc -b`) then build to `dist/`   |
| `npm run bench`  | 2,000 seeded games per difficulty → `BENCHMARK.md` |
| `npm run preview`| Serve the production build locally            |

Both `npm test` and `npm run build` must pass before a PR is opened.

## Folder structure

```
src/
  core/          pure game logic, no React, no DOM
    types.ts       board/ship/shot/state types, fleet definition, OpponentView, AI
    coordinates.ts coordinate helpers (A1-J10 formatting, bounds, keys)
    board.ts       placement, shot resolution, random fleets
    game.ts        gameReducer over an immutable GameState
    ai.ts          easy/medium/hard AIs behind nextShot(view)
    *.test.ts      Vitest specs for the rules
  ui/            React components and presentation-only helpers
    Grid.tsx, PlacementPhase.tsx, PlayPhase.tsx, GameOver.tsx
    Fairness.tsx   commitment banner, reveal and JSON export
    fairness.ts    SHA-256 commit/reveal over the enemy layout (Web Crypto)
    marks.ts       maps game state to per-cell display marks
    useBattleship.ts reducer + AI turn scheduling + difficulty
  App.tsx, main.tsx, index.css
scripts/
  bench.ts       seeded benchmark driven through gameReducer
.agents/skills/  repository skills (see test-before-pr)
```

## Rules

- **`src/core` has no React imports.** No `react`, `react-dom`, JSX, hooks or DOM
  APIs anywhere under `src/core`. `grep -ri react src/core` must return nothing.
  Core is plain TypeScript that runs in Node under Vitest. That is why the
  fairness commitment lives in `src/ui`: Web Crypto is a DOM API.
- **No game rules in React components.** Components dispatch actions and render
  state; every rule (placement validity, shot resolution, turn order, win
  detection) lives in `src/core`.
- **State is immutable.** `gameReducer` returns new objects; board arrays are
  never mutated in place.
- **The AI only sees `OpponentView`.** It exposes the board size and the AI's own
  shot history — no ship positions — so cheating is impossible by construction.
  Easy, Medium and Hard all implement `AI.nextShot(view: OpponentView):
  Coordinate` and read nothing but `view.shots`.
- **Randomness is injected.** `createGameReducer(random)`, `createInitialState`
  and the AI factories all take a `RandomSource`; the AI factories require one,
  so no difficulty can reach for `Math.random`. Give the lot one
  `createSeededRandom(seed)` stream and the whole game — both fleets and every
  AI shot — replays exactly.
- TypeScript is strict (including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`); do not loosen it to make code compile.
