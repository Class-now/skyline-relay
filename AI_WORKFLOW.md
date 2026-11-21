# Building a booth game with an agent: what I handed off and what I kept

I'm a second-year university student in Tokyo studying foreign languages and cultures, not a game developer. I've stood in enough queues at esports events to know what a booth game has to do: explain itself in five seconds, end on time, and give the next person in line a reason to stay. Skyline Relay is my answer, and I built it with WebStorm and the Junie agent in a way I'd do again.

## 1. Write the rules before writing code

The most useful file in the repo is `.junie/guidelines.md`, and I wrote it before any game code existed. It holds the constraints a booth imposes: one input only, a round always ends on time, no third-party IP, touch targets of at least 64 px, every `localStorage` call wrapped in try/catch because kiosk browsers often run in private mode.

Every Junie task afterwards started from those rules, so I never had to repeat "don't add a second button" in a prompt. When an early version added a pause key, the fix was one line in the guidelines, not an argument in chat.

## 2. Small tasks with a check at the end

I gave Junie tasks I could verify in under a minute:

1. "Make a canvas that fills the window at device pixel ratio and draws a glider you can steer with one button."
2. "Add a seeded course generator: arcs of rings, updraft columns, storm cells. Same seed, same course."
3. "Add a 60-second clock and a results panel. No game over before the clock runs out."
4. "Add attract mode: after 20 s idle, the game flies itself toward the next ring and dodges storms."
5. "Add a daily top-10 board with three-letter initials, and a staff menu hidden behind a 2-second press."
6. From the Junie CLI: "Add a QR-free share line on the results screen: show 'Beat me at Skyline Relay — <score> pts' that can be copied with one tap. Follow .junie/guidelines.md and run the headless check it describes."

Each task ended with the same check from the guidelines: run a full round headless at desktop and phone sizes and show me the console. To make that fast, I asked for a test hook, `window.__skyline`, so a script can call `update(1/60)` 3,600 times and finish a round in milliseconds instead of a minute.

## 3. What the agent got wrong, and how I caught it

- **Hitboxes.** The first storm collision compared distances in world units, where one horizontal metre and one vertical unit are wildly different sizes. On a tall phone screen the glider died to clouds it had visibly cleared. I only noticed because I played on my own phone. The fix, now a guideline: compare in screen pixels.
- **Difficulty.** The first course spawned storms at a fixed rate. Watching attract mode for a few minutes made it obvious the late game was flat, so storms now get bigger and denser as distance grows.
- **A test that agreed with the bug.** For the share line, Junie wrote the feature and a thorough Playwright check (`tests/share_check.py`: real clipboard, a rejected clipboard API, a failed copy command, a full board, both screen sizes). Everything passed. But the line on screen read "Beat me at Skyline Relay ? 1445 pts": the em dash in my prompt had been turned into a question mark by the Windows terminal before Junie ever saw it, and the test asserted the same broken string, so it passed happily. A green check only proves the code matches what the agent understood. I now read the actual result screen, not just the test output, and the guidelines say to keep user-facing text in files rather than in shell prompts.
- **A side effect it caught for me.** In the same task Junie noticed that the game's Space handler swallowed the key on the results screen, so a keyboard player could not press the focused copy button. It limited that handler to the title, attract and play screens. I test on touch screens and would not have found it.
- **"Helpful" features.** Junie offered a pause button, a settings gear on the title screen and a tutorial overlay. All three break the booth flow, so all three went. Saying no to sensible additions was most of my job.

## 4. What I kept for myself

The agent wrote most of the lines. I made the calls that depended on knowing how a booth actually runs:

- 60 seconds, not 90: at the events I've been to, people won't wait more than two turns.
- Crashing costs your combo and your speed, never your turn. A first-timer still finishes the round and still gets a score worth writing initials for.
- The sky turning from day to sunset is the clock. Spectators behind the player don't read the HUD; they read colour.

## 5. Takeaways

- Put the constraints in the agent's guidelines file, not in each prompt.
- Ask for a test hook early. Fast checks are what let you hand over bigger tasks.
- Play on real hardware. The worst bug only showed up on a phone.
- Look at the screen, not just the test report. A test written from the same prompt shares the prompt's mistakes.
- An agent will happily add features. Deciding what the game should not do is still the developer's job.
