# Battleship

[![CI](https://github.com/jacobsbenjaminuk-cell/battleship/actions/workflows/ci.yml/badge.svg)](https://github.com/jacobsbenjaminuk-cell/battleship/actions/workflows/ci.yml)

A browser Battleship game against an AI that cannot see your board.
Play it here: https://dist-suzoqszv.devinapps.com

## How to play

Place your five ships by clicking or dragging on your grid. Press `R` to rotate.
Pick Easy, Medium or Hard, then press Start battle. Click a cell on the enemy
grid to fire. The first side to hit all 17 ship cells wins.

## Design decisions

**The AI only sees its own shots.** Every AI implements
`nextShot(view: OpponentView): Coordinate`. `OpponentView` holds the board size
and the AI's own shot history with each result. It has no field for your ship
positions, so no difficulty can read them, whether by accident or on purpose.
Cheating is impossible by construction, not merely absent from the code.

**Three different algorithms, not one with a dice roll.** Easy fires at random.
Medium hunts on a parity pattern and then works outwards from each hit. Hard
counts every placement still consistent with what it knows and fires at the
most likely cell. Each difficulty plays in a different way, and the benchmark
below shows the gap between them.

**Every game can be verified.** The enemy fleet is dealt before your first
shot. The game hashes the layout with a random salt and shows you the hash up
front. When the battle ends it reveals the layout and the salt. Hash them
yourself and you get the same value, which proves the fleet never moved.

## The AI

Shots needed to sink a random fleet, over 2,000 seeded games per difficulty.
Lower is better.

| Difficulty | Algorithm | Median | Mean |
| --- | --- | --- | --- |
| Easy | Uniform random over unfired cells | 97.0 | 95.45 |
| Medium | Parity hunt, then target around hits | 51.0 | 50.80 |
| Hard | Probability density over consistent placements | 44.0 | 44.36 |

Reproduce the numbers with:

```bash
npm run bench
```

The seed is fixed, so the run writes exactly the table in
[BENCHMARK.md](BENCHMARK.md). Against the
[DataGenetics medians](https://www.datagenetics.com/blog/december32011/) of 97,
64 and 42, Easy matches, Medium is well ahead, and Hard is two shots behind.

## How to verify the AI did not move its ships

1. Before you fire, find the "Fairness commitment" panel under the boards and
   copy the hash.
2. Play the game to the end.
3. On the game over screen, find the "Fairness reveal" panel. It shows the
   hash, the salt and the enemy fleet.
4. Press "Copy preimage". This is the exact text that was hashed. It has the
   form `battleship-v1|<salt>|carrier:horizontal:A1-B1-C1-D1-E1|...`, so you
   can also build it by hand from the salt and fleet shown on screen.
5. Hash it. On macOS or Linux:

   ```bash
   printf '%s' '<paste the preimage here>' | shasum -a 256
   ```

6. Compare the result with the hash you copied in step 1. They match.

"Export game JSON" saves the seed, hash, salt, both layouts and every shot, so
you can check a game later or share it.

## Architecture

The code is split into two layers with a hard boundary between them.

`src/core` is pure TypeScript. It holds the types, coordinate helpers, board
rules, the `gameReducer` state machine, the seeded random source and the three
AIs. It has no React, no JSX and no DOM, so it runs in Node under Vitest and
drives the benchmark. CI fails if the word "react" appears anywhere under it.

`src/ui` is the React layer. `App.tsx` switches between the placement, play and
game over phases. The `useBattleship` hook owns one seeded engine per game,
dispatches actions to the reducer and schedules the AI's turn. Components
render state and dispatch actions; they contain no rules. The fairness
commitment lives here because Web Crypto is a DOM API.

Data flows one way: a click or key press becomes an action, the reducer
returns a new `GameState`, and the hook hands it back to the components.

```
src/
  core/   types, coordinates, board, game (reducer), random, ai
  ui/     Grid, PlacementPhase, PlayPhase, GameOver, Fairness, useBattleship
scripts/
  bench.ts   seeded benchmark run through gameReducer
```

The full generated wiki is at https://app.devin.ai/wiki/jacobsbenjaminuk-cell/battleship.

## Commands

```bash
npm install        # install dependencies (Node 20 or later)
npm run dev        # dev server at http://localhost:5173
npm test           # run the Vitest suite once
npm run bench      # 2,000 seeded games per difficulty, rewrites BENCHMARK.md
npm run build      # type-check, then build to dist/
```

## What it does not do

- No multiplayer. It is one person against the AI.
- No saved games. Refresh the page and the game is gone.
- No salvo mode. One shot per turn, always.
- The Hard AI reads only shot outcomes. It has no prior about ships touching
  each other and does not model how people tend to place fleets. That costs it
  a couple of shots against a tuned reference implementation.
- The hash proves the enemy board did not change during the game. It does not
  prove the code never read your board in memory. The source being open is
  what lets you check that.
