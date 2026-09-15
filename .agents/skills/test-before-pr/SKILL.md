---
name: test-before-pr
description: Verification gate to run before opening any PR that touches the Battleship app — runs npm test and npm run build, plays one full game in the browser, captures 1440px and 375px screenshots, and checks the console is clean.
---

---
name: test-before-pr
description: Verify Battleship gameplay, responsive input, fairness proof, exports and console before a PR.
---

# Test before PR

Run every step in order. Do not open a PR while any step is failing.

## 1. Tests and build

```bash
npm install            # only if node_modules is missing or package.json changed
npm test               # vitest, single run — must be green
npm run build          # tsc -b then vite build — must succeed with no TS errors
if grep -ri react src/core; then echo "FAIL: React leaked into core"; exit 1; fi
```

## 2. Serve the app

```bash
npm run preview -- --port 4173 --strictPort
```

Preview serves the production bundle, which is what the PR ships. Use
`npm run dev` only when you need hot reload while fixing something.

## 3. Play one full game in the browser

Drive the real UI, not the reducer:

1. Land on the placement phase (there is no splash or menu).
2. Place at least one ship by click and one by drag, and rotate with `R`.
3. Press **Clear**, then **Randomise**, then **Start battle**.
4. Fire at cells until the game ends. Confirm along the way:
   - a hit, a miss and a "hit and sunk the …" message all appear;
   - clicking an already-fired cell is rejected and the turn does not pass;
   - the turn indicator and both shot counters update and do not jitter.
5. Reach the game over screen and press **Play again**; the board resets to
   placement.

Shortcut for reaching the end state quickly: keep firing; the game is over when
all 17 ship cells on one side are hit.

## 4. Screenshots

Capture the play phase at both widths and attach them to the PR:

- 1440 x 900 (desktop)
- 375 x 812 (mobile)

## 5. Console must be clean

With devtools open for the whole session, confirm there are zero errors and zero
warnings (React key warnings and 404s count as failures). Record the console
state in the PR description.

## 6. Only then

Open the PR, including the two screenshots and a one-line confirmation that
tests, build, the full game run and the clean console all passed.

## Keyboard and touch accessibility changes

When input/accessibility behavior changes, record separate keyboard-only and
mobile-touch games. Operate the real UI with native key/touch events, never
dispatch reducer actions or read hidden ship positions to finish a game.

- For keyboard runs, check the focused cell before firing, during the enemy
  turn, after the enemy responds, and when gameover inserts content above the
  board. A computed outline is not sufficient: confirm it is on screen.
- Observe `[role=status]` mutations throughout play. Read each player result
  before the enemy's delayed response replaces it, then read the enemy result.
  Check two consecutive rejected repeat shots, not just the first rejection.
  DOM announcements do not prove audible screen-reader delivery.
- For touch, enable actual Chrome device/touch emulation at 375×812. Use
  touchStart/move/end, not mouse drag or synthesized DOM click events.
  Capture the ship preview while the touch remains held; confirm the placed
  ship starts at the drag origin rather than at the release cell.
- Check `document.documentElement.scrollWidth === innerWidth === 375` in
  placement, play, and gameover. Use touch swipes to reach lower controls.
- When attaching Playwright to a browser already using DevTools emulation,
  its cached viewport settings may override device metrics during screenshot
  capture. Configure matching dimensions, enable DevTools device mode last,
  and verify dimensions after capture. Raw CDP `Page.captureScreenshot`
  avoids Playwright's screenshot viewport restoration.
- Keep console monitoring active from before loading the game. If DevTools
  cannot remain visible for an input-only recording, capture CDP console,
  runtime exceptions, and failed response events throughout, and explicitly
  state this alternative in the testing report.
- For out-of-turn or repeat-shot tests, do not use Playwright locator `click()`
  on an `aria-disabled` gridcell: it waits for enabled state, potentially
  postponing the action until the next turn. Use native `page.mouse.click()`
  at the cell's bounding-box center, and log the action timing and counters.
- Inspect both boards before the first shot, during the first enemy delay,
  and after the first reply. Content-dependent sizing may differ while only
  one board has a shot marker; later-game screenshots alone can miss this.
- Test placement at human pace and as a sub-frame burst (five Enters or
  clicks on distinct rows within ~50ms total). Both must place five different
  ships in order; record the actual selected ship before each press, not only
  the intended sequence. Clear and Randomise must leave Carrier selected.
- After Play again, inspect `document.activeElement` before pressing Tab,
  then confirm Tab recovers a usable placement control. A reset announcement
  alone does not demonstrate restored keyboard focus.

### Devin Secrets Needed

None for local gameplay. The production preview is a standalone browser app
and does not require an account or backend credentials.

## Public deployment and documentation verification

When the task explicitly targets a public deployment, use the supplied URL
instead of a local build. A Devin-hosted deployment may not have any deployment
configuration in the repository; absence of such configuration does not imply
that the site is unavailable. For docs-only runtime checks, distinguish the
documented user procedure from gameplay regression coverage.

Verify fairness using the user-facing procedure, not internal game state:

1. Before firing, select the text in **Fairness commitment** and copy it. This
   panel has no Copy button. Save the actual clipboard value.
2. Complete a game using visible results only. In **Fairness reveal**, press
   **Copy preimage** and read the clipboard; do not reconstruct it from hidden
   state or substitute a preimage read from application internals.
3. Run `printf '%s' '<copied preimage>' | shasum -a 256` without a trailing
   newline. Compare the digest against both the saved initial hash and the
   revealed hash. Report all actual values.
4. Press **Export game JSON**, wait until the `.crdownload` file becomes `.json`,
   then parse it and compare its seed, difficulty, commitment, layouts, shot
   counts, hit counts and winner to the observed game.

If desktop clipboard utilities are unavailable, the browser Clipboard API can
read the result of the native Copy interaction; grant clipboard-read permission
for the tested origin first. Do not use this to bypass pressing the Copy button.

At narrow widths, inspect the rendered result text itself: single-line status
messages may be ellipsized even when the live region contains the complete
sentence. Report readability separately from whether the shot/counter/turn
behavior works. Emulated touch is not proof on a physical phone.
