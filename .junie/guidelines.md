# Junie guidelines — Skyline Relay

## Project
A 60-second one-button glider game for esports event booths. Plain HTML/CSS/JS, no build step, no dependencies, no external assets.

## Hard rules
- Keep it dependency-free. Everything must run by opening `index.html` from disk.
- One input only: pointer down/up anywhere, or Space / Up arrow. Never add a second control.
- A round must always end on time. No mid-round game over.
- No third-party IP: no team logos, game characters, champion/agent names or ripped art. Draw everything in code.
- Touch targets ≥ 64 px; body text ≥ 15 px; must stay readable on a 10" tablet held at arm's length.
- Wrap every `localStorage` access in try/catch (kiosk browsers often run in private mode).

## Code style
- Single IIFE in `game.js`, `'use strict'`, 2-space indent, no semicolon-less style.
- World units: x in metres, y in 0..1 of playfield height. Convert to pixels only in draw code (`sx`, `sy`, `PX`).
- Collision checks compare in screen pixels so hitboxes match what the player sees.

## Testing
- `window.__skyline` exposes `state`, `update(dt)` and `startPlay()`. Drive a full round with `update(1/60)` in a loop instead of waiting in real time.
- Before finishing a task: run a full round headless at 1280×720 and 390×844 and confirm no console errors.
