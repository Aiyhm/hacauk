# HacAUK presentations

Our own slide site. No install, no build: open `index.html` in a browser and pick a deck.
Live at https://aiyhm.github.io/hacauk/

## Presenting

Open the deck, press **F** for fullscreen, then use the arrow keys, space, a clicker, or a click.
There is one mode only: what is on your screen is what the room sees, so it works with a mirrored display.
Every button on a slide (Copy, Open ChatGPT, …) is clickable.

| Key | What it does |
| --- | --- |
| → / Space / click | Next step or slide |
| ← | Back |
| F | Fullscreen |
| O | All slides |
| D | Open this slide's tool (Shift+D opens the second one) |
| C | Copy the prompt on screen (press again for the follow-up prompt) |
| B | Black out the screen |
| M | Calm motion / full motion |
| 1…9 then Enter | Jump to a slide |
| ? | Show every shortcut |

Move the mouse to show the bottom bar (back, next, all slides, fullscreen).

Every deck also has a phone-friendly **prompt sheet**: add `?view=prompts` to the deck address.
For the first deck the short link is https://aiyhm.github.io/hacauk/p (the QR code on the slides).

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
assets/css/deck.css            stage, slide motion, bottom bar, overview, prompt sheet
assets/js/engine.js            the deck engine
assets/js/fx.js                typewriter, letter-by-letter titles, copy
assets/js/world.js             the backdrop markup
assets/js/decks.js             list of decks shown on the home page
assets/img/logos/              tool logos (trademarks of their owners)
decks/art-of-ai-prompting/     the first deck
decks/_template/               starter for new decks
demo/                          two sandbox pages for the Claude Code and Codex demo
p/                             short link that opens the prompt sheet
```
