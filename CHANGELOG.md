## 2026-08-23 — batch 20, v2.0.19 — the gentle medical note

- Shifa: "need to add a gentle medical disclaimer to the site. small
  print on The Daily Attunement Reading page under the caution. and on
  footer of every page."
- **The Daily Attunement Reading page**, small print directly under the
  Caution block: "This is a gentle mirror, not a diagnosis. The readings
  and remedies are for reflection, not medical care. If something feels
  heavy or urgent, please reach out to someone you trust, a qualified
  professional, or to a crisis line near you."
- **The footer of every page** (all 13 pages), small print in the same
  gentle voice: "Shifa Ali Scott, Indigenous Natural Health and
  Self-Healing Guide, sharing the ancestral Cherokee-Choctaw Mayan-Olmec
  lineage medicine wheel — gentle wisdom for reflection, not medical
  advice, diagnosis, or treatment."
- The note is styled quiet and small (about 14px on the brand blue
  footer), centered, and it is always visible — it does not depend on
  JavaScript.
- Service worker: CACHE_NAME shell-v10 -> shell-v11.
- Applied inline by the conductor per the standing small-change doctrine —
  verified in Chrome: both notes render on the reading page (one under
  the caution, one in the footer), and the footer note renders on the
  home page. Changed files: all 13 HTML pages, all 9 stylesheets, sw.js.

## 2026-08-23 — batch 19, v2.0.18 — only the video

- Shifa: "the image and the video are showing on the page. i only want
  the video." — the page was already the new one; her device was holding
  the previous version's stylesheet, which still showed the photo.
- The tree photo is now hidden by the stylesheet: **the video is the only
  visual** on the home page. The photo element stays in the page as a
  one-load strut (so a device that still holds the old stylesheet shows
  the photo and video exactly stacked, never side by side) and its poster
  still shows while the video loads.
- The frame now holds the video's own shape (portrait 540x960), so the
  page keeps its height from the very first paint.
- Reduced motion (a phone setting): the video stays still and its calm
  poster — the tree photo — shows instead. No one sees a blank space.
- Service worker: CACHE_NAME shell-v9 -> shell-v10.
- Applied inline by the conductor per the standing small-change doctrine —
  verified in Chrome: photo hidden, video playing and looping, frame holds
  its shape; reduced-motion shows the still poster. Changed files:
  index.html, app.css, sw.js.

## 2026-08-23 — batch 18, v2.0.17 — the welcome tree door comes alive

- The welcome tree photo at the top of the home page is now a living
  video: Shifa's own phone footage of the walk into the lodge — a golden
  sunlit path through the trees, right before "Every door leads to
  wholeness remembered."
- The video loops softly, plays silently (muted), starts on its own, and
  is sized for phones (540x960, about 1.2 MB) so it loads quickly on any
  connection.
- The tree photo is still there beneath the video: it is the poster that
  shows while the video loads, and it returns for anyone whose phone is
  set to prefer reduced motion (their setting is respected) and for
  devices that cannot play video.
- Service worker: CACHE_NAME shell-v8 -> shell-v9, door11-video.mp4
  pre-cached so every device refreshes after one load.
- Applied inline by the conductor per the standing small-change doctrine
  (same lane as Waves 6-16) — verified in Chrome: the video plays and
  loops; the reduced-motion check shows the calm photo. Changed files:
  index.html, app.css, sw.js, images/door11-video.mp4 (new).

## 2026-08-21 — batch 17, v2.0.16 — the Wellness Survey

- A new door opens: **the Wellness Survey** — the app's first client-facing
  form, a place where people can share how they have been, gently.
- Step 1 is an **opt-in**: name, email, and a consent checkbox ("Send me
  one gentle reminder when the wheel turns"). The questionnaire stays
  closed until the person freely opts in; a clear privacy note explains
  that nothing leaves their phone without their say-so.
- Step 2 is the **questionnaire**: ten gentle multiple-choice questions
  (sleep, energy, digestion, mood, movement, stress, tenderness, water,
  what is calling for care, what they hope for), each with a soft hint
  line so the question always makes sense. Answers are stored only on the
  device, under oneness.wellness-survey.v1.
- **Optional upload**: a photo, food diary, or scan (up to 15 MB) stays
  private on the person's own phone, held in IndexedDB (oneness-files).
  It is never sent anywhere.
- **Quiet visit counting**: the app counts first visit, last visit, and
  return visits — purely on-device, as encouragement ("Welcome back,
  {name}. The Circle is glad you have returned."), never as a network
  call and never as harassment.
- Returning visitors are welcomed by name, with the form prefilled and a
  note that they have shared before.
- The three-day gentle email ("Aloha. Three days ago you shared your
  wellness with the Circle...") is designed and agreed, and lives in
  GoHighLevel — wired later through the reserved config.js GATEWAY_URL
  gateway. **This build sends no email and no network requests**; the
  page works fully offline, like the rest of the app.
- Accessibility: every question is a real radio group (arrow keys move,
  Tab leaves, screen readers announce), with a visible focus ring; all
  gentle feedback is announced live.
- Built by a dispatched builder + paired judge workflow (2 agents,
  seat-pinned) — PASS on all checks (35/35 E2E browser checks, including
  the keyboard-only pass and the privacy proof: zero external network
  requests, zero XHR/fetch). Changed files: wellness.html (new),
  wellness.css (new), index.html, sw.js (shell-v7 -> shell-v8).

## 2026-08-16 — batch 16, v2.0.15 — the 28-day Perpetual Medicine Wheel

- Shifa's 28-day Perpetual Medicine document (the medicine wheel) has
  arrived, been extracted from her PDF, and built into the app.
- The Daily Attunement Reading now always shows today's wheel reading on
  the 28-day moon cycle: "DAY N | Medicine Wheel Reading" as the reading
  heading, then the three parts — the radial plasma signature, the
  affirmation (with its heptad note where the spoke carries one), and the
  Remedy of the Day (name, what it is for, and its caution).
- Day of cycle: whole calendar days since the anchor day (Day 1 = July 26,
  2026, the 13 Moon calendar year start) mod 28, plus 1. The wheel's 28
  spokes repeat every 28 days, every moon.
- Today (2026-08-15) is Day 21 — Spoke 21, Golden Milk.
- New app file medicine-wheel.js carries the 28 spoke readings, cleaned
  and verified from the source document (all 28 present, heptad notes only
  where the source has them, no invented content).
- The gateway path is preserved: when config.js GATEWAY_URL is filled, the
  page fetches it first as before; the built-in wheel is the always-on
  fallback (and the current behavior while the gateway is empty).
- Service worker: CACHE_NAME shell-v6 -> shell-v7, medicine-wheel.js
  pre-cached so every device refreshes after one load.
- Built by a dispatched builder + paired judge workflow (2 agents,
  seat-pinned) — PASS on all checks. Changed files: medicine-wheel.js
  (new), reading.html, reading.css, sw.js.

# CHANGELOG — Oneness Lifestyles · Where the Healing Waters Flow

Written by the merge train. One entry per merged batch, one atomic stamp:
version + tag + changelog + README + update-script. Append-only.

## 2026-08-16 — batch 15, v2.0.14 — Aloha with a palm tree

- The greeting now opens with Aloha standing alone, a small palm tree
  beside it, then the rest on their own lines, per Shifa:
  line 1: Aloha 🌴
  line 2: In Lak'ech Ala K'in
  line 3: I am another yourself.
  line 4: We are One.
  line 5: A New Covenant...
- Fixed by a dispatched builder + paired judge workflow (2 agents,
  seat-pinned) — PASS.
- Changed file: index.html.

## 2026-08-16 — batch 14, v2.0.13 — greeting on four lines

- The home opening greeting now rests on four lines, per Shifa, so it
  renders symmetrically on the phone:
  line 1: Aloha, In Lak'ech Ala K'in:
  line 2: I am another yourself.
  line 3: We are One.
  line 4: A New Covenant...
- Same words as before, only the line breaks changed.
- Fixed by a dispatched builder + paired judge workflow (2 agents,
  seat-pinned) — PASS.
- Changed file: index.html.

## 2026-08-16 — batch 13, v2.0.12 — Indigenous Circle Lodge

- The home welcome now reads: "You have entered the Indigenous Circle
  Lodge of Oneness Wellness Lifestyles, where wellness is not purchased
  but remembered." — per Shifa, verbatim.
- Fixed by a dispatched builder + paired judge workflow (2 agents,
  seat-pinned) — PASS.
- Changed file: index.html.

## 2026-08-16 — batch 12, v2.0.11 — home greeting in three lines

- The home opening greeting now stands on exactly three lines, per Shifa:
  line 1: Aloha, In Lak'ech Ala K'in:
  line 2: I am another yourself. We are One.
  line 3: A New Covenant...
- The Daily Attunement Reading runs on a 28-day moon cycle: 28 readings
  that repeat every 28 days (not 365, not a 13 Moon count). The medicine
  wheel readings document is coming from Shifa; the reading surface keeps
  its calm waiting state until the document lands.
- Fixed by a dispatched builder + paired judge workflow (2 agents,
  seat-pinned) — PASS.
- Changed file: index.html.

## 2026-08-16 — batch 8, v2.0.7 — video water backdrop + deeper doors copy

- The home entry background is now a LOOPING VIDEO of waves washing onto
  the shore (top-down aerial footage, Wikimedia Commons, CC licensed) —
  no moon, no stars, no person, pure water and sand, per Shifa.
  `images/water-bg.mp4` (720x404 h264, ~1.4 MB, 12 s, crossfaded to loop
  seamlessly). Muted + autoplay + playsinline so it plays on phones;
  `prefers-reduced-motion` shows the calm still frame instead.
- `images/water-bg.jpg` replaced with a clean poster still from the same
  footage (no figure, no sky) — the no-JS / pre-load / reduced-motion
  fallback.
- The entry section positions the video absolutely behind the cards with
  a light veil (same soft-foam look as before), text contrast unchanged
  (>= 4.5:1).
- Service worker cache bumped to `oneness-lifestyles-shell-v5` and the
  video is part of the offline shell.
- Copy change: "You are a founding member of this Circle. What grows
  here, grows because you stood in it first." → "What grows here, grows
  because you stood in it now." (app is for everyone, not only founding
  members — per Shifa).
- Copy change: deeper doors subheading "The web opens wider here."
  → "The door to wholeness remembered opens wider here." (kept "Two
  doors wait — each warm, each open, each yours." unchanged).
- Changed files: index.html, app.css, sw.js, images/water-bg.mp4,
  images/water-bg.jpg, deeper-doors.html.
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

## 2026-08-15 — apparatus audit passed (batch 0)

- Apparatus authored (GOAL, SCOPE, MASTER-SPEC, CHECKLIST, TODO, LEDGER,
  QUALITY-CONTROL-RULEBOOK, LOOPS, DECISIONS, LAUNCH-COMMAND, dispatch-log,
  HEARTBEAT, MORNING-REPORT, CURRENT-STATE, EXECUTION-PLAN,
  PROJECT-MANIFEST; CAPACITY-LEDGER; CONTROL/project_state).
- Frozen reference captured (the Stillwater Wellness site, six guides).
- Independent audit (Law 30) returned FAIL 7.82 → fixes → re-audit 8.41 →
  fixes (m5) → re-audit PASS (final ≥ 8.5).
- No code merged yet — build not dispatched; batch 0 was apparatus-only.

## 2026-08-15 — project started

- (Seed row; superseded by the batch-0 entry above.)
