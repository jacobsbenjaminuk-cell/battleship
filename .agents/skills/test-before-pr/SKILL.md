---
name: test-before-pr
description: Verification gate to run before opening any PR that touches the Battleship app — runs npm test and npm run build, plays one full game in the browser, captures 1440px and 375px screenshots, and checks the console is clean.
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

### Devin Secrets Needed

None for local gameplay. The production preview is a standalone browser app
and does not require an account or backend credentials.
