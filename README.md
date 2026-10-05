# HacAUK presentations

Our own slide site. No install, no build: open `index.html` in a browser and pick a deck.

## Presenting

Open the deck, press **F** for fullscreen, then use the arrow keys, space, a clicker, or a click.

| Key | What it does |
| --- | --- |
| → / Space / click | Next step or slide |
| ← | Back |
| F | Fullscreen |
| O | All slides |
| S | Speaker view: notes, next slide, clock and pace (opens a second window that drives the main one) |
| D | Open the live demo for this slide (Shift+D opens the second one) |
| C | Copy the prompt on screen (press again for a follow-up prompt) |
| T | Start or pause the activity timer |
| R | Reset the timer (Shift+R resets the session clock) |
| B | Black out the screen |
| M | Calm motion / full motion |
| 1…9 then Enter | Jump to a slide |
| ? | Show every shortcut |

The session clock starts when you leave the first slide. Each slide has a planned length, so the
bottom bar and the speaker view tell you whether you are on pace.

Every deck also has a phone-friendly **prompt sheet**: add `?view=prompts` to the deck address
(or use the button on the home page). Share that link so the room can copy the prompts.

The fonts load from Google Fonts, so the first open needs internet. Without it the site still works
with fallback fonts.

## Adding a deck

1. Copy `decks/_template` to `decks/your-deck-name`.
2. Edit `index.html` in that folder. The comment at the top lists every attribute you can use.
3. Add an entry to `assets/js/decks.js` so it appears on the home page.

## What is where

```
index.html                     home page (the library)
assets/css/system.css          colours, type, the sun-and-rays backdrop, shared components
assets/css/deck.css            stage, slide motion, presenter tools
assets/js/engine.js            the deck engine
assets/js/fx.js                typewriter, timers, letter-by-letter titles, copy
assets/js/world.js             the backdrop markup
assets/js/decks.js             list of decks shown on the home page
decks/art-of-ai-prompting/     the first deck
decks/_template/               starter for new decks
demo/                          two sandbox pages for the Claude Code and Codex demo
```
