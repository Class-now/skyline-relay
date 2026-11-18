# Skyline Relay

A 60-second, one-button glider game built for esports event booths.
Hold to climb, release to dive, thread golden rings, ride updrafts and dodge storm cells.
Every visitor gets the same round length, the run always ends on time, and the day's top ten go on a booth leaderboard.

**Play it:** open `index.html` in any modern browser (desktop, tablet or phone). No install, no build step, no network needed once loaded.

Category: **Event Mini Game** — Cloud9 x JetBrains "Sky's The Limit" Hackathon 2026.

## Why it fits a booth

| Booth problem | What the game does |
|---|---|
| Queues move slowly | Fixed 60 s rounds (45 / 90 s from the staff menu). No game-over screen mid-round: crashing costs speed and combo, never the turn. |
| Visitors have never seen the game | One input. The title screen explains it in three lines; the first ring arc appears after about two seconds. |
| Nobody is playing | After 20 s idle the game flies itself (attract mode) with a big TAP TO PLAY banner. |
| People want to beat their friends | Daily top-10 board with three-letter initials, stored locally on the booth device and reset each day. |
| Staff need control | A hidden staff menu (hold the corner gear for 2 s): round length, sound on/off, attract mode on/off, clear today's board. |
| Mixed hardware | Canvas renders at device pixel ratio, scales to any screen, works with mouse, touch, Space or Up arrow. |

## How it plays

- **Hold** (pointer or Space): the glider pitches up and trades speed for height.
- **Release**: gravity takes over and diving builds speed back up.
- **Rings** come in short arcs. Each consecutive ring raises the combo (up to x8) and adds speed.
- **Updrafts** are blue columns that lift you for free.
- **Storm cells** stall the glider, halve its speed and reset the combo.
- Skimming the ground does the same, softer.
- The sky turns from day to sunset as the round runs out, so spectators can read the clock at a glance.

Score = distance flown + ring bonuses (25 × combo per ring).

## Code tour

| File | What is in it |
|---|---|
| `index.html` | Panels (title, results with initials, staff menu) and the HUD |
| `style.css` | Booth-sized type, high-contrast panels, touch targets of 64 px or more |
| `game.js` | Flight model, seeded course generator, collision, attract-mode autopilot, leaderboard, WebAudio sound effects |

The course generator is seeded per round (`mulberry32`-style PRNG), so a round can be replayed for testing. `window.__skyline` exposes the state and `update()` so automated checks can run a full round in milliseconds.

## Built with JetBrains tools

Built in WebStorm with the Junie coding agent. The `.idea/` and `.junie/` folders are committed so judges can see the project setup and the agent guidelines used during development. See `AI_WORKFLOW.md` for how the work was split between the developer and the agent.

## Licence

MIT — see `LICENSE`. All art is drawn in code; there are no third-party assets, team logos or game IP in this project.
