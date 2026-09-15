# battleship

[![CI](https://github.com/jacobsbenjaminuk-cell/battleship/actions/workflows/ci.yml/badge.svg)](https://github.com/jacobsbenjaminuk-cell/battleship/actions/workflows/ci.yml)

A player-vs-AI Battleship game: Vite + React + TypeScript (strict), Tailwind and
Vitest. Place your fleet by click or drag, press `R` to rotate, pick how good
the enemy is, then trade shots with the AI.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
npm run bench    # 2,000 seeded games per difficulty, writes BENCHMARK.md
```

## Difficulties

All three read nothing but `view.shots` — their own shot history — so none of
them can see where your ships are.

| | Strategy | Median shots to win |
| --- | --- | --- |
| Easy | Uniform random over unfired cells | 97 |
| Medium | Parity hunt, then target: widens its stride to the smallest ship still afloat, extends along collinear hits | 51 |
| Hard | Probability density: counts every placement still consistent with its misses, hits and sunk hulls, fires the argmax | 44 |

See [BENCHMARK.md](BENCHMARK.md) for the full numbers and how they compare to
the DataGenetics figures.

## Fairness

The enemy fleet is dealt before your first shot, so the game publishes a SHA-256
of its layout plus a 32-byte random salt up front and reveals both when the
battle ends: rehash the reveal and you get the commitment. You can export the
whole game — seed, hash, salt, both layouts and every shot — as JSON. This all
lives in `src/ui` because Web Crypto is a DOM API and `src/core` stays DOM-free.

Game rules live in `src/core` as plain TypeScript with no React imports; see
[AGENTS.md](AGENTS.md).
