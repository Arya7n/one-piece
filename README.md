# Grand Line Archipelago

A Three.js One Piece–inspired open world where you play as Luffy and Zoro — explore islands, swim, smash barrels, and sail the Going Merry.

Built with Vite: Gear 5 stretch attacks, sword-slash VFX, collectibles, and a boardable pirate ship.

> Fan-made project for learning and fun. Not affiliated with Eiichiro Oda, Toei, or Shueisha.

## Features

- Play as the full **Straw Hat crew** (Luffy → Jinbe) — switch anytime; others idle on their own islands
- **Call crew (C)** gathers everyone to you; board Merry with whoever is nearby
- Large archipelago with **desert, winter, and sky** themed islands
- Swim, **dive (Ctrl)**, jump, climb, sail **Going Merry**
- **Ship cannons** (F while sailing) + night **lanterns**
- **Day / night cycle**
- Nami **rain & lightning** attack; Usopp **sniper zoom (V / RMB)**
- Sanji **cook station** (spend Berries for big heals / ATK feast)
- Rising **wanted bounty** poster; berries & barrels **respawn**
- Gear 5, unique attacks, Devil Fruits, chests, meat HP
- Zoro occasionally wanders off on his own
- Mobile virtual gamepad + HTML5 gamepad support
- Synthesized SFX (no audio files needed)

## Controls

| Key | Action |
|-----|--------|
| `WASD` | Move / sail |
| `Shift` | Run (on land) |
| `Space` | Jump / leap off climb |
| `F` | Attack / fire ship cannons |
| `V` / RMB | Usopp sniper aim (hold) |
| `Ctrl` | Dive underwater (while swimming) |
| `C` | Call all crew to you |
| `G` | Toggle Gear 5 (Luffy) |
| `E` | Board / cook / chests / meat |
| `H` | Recall Going Merry to the pier |
| `1`–`0` | Switch crew member |
| `[` `]` or `Q` `.` | Cycle crew |
| Hold `W` near tower/flag | Climb |
| `B` | Toggle bloom |
| Drag | Orbit camera |

On touch / narrow screens a virtual stick + buttons appear (A attack, J jump, E interact, G Gear 5, R run, ⇄ cycle).

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
  characters.js   # Straw Hat crew builders + animations
  world.js        # islands, props, collectibles, Going Merry
  audio.js        # Web Audio SFX
  gamepad.js      # mobile + physical gamepad
  systems.js      # weather, day/night, bubbles, bounty, cook
  style.css       # HUD + touch pad styles
```

## License

Code in this repo is yours to use and modify. Character designs and One Piece are copyright their respective owners — this is an unofficial fan project.
