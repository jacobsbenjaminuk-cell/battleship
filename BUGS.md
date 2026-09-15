# Bugs

Every entry says what a player would have seen, why it happened, what changed,
and which test now fails without the fix. **Found by** is one of: Devin Review,
benchmark analysis, test suite, adversarial testing.

## Contents

1. [Both boards changed size after the first shot](#1-both-boards-changed-size-after-the-first-shot)
2. [Play again dropped keyboard focus on the page body](#2-play-again-dropped-keyboard-focus-on-the-page-body)
3. [Fast placements kept re-placing the same ship](#3-fast-placements-kept-re-placing-the-same-ship)
4. [Sunk-ship attribution stole cells from an adjacent collinear ship](#4-sunk-ship-attribution-stole-cells-from-an-adjacent-collinear-ship)
5. [`randomise` and `reset` ignored the injected RandomSource](#5-randomise-and-reset-ignored-the-injected-randomsource)
6. [A drag placed the ship at the release cell, not along the drag](#6-a-drag-placed-the-ship-at-the-release-cell-not-along-the-drag)
7. [No CI](#7-no-ci)
8. [Checked and not broken](#checked-and-not-broken)

---

## 1. Both boards changed size after the first shot

**Found by:** adversarial testing (item 10/15 of the bug hunt, at 1440 px)
**Fixed in:** `Grid` in `src/ui/Grid.tsx`
**Test:** `src/ui/App.test.tsx` — "takes its width from the layout, never from
the marks inside it" and "gives both boards in the play phase the same sizing
contract"

**What you saw.** Start a battle on a desktop window and fire once. While the
enemy was "thinking" the target board ballooned from 340 px to 835 px square
and your own fleet board was crushed to 93 px wide with its columns overlapping.
When the enemy's shot landed, both boards jumped to 464 px. From then on they
were stable, so a screenshot taken later in a game never showed it.

**Why.** Each board was an `inline-block` with `grid-template-columns:
repeat(10, minmax(0, 1fr))`, sitting in a flex row with no width of its own.
An inline-block is sized by its contents, and the miss/hit icons are sized as a
percentage of their cell, which is itself sized by the track. That is a cyclic
intrinsic size: as soon as one board contained an icon and the other did not,
the two flex items had different content sizes and the browser resolved the
cycle differently for each. Once both boards had a mark they agreed again.

**What changed.** The board's width now comes from the layout, not from the
marks. The `<section>` is `w-full min-w-0 max-w-md lg:flex-1 lg:basis-0` and the
grid itself is `block w-full`, so both boards in the play phase share the space
equally (448 px at 1440 wide, measured identical across 56 animation frames
before, during and after the first shot) and the placement board sits beside a
`shrink-0` control panel.

---

## 2. Play again dropped keyboard focus on the page body

**Found by:** adversarial testing (item 17, keyboard-only game)
**Fixed in:** `App` in `src/App.tsx`, `PlacementPhase` in `src/ui/PlacementPhase.tsx`
**Test:** `src/ui/App.test.tsx` — "moves focus into the grid when asked to, so
a reset never lands on <body>" (and "leaves focus alone on first load" pins the
opposite for a fresh page)

**What you saw.** At game over the *Play again* button takes focus, which is
right. Press Enter on it and the placement screen comes back, but
`document.activeElement` is `<body>`: a screen-reader user hears "New game.
Place your fleet." and then nothing responds to the arrow keys until they Tab
back in. Not a trap, but a dropped thread every single game.

**Why.** The play phase's grid asks for focus on mount (`autoFocus`) because
*Start battle* unmounts itself. The placement grid did not, because on a fresh
page load stealing focus is wrong. Nothing distinguished the two ways of
arriving at placement.

**What changed.** `App` counts resets and mounts `PlacementPhase` with
`key={round}` and `autoFocus={round > 0}`, so a reset focuses A1 of the
placement grid and a first load still leaves focus alone.

---

## 3. Fast placements kept re-placing the same ship

**Found by:** adversarial testing (item 8 applied to placement: five Enter
presses on five rows in under 50 ms)
**Fixed in:** `PlacementPhase` in `src/ui/PlacementPhase.tsx`
**Test:** `src/ui/App.test.tsx` — "places five ships from five back-to-back
Enter presses on distinct rows" (dispatches the key events without `act()`
between them, the way real input arrives). "moves a placed ship picked from the
list, then goes back to the next unplaced one" pins the deliberate-move path.

**What you saw.** Arrow down two rows and press Enter, five times, as fast as
a keyboard repeat or a macro can: the Carrier landed on A1, then *moved* to A3;
the Battleship landed on A5, then moved to A7, then A9. Two ships on the board,
*Start battle* disabled, and no message explaining what happened. At 50 ms
between presses all five ships placed correctly, so a human tapping normally
never saw it — but the outcome depended on timing, which it must not.

**Why.** Which ship was "selected" was React state, advanced by a `useEffect`
that ran *after* the render following a placement. A handler that fires before
that render (or before the effect flushes) still closes over the previous
selection and dispatches a second placement for the same ship, which the
reducer correctly treats as a move.

**What changed.** The selection is now derived in render: an explicit pick from
the list holds only for the board object it was made on, and any board change
falls back to the first unplaced ship. Handlers additionally keep a ref of the
placements already dispatched against the current board, so even a handler
whose closure is a render behind picks the next ship that has not been sent
yet. Verified in the browser with trusted native events: five Enters in 54 ms
and five clicks in 20 ms both placed Carrier, Battleship, Cruiser, Submarine,
Destroyer in order. A side effect is that *Clear* and *Randomise* now return
the selection to the Carrier instead of keeping whichever ship was highlighted.

---

## 4. Sunk-ship attribution stole cells from an adjacent collinear ship

**Found by:** benchmark analysis (PR #2)
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

---

## 5. `randomise` and `reset` ignored the injected RandomSource

**Found by:** Devin Review (PR #1, before merge)
**Fixed in:** `createGameReducer` in `src/core/game.ts`
**Test:** `src/core/seed.test.ts` — "keeps randomise and reset on the injected
source rather than Math.random"

**What you saw.** Nothing on screen — this is a reproducibility bug. The whole
point of `createSeededRandom(seed)` is that one seed replays one game, and the
initial enemy fleet did come from it. But *Randomise* and *Play again* called
`randomBoard()` with its `Math.random` default, so a replayed game diverged the
moment either was used, and the seed in the exported JSON no longer described
the layouts in it.

**Why.** `RandomSource` had been threaded through `createInitialState` but the
reducer was a bare function with no source to hand on.

**What changed.** The reducer is built by `createGameReducer(random)` and passes
that source to `randomBoard` and `createInitialState`; the UI holds one seeded
stream per game.

---

## 6. A drag placed the ship at the release cell, not along the drag

**Found by:** Devin Review (PR #1, before merge)
**Fixed in:** `dragPlacement` in `src/core/board.ts`, `applyDrag` in `src/core/game.ts`
**Test:** `src/core/board.test.ts` — "extends the hull along the dragged axis
from the start cell" and "runs the hull backwards when dragged up or left"

**What you saw.** Drag from A1 to E1 to lay the Carrier along row 1 and it was
placed with its *origin* at E1 — E1-I1 — or rejected as off-board if you had
dragged towards an edge. The drag gesture was really a click at the pointer-up
cell.

**Why.** The drag end handler dispatched an ordinary `place` at the release
cell with the current orientation; the start cell was thrown away.

**What changed.** `dragPlacement(start, end, size)` turns the gesture into an
origin and orientation: the dominant axis sets the orientation, the direction
decides whether the hull runs forwards or backwards from the start cell, and a
release further away than the ship is long is rejected with a length-specific
message. The `drag-place` action carries both cells.

---

## 7. No CI

**Found by:** Devin Review (PR #1, before merge)
**Fixed in:** `.github/workflows/ci.yml`
**Test:** the workflow itself — `npm test`, `npm run build`, `npm run bench`
and `grep -ri react src/core` on every push and pull request.

`npm test` and `npm run build` were documented as required before a PR but
nothing enforced it. The workflow now runs both, plus the benchmark and the
core-has-no-React check.

---

## Checked and not broken

Items of the hunt that were tried and held, with what actually happened.

- **Carrier off the right or bottom edge, horizontal ship at J5** (items 1-2):
  the preview clips red, the click is rejected with "That ship does not fit on
  the board.", and nothing wraps onto the next row (`placeShip` bounds-checks
  every cell, not just the origin).
- **Rotate flush against the right edge** (item 3): R and the Rotate button
  flip a blocked horizontal J5 into a valid vertical J5-J9 and back. The
  previous rejection message stays on screen while hovering a now-valid
  preview; it clears on the next action. Cosmetic, left as is.
- **Two ships on the same cells, by click and by drag** (item 4): "Ships
  cannot overlap."; the first ship is untouched.
- **Getting stuck with no legal spot** (item 5): not reachable. Blocking every
  horizontal 5-run in every row needs two cells per row, twenty in all, and the
  other four ships total twelve cells; the same bound holds for columns. Any
  placed ship can be re-selected from the list and moved, and Clear always
  works. Overlap attempts show a message; Start stays disabled until five
  ships are down.
- **Same cell twice** (item 6): mouse, Enter and Space all get "A1 has already
  been fired at." as a fresh live-region node each time; counters and turn do
  not move. Reducer-level: `state.player` is the same object before and after.
- **Firing during the enemy's turn, ten clicks in 48 ms** (items 7-8): exactly
  one player shot per turn. The grid is non-interactive while `turn !==
  'player'` and the reducer rejects out-of-turn shots regardless. Across 166
  captured states the marked cells always matched both counters.
- **Adjacent Destroyer A1-A2 and Cruiser A3-A5, AI hits A2 then A3** (item 9):
  "A2 hit", "A3 hit", then "A1 hit and sunk the Destroyer" — each ship keeps
  its own `hits`, so the sinking is announced on the Destroyer's last cell.
  How the *AI* attributes that sinking to a hull is bug 4 above.
- **End of game** (items 10-11): one game-over insertion per game, immediately
  on the final shot, no late enemy shot, both fairness reveals rehash to their
  commitments. `applyShot` sets `phase`, `winner` and `turn` in one transition,
  so there is no state in which both sides have won.
- **Hard down to a corner ship** (items 12-13): 300 seeded games per
  difficulty in Node — zero repeat fires, worst `nextShot` 3.3 ms; in the
  browser Hard found a Destroyer jammed at A1-A2 on shots 38 and 40 of 40.
- **Refresh mid-game** (item 14): a clean reset to placement with a new
  fleet, new commitment and Medium selected. Nothing is persisted, by design.
- **Resize 1440 → 375 → 1440 mid-game** (item 15): focus and counters survive;
  `scrollWidth === clientWidth` at 375.
- **Console** (item 16): zero warnings, errors, exceptions or failed requests
  across two full games, before and after the fixes.
- **Keyboard-only game** (item 17): focus follows Start into enemy A1, stays
  on the target through enemy turns, moves to Play again at game over and —
  after bug 2 — back to placement A1. No trap.
- **Live region** (item 18): 211 shots produced 211 announcements including
  every enemy shot. The enemy's sentence replaces the player's after ~450 ms
  (measured 432-478 ms over 108 pairs); with `aria-live="polite"` a screen
  reader queues rather than cuts, but audible delivery was not tested.
