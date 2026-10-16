# Web Control Modes Implementation Plan

**Goal:** Publish the approved OSOBNO / OSIE / AUTO switch to the Bluefy client.

**Architecture:** A small control-mode module maps wheel groups to existing protocol bits and serializes valve writes. app.js binds it to existing wheel buttons and a mode button. CSS indicates grouping. Existing GitHub Pages workflow publishes web/.

**Tech Stack:** Browser JavaScript modules, CSS, Node test runner, GitHub Pages.

## Tasks

- [ ] Add web/test/control-modes.test.js: assert masks for all wheels/directions, cycling, release ordering, stale-start cancellation and disconnect invalidation. Run `node --test test/control-modes.test.js`; expect missing-module failure before implementation.
- [ ] Add web/control-modes.js exposing `valveMask(mode, wheel, action)` and `ValveControl(writeMask)` with `start`, `stop`, `cycleMode`, `reset`; maintain an epoch and promise chain so obsolete starts never execute.
- [ ] Update web/app.js to own one active pointer, call ValveControl, clear holds on release, cancellation, capture loss, visibility change, mode change and disconnect. Display mode labels and grouping classes.
- [ ] Update web/index.html with an accessible mode button; append grouping and pressed-state styles to web/app.css.
- [ ] Run `npm test` in web, syntax checks and `git diff --check`. Review intended diff, stage only feature files, commit and push main in calka00/Air-web.
- [ ] Watch Deploy Bluefy web client workflow and verify public page contains the switch and new module.
