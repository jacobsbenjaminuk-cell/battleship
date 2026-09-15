# Benchmark

Shots the AI needs to sink all 17 cells of a random fleet on a
10 x 10 board. 2,000 seeded games per difficulty,
every shot dispatched through `gameReducer`, so the AI plays under the same
rules as a human: one shot per turn, repeats rejected, nothing off the board.
Each game asserts that no cell was fired at twice and that the game ends with
the whole fleet sunk and 17 hits recorded.

## Reproduce

```bash
npm run bench     # BENCH_GAMES=2000 BENCH_SEED=20260915
```

Seeds are `20260915 + game index`, and one seed drives both fleets and every
shot, so the numbers below reproduce exactly.

## Results

| Difficulty | Median | Mean | Best | Worst | 90th pct | Games > 73 |
| --- | --- | --- | --- | --- | --- | --- |
| Easy | 97.0 | 95.45 | 64 | 100 | 100 | 1995 |
| Medium | 51.0 | 50.80 | 22 | 76 | 62 | 3 |
| Hard | 44.0 | 44.36 | 21 | 71 | 58 | 0 |

Lower is better. Medians are ordered Hard < Medium < Easy.

## How the game is run

The AI takes the `player` seat, so it shoots first and cannot be cut short by
its sparring partner. The partner fires every empty cell before it fires a
single ship cell, so it always needs all 100 shots and never ends the game
early; without that, games where the AI needed close to 100 shots would be
truncated and every average here would be flattering.

## Against DataGenetics

[DataGenetics](https://www.datagenetics.com/blog/december32011/) reports
medians of 97 for random fire, 64 for parity hunt-and-target and 42 for
probability density, with no density game worse than 73. Those were sanity
checks here, not targets. Easy lands on the same median; Medium comes in well
under the quoted 64; Hard sits a couple of shots above the quoted 42 and stays
inside the 73 ceiling. The differences come from what each strategy here
actually does:

- **Fleet.** The same 5/4/3/3/2 fleet on a 10 x 10 board, so the totals are
  comparable.
- **Medium beats its reference.** DataGenetics' hunt-and-target keeps a fixed
  two-colour parity all game. Medium widens the stride to the smallest ship
  still afloat, so once the destroyer is sunk it sweeps every third cell rather
  than every second, and in target mode it extends along the axis two collinear
  hits already imply instead of working through a plain neighbour queue. Both
  save shots, which is why the median is nearer 51 than 64.
- **Hard is a touch above its reference.** It reads everything from
  `view.shots` alone, so the only constraints it can apply are misses, hits and
  the hulls it reconstructs for sunk ships; it has no ship-adjacency prior and
  does not weight by how a human tends to place a fleet. The count is a plain
  placement count per unfired cell, upweighted around outstanding hits, and that
  costs it the last couple of shots against a tuned reference implementation.
- **Sunk-ship deduction is a heuristic.** Which outstanding hits belonged to the
  ship that just sank is inferred from the run of hits through the killing
  shot. Where two ships lie adjacent and collinear that attribution can be
  wrong, which shows up in the worst case rather than the median.
