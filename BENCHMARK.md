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

## Distribution

Games finishing in each range of shots. The last column is how many games
uniform random fire is expected to land in that range in theory, which is worth
checking against the Easy column.

| Shots | Easy | Medium | Hard | Easy expected |
| --- | --- | --- | --- | --- |
| 21-30 | 0 | 30 | 99 | 0 |
| 31-40 | 0 | 247 | 636 | 0 |
| 41-50 | 0 | 650 | 790 | 0 |
| 51-60 | 0 | 787 | 357 | 0 |
| 61-70 | 2 | 271 | 117 | 2 |
| 71-80 | 28 | 15 | 1 | 28 |
| 81-90 | 254 | 0 | 0 | 251 |
| 91-100 | 1716 | 0 | 0 | 1719 |

Easy's shot count is the AI's own count of shots to sink all 17 enemy cells; the
sparring partner's 100 shots are not part of it and cannot inflate it. Random
fire is slow by nature: the count is where the last of 17 marked cells turns up in
a shuffle of 100, so it averages 17 x 101 / 18 =
95.39 shots, and only
0.3% of games finish inside 73. The measured Easy mean
(95.45), median and tail all sit on that curve, so the ceiling of 100 is
random fire eventually reaching the last cell, not a truncation artefact.

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
- **Sunk-ship deduction is deliberately cautious.** Which outstanding hits
  belonged to the ship that just sank is inferred from the runs of hits through
  the killing shot, and where two ships lie end to end several runs fit. Only
  the cells every candidate agrees on are retired (see BUGS.md); the ambiguous
  ones stay outstanding rather than risking the AI writing off a live ship's
  hull. It costs nothing here — the ambiguous case never arises from Medium's
  or Hard's own shot order — but it is reachable under any other order.
