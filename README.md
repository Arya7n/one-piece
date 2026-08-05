# Grand Line Archipelago

A Three.js One Piece–inspired open world where you play as Luffy and Zoro — explore islands, swim, smash barrels, and sail the Going Merry.

Built with Vite: Gear 5 stretch attacks, sword-slash VFX, collectibles, and a boardable pirate ship.

> Fan-made project for learning and fun. Not affiliated with Eiichiro Oda, Toei, or Shueisha.

## Features

- Play as **Luffy** or **Zoro** (switch anytime)
- Multi-island map with village, bridge, watchtower, and camp
- Swim in the ocean and walk the pier to board **Going Merry**
- Sail the ship across the archipelago
- Gear 5 mode, rubber punches, and Three Sword Style slash VFX
- Collect berries, open treasure chests, smash training barrels

## Controls

| Key | Action |
|-----|--------|
| `WASD` | Move / sail |
| `Shift` | Run (on land) |
| `F` / `Space` | Attack |
| `G` | Toggle Gear 5 (Luffy) |
| `E` | Board ship / open chests / interact |
| `H` | Recall Going Merry to the pier |
| `1` / `2` | Switch Luffy / Zoro |
| `B` | Toggle bloom |
| Drag | Orbit camera |

## Getting started

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build
npm run preview  # preview the build
```

## Tech stack

- [Three.js](https://threejs.org/)
- [Vite](https://vite.dev/)

## Project structure

```
src/
  main.js         # game loop, input, combat, ship boarding
  characters.js   # Luffy & Zoro builders + animations
  world.js        # islands, props, collectibles, Going Merry
  style.css       # HUD styles
```

## License

Code in this repo is yours to use and modify. Character designs and One Piece are copyright their respective owners — this is an unofficial fan project.
