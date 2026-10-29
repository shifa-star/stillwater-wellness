# Sanctuary Sitting Room

Temporary static test of the Oneness Wellness Sanctuary Sitting Room. Plain HTML, CSS, and JavaScript. It is meant to be served from this folder on the existing GitHub Pages site.

## Pages URLs

- https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/
- https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/index.html

Styles, scripts, the favicon, the header mark, and `og.jpg` use relative paths, so both URLs load the same room. The share image is declared as an absolute Pages URL for this folder:

`https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/og.jpg`

This folder does not add a custom domain. DNS for the live house is unchanged.

## Advocate test links

Each link uses `?ref=<Name>&via=person`. The full list is also in [LINKS.md](LINKS.md).

Theresa is the name string, matching the usual spelling in the advocate list. Teresa Borja and Theresa Borja are the same advocate.

- [Anton](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Anton&via=person)
- [Felicia](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Felicia&via=person)
- [Floyd](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Floyd&via=person)
- [Melinda](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Melinda&via=person)
- [Miniimah](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Miniimah&via=person)
- [Qaedah](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Qaedah&via=person)
- [Rashidi](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Rashidi&via=person)
- [Rita](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Rita&via=person)
- [Theresa](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Theresa&via=person) (Teresa Borja / Theresa Borja)
- [Wanda](https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/?ref=Wanda&via=person)

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
- The header seal is `icon.svg`. This repository has no `seal.png`.
- `og.jpg` — 1200×630 share image for this test path.
- `The_Roadmap_to_Wholeness.pdf` — the fourteen-page guide, served from this folder so Pages does not send advocates through a sign-in wall:

`https://shifa-star.github.io/stillwater-wellness/advocate-sitting-room-test/The_Roadmap_to_Wholeness.pdf`

Palette: deep blue `#283890`, lime green `#6dbc45`, sand gold `#c1a178`, mist `#f7faff`.
