# Bugs

## Sunk-ship attribution stole cells from an adjacent collinear ship

**Found by:** benchmark analysis
**Fixed in:** `carveHull` in `src/core/ai.ts`
**Test:** `src/core/ai.test.ts` — "never claims a cell for a sunk ship when a
neighbour could own it"

An AI sees only `view.shots`, so when a shot reports `sunk` it has to work out
for itself which of the outstanding hits made up that ship. The old rule took
the run of hits through the killing shot and cut a window of the ship's length
out of it, preferring the shortest run that could hold the ship.

Two ships lying end to end along the same axis look like one unbroken run of
hits, so that window could take cells belonging to the ship still afloat. With
a destroyer on A1-B1 and a cruiser on C1-E1:

```
hit A1, hit C1, sunk B1 (destroyer)
run through B1 = A1 B1 C1, window of 2 containing B1 -> B1 C1
```

C1 belongs to the cruiser, which is still afloat. It was recorded in
`sunkCells`, so Hard excluded every placement covering it and Medium stopped
treating it as a hit worth working outwards from: the AI had written off part
of a live ship and had to rediscover the cruiser the slow way.

**How often it bit:** over 400 seeded games per difficulty the ambiguous case
never arose from Medium's or Hard's own shot order (0 of ~2,000 sinkings each)
— both finish a ship before they stray onto its neighbour — but it arose in 90
of 1,412 sinkings under Easy's random fire, and it is reachable for any shot
order a human would produce. Benchmark medians are unchanged by the fix; this
was a correctness bug in shared deduction code, not a measurable slowdown.

The fix enumerates every window that could hold the sunk ship — both axes, all
offsets — and retires only the cells every candidate contains. Ambiguous cells
stay outstanding, so the AI may fire an extra shot around a hull that is
already dead, but it can never declare a live ship's cell dead ground. In the
example only B1, the killing shot itself, is retired.
