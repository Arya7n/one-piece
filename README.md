# One Piece World

A Three.js One Piece–inspired open world where you play as Luffy and Zoro — explore islands, swim, smash barrels, and sail the Going Merry.

Built with Vite: Gear 5 stretch attacks, sword-slash VFX, collectibles, and a boardable pirate ship.

> Fan-made project for learning and fun. Not affiliated with Eiichiro Oda, Toei, or Shueisha.

## Features

- Play as the full **Straw Hat crew** (Luffy → Jinbe) — switch anytime; others idle on their own islands
- **Call crew (C)** gathers everyone to you; board Merry with whoever is nearby
- Large archipelago with **desert, winter, and sky** themed islands
- **Desert ruins dungeon** — rune order puzzle + rare chest
- **Winter ice physics** — slippery ice + brazier lighting puzzle
- **Sky island wind pads** — step on for updrafts
- Cove shore rare chest (no diving required)
- Swim, **dive (X)**, jump, climb, sail **Going Merry**
- **Ship cannons** (F while sailing) + night **lanterns**
- **Day / night cycle**
- Nami **rain & lightning** attack; Usopp **sniper zoom (V / RMB)**
- Sanji **cook station** (spend Berries for big heals / ATK feast)
- Rising **wanted bounty** poster; berries & barrels **respawn**
- **Quest beats** (3 chests → unlock Boss Island → defeat Kaido)
- **Progress saves** automatically (chests, quest, bounty, puzzles)
- **Installable PWA** — add to desktop / home screen (web + mobile)
- **Third-person follow camera** (drag to look, scroll to zoom)
- Gear 5, unique attacks, Devil Fruits, chests, meat HP
- Zoro occasionally wanders off on his own
- Mobile virtual gamepad + HTML5 gamepad support
- Synthesized SFX (no audio files needed)

## Controls

| Key | Action |
|-----|--------|
| `WASD` | Move / sail |
| Drag / Scroll / Pinch | Look / zoom camera |
| `Shift` | Run (on land) |
| `Space` | Jump / leap off climb |
| `F` | Attack / fire ship cannons |
| `V` / RMB | Usopp sniper aim (hold) |
| `X` | Dive underwater (while swimming) |
| `C` | Call all crew to you |
| `G` | Toggle Gear 5 (Luffy) |
| `E` | Board / cook / chests / ruins / braziers / cave |
| `H` | Recall Going Merry to the pier |
| `1`–`0` | Switch crew member |
| `[` `]` or `Q` `.` | Cycle crew |
| Hold `W` near tower/flag | Climb |
| `B` | Toggle bloom / color grading |
| `P` / Spec | Spectator free-cam (no character control) |
| Guide button | Full in-game user guide |
| Drag | Orbit camera |

**Spectator:** WASD fly, Space/X up-down, drag/pinch look-zoom, `[` `]` watch a crewmate, number keys or Spec again to return to play.

On touch / narrow screens a virtual stick + buttons appear:
**stick** move, **A** attack, **E** interact, **J** jump, **⬇ hold** dive, **R** run, **G** Gear 5, **⇄** cycle, **📣** call, **👁** spectator.

## Install as an app (PWA)

This is a Progressive Web App — same game, installable on desktop and phones.

```bash
npm run build
npm run preview   # must be HTTPS or localhost for install
```

Then:

- **Desktop Chrome/Edge** — install icon in the address bar, or Guide → Install
- **Android** — browser menu → Install app / Add to Home screen
- **iPhone/iPad** — Safari Share → Add to Home Screen

Installed mode is fullscreen (fewer browser shortcut fights) and keeps your local save.

## Getting started

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build (+ service worker)
npm run preview  # preview the build / test install
```

## Tech stack

- [Three.js](https://threejs.org/)
- [Vite](https://vite.dev/) + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

## Project structure

```
src/
  main.js         # game loop, input, combat, ship boarding
  characters.js   # Straw Hat crew builders + animations
  world.js        # islands, props, collectibles, Going Merry
  audio.js        # Web Audio SFX
  gamepad.js      # mobile + physical gamepad
  systems.js      # weather, day/night, bubbles, bounty, cook
  gameui.js       # quest tracker
  save.js         # localStorage progress
  pwa.js          # install prompt helpers
  style.css       # HUD + touch pad styles
```

## License

Code in this repo is yours to use and modify. Character designs and One Piece are copyright their respective owners — this is an unofficial fan project.
