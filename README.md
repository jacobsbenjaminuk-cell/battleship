# battleship

[![CI](https://github.com/jacobsbenjaminuk-cell/battleship/actions/workflows/ci.yml/badge.svg)](https://github.com/jacobsbenjaminuk-cell/battleship/actions/workflows/ci.yml)

A player-vs-AI Battleship game: Vite + React + TypeScript (strict), Tailwind and
Vitest. Place your fleet by click or drag, press `R` to rotate, then trade shots
with the AI.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

Game rules live in `src/core` as plain TypeScript with no React imports; see
[AGENTS.md](AGENTS.md).
