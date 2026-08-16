# CHANGELOG — Stillwater Wellness / Oneness Lifestyles

Written by the merge train. One entry per merged batch, one atomic stamp:
version + tag + changelog + README + update-script. Append-only.

## 2026-08-15 — Oneness Lifestyles app lands (v2.0.0)

- Added `oneness-lifestyles-app/` — the wellness home PWA: Circle greeting,
  Daily Attunement Reading (three parts + Continue in Telegram), gentle
  check-in, six free gentle guides, Nia's passcode-gated daily self-check-in
  ritual, and the two deeper doors (@Onenesshealingbot, free 15-minute
  Attunement Conversation).
- PWA: manifest, offline service worker, installable, one codebase.
- The app carries the site's exact guide words, palette, and calm feel
  (verified by blind A/B against the reference, 2026-08-15).
- The Stillwater Wellness site and the A Slow-Down Series Instagram cards
  are unchanged and still served at the repo root.
- Placeholders (to fill before launch): n8n gateway address, Nia's passcode,
  the Attunement Conversation booking link, Mz. Felicia's statement bank
  and certification link.

## 2026-08-16 — Guide photos and the open door (v2.0.1)

- The six gentle guides now open with their card photos: Breathe, Move,
  Rest, Meditate, Visualize, Nourish — each page's hero shows the photo
  from the Circle's Instagram cards.
- The home door now opens onto an inviting image: a woman walking a
  sunlit garden path at golden hour (the way into the lodge), before the
  Circle's greeting. If a missing photo, each page falls back gracefully.

## 2026-08-16 — The welcome tree door (v2.0.2)

- The home page now shows the welcome tree with its door — the lodge's
  own photo — right before "Every door leads home." The portrait photo
  is sized for the web (720x1280), keeps its full shape, and the page
  falls back gracefully if the image is ever missing.

## 2026-08-16 — Cache refresh so the door photo appears everywhere (v2.0.3)

- The welcome tree door photo is in the app shell's offline cache, and the
  cache version was bumped so every phone and computer that has the app
  installed picks up the new home page (with the photo) automatically.

## 2026-08-16 — The welcome tree door stands alone (v2.0.4)

- Removed the golden-hour path photo from the top of the home page. The
  page now opens with the greeting, and the welcome tree door photo (above
  "Every door leads home.") is the one image on the home page.

## 2026-08-16 — bigger door photo + faded flowing-water backdrop (batch 6, v2.0.5)

- Shifa: "make the tree door image bigger and give it a faded background image of flowing water."
- .entry-photo max-width 400px → 560px (CSS only, no HTML change).
- New section backdrop: app/images/water-bg.jpg (1400x2046, web-optimized from
  her Krea water image) under a 90% white veil via .section.home-entry —
  reads as soft ambient water texture; text contrast stays >= 4.5:1.
- Service worker: CACHE_NAME shell-v2 → shell-v3, water-bg.jpg pre-cached so
  devices refresh after one load.

## 2026-08-16 — visible flowing water + the new entry words (batch 7, v2.0.6)

- Shifa: "The water is too faint. Let me see it like soft foam on sand ... Make
  it more visible." Also: change "Every door leads home" to "Every door leads
  to wholeness remembered."
- water-bg.jpg is now a brightened, foam-toned crop of her moonlit water image
  (1400x919, JPEG 72) — the water visibly flows, no people in frame.
- .section.home-entry veil: 90% → 55% white so the flow reads clearly; brand
  blue text on the pale foam still clears the WCAG 4.5:1 floor, and body text
  sits on white cards.
- Home entry heading now reads "Every door leads to wholeness remembered."
- Service worker: CACHE_NAME shell-v3 → shell-v4 so every device (including
  the computer that still showed the old photo layout) refreshes after one load.
