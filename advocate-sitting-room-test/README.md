# Sanctuary Sitting Room

Plain HTML, CSS, and JavaScript for the Oneness Wellness Sanctuary Sitting Room. The room is served at the site root. This folder's `index.html` redirects there.

## Pages URLs

- https://app.onenesswellnesslifestyles.com/
- https://app.onenesswellnesslifestyles.com/index.html

`/advocate-sitting-room-test/` and `/advocate-sitting-room-test/index.html` redirect to the same root path and keep `ref`, `via`, and the hash. Styles, scripts, the favicon, the header mark, and `og.jpg` use paths relative to the root, so both root URLs load the same room. The share image is:

`https://app.onenesswellnesslifestyles.com/og.jpg`

## Advocate test links

Each link uses `?ref=<Name>&via=person`. The full list is also in [LINKS.md](LINKS.md).

Theresa is the name string, matching the usual spelling in the advocate list. Teresa Borja and Theresa Borja are the same advocate.

- [Anton](https://app.onenesswellnesslifestyles.com/?ref=Anton&via=person)
- [Felicia](https://app.onenesswellnesslifestyles.com/?ref=Felicia&via=person)
- [Floyd](https://app.onenesswellnesslifestyles.com/?ref=Floyd&via=person)
- [Melinda](https://app.onenesswellnesslifestyles.com/?ref=Melinda&via=person)
- [Miniimah](https://app.onenesswellnesslifestyles.com/?ref=Miniimah&via=person)
- [Qaedah](https://app.onenesswellnesslifestyles.com/?ref=Qaedah&via=person)
- [Rashidi](https://app.onenesswellnesslifestyles.com/?ref=Rashidi&via=person)
- [Rita](https://app.onenesswellnesslifestyles.com/?ref=Rita&via=person)
- [Theresa](https://app.onenesswellnesslifestyles.com/?ref=Theresa&via=person) (Teresa Borja / Theresa Borja)
- [Wanda](https://app.onenesswellnesslifestyles.com/?ref=Wanda&via=person)

## Request flow

Landing copy: Wholeness Remembered / Aloha, beloved. Under that greeting, the featured download is The Roadmap to Wholeness, the fourteen-page Self-Healing Advocate guide (`The_Roadmap_to_Wholeness.pdf`). Beside it, Summer is a self-healing advocate for skin health questions, proof of lifestyle, and self-healing guidance. **Talk with Summer** opens https://t.me/adaptogentic_bot (`@adaptogentic_bot`). The Sanctuary is open. The Circle is not. A public sitting is one hour, live or virtual. First sitting, one hundred dollars. Follow-up, seventy-five. The Circle is by invitation and is not offered here.

When `ref`, `referrer`, or `from` is present and is not “No one”, the landing step says “{Name} sent you.” `via` or `how` pre-fills how the room was found: person, message, calendar, search or looked, unsure.

The request then asks for the felt sense, what has been tried, what a shift would mean, who sent the visitor and how they found the room, then name, a way to reach them, live or virtual, and an optional note. The held letter ends with **Send request**, which opens:

https://link.onenesswellnesslifestyles.com/widget/bookings/owlhcentersos

A draft is kept in `localStorage` under `oneness-sitting-request`:

```json
{
  "step": "stone",
  "request": {
    "sense": "",
    "body": "",
    "tried": "",
    "shift": "",
    "name": "",
    "reach": "",
    "mode": "",
    "note": "",
    "referrer": "",
    "found": ""
  }
}
```

`step` is one of `stone`, `body`, `tried`, `shift`, `source`, `reach`, `held`. An empty landing step removes the key. Release clears the words from this device and keeps the link’s referrer, if one was in the address.

## Assets

- `favicon.svg` — favicon.
- `icon.svg`, `icon-192.png`, `icon-512.png` — copied from `oneness-lifestyles-app/`.
- The header seal is the existing Oneness Wellness logo, `instagram/cards/breathe_logo.png`, shown small above Sanctuary. This repository has no `seal.png` and no `site.json`.
- `og.jpg` — 1200×630 share image.
- `The_Roadmap_to_Wholeness.pdf` — the fourteen-page guide at the site root. A browser opening the previous folder path is sent to that file:

`https://app.onenesswellnesslifestyles.com/The_Roadmap_to_Wholeness.pdf`

Palette: deep blue `#283890`, lime green `#6dbc45`, sand gold `#c1a178`, mist `#f7faff`.
