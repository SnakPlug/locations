# Old Vienna — Chicago Store Finder

A fast, mobile-first store locator that helps snack lovers find the
neighborhood markets, corner stores, and partners stocking **Old Vienna**
chips across Chicagoland.

🔗 **Live demo:** https://snakplug.github.io/locations/

> ⚠️ **Demo build.** This site ships with *sample* store data for
> demonstration purposes — every record is flagged `demo` and labeled in the
> UI. No real store inventory is published. See [Editing store data](#editing-store-data).

![Old Vienna Chicago Store Finder](docs/preview.png)

---

## Highlights

- **Mobile-first** — designed for phones first, with a full-screen
  List ⇄ Map toggle and large, thumb-friendly tap targets.
- **Find stores near you** — optional one-tap geolocation sorts stores by real
  distance and drops a "you are here" pin (nothing is sent to a server).
- **Search & filter** — instant search by store, neighborhood, or ZIP, plus
  area filters (North / West / South / Suburbs).
- **One-tap directions** — every store deep-links into Google Maps for turn-by-turn
  directions.
- **No build step, no API keys** — a single static page that runs anywhere and
  deploys straight to GitHub Pages.
- **Accessible** — keyboard-navigable cards, visible focus states, ARIA labels,
  and reduced-motion support.

## Tech stack

| Concern | Tool |
| --- | --- |
| Map | [Leaflet](https://leafletjs.com/) |
| Basemap tiles | [CARTO Voyager](https://carto.com/basemaps/) on [OpenStreetMap](https://www.openstreetmap.org/) data |
| Type | [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) + [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |
| Data | Plain [`locations.csv`](locations.csv) — edit in any spreadsheet |
| Hosting | [GitHub Pages](https://pages.github.com/) |

No framework, no bundler — just HTML, CSS, and vanilla JavaScript.

## Project structure

```
locations/
├── index.html        # Page markup
├── styles.css        # Design system + responsive layout
├── app.js            # Map, search, filters, geolocation
├── locations.csv     # Store data (edit this to add stores)
├── favicon.svg       # Brand mark
├── assets/           # Images (hero photo)
├── docs/             # README assets (preview image)
└── .nojekyll         # Tell GitHub Pages to serve files as-is
```

## Local development

No dependencies to install — serve the folder with any static file server:

```bash
python3 -m http.server 8087
```

Then open **http://127.0.0.1:8087**.

> To preview on a phone on the same Wi-Fi, bind to all interfaces
> (`python3 -m http.server 8087 --bind 0.0.0.0`) and visit
> `http://<your-computer-ip>:8087` from the phone.

## Editing store data

All stores live in [`locations.csv`](locations.csv). Edit it in any spreadsheet
or text editor and refresh — no rebuild required.

```csv
id,name,address,neighborhood,area,zip,lat,lng,hours,products,notes,demo
store-name-60600,Store Name,"123 Example Ave, Chicago, IL 60600",Neighborhood,north,60600,41.8781,-87.6298,Daily 9 AM-9 PM,"Old Vienna chips; Red Hot Riplets",Endcap display near checkout,false
```

| Column | Notes |
| --- | --- |
| `id` | Unique, URL-safe identifier |
| `name`, `address`, `neighborhood`, `zip` | Display text |
| `area` | One of `north`, `west`, `south`, `suburbs` (drives the filters) |
| `lat`, `lng` | Coordinates — used for the map pin and "near me" distance. Preferred so the site needs no geocoding API |
| `hours` | Free text, e.g. `Daily 9 AM-9 PM` |
| `products` | Semicolon-separated list, e.g. `Old Vienna chips; BBQ chips` |
| `notes` | Optional context shown on the card |
| `demo` | `true` shows the data is a sample; set `false` for real stores |

Tip: grab coordinates by right-clicking a spot in
[Google Maps](https://www.google.com/maps) → the lat/lng appears at the top.

## Deployment

The site is fully static and deploys to **GitHub Pages** with no build step.
Enable Pages in the repository settings
(**Settings → Pages**) and point it at this branch's root. Because
`index.html` uses relative paths, it works at a project sub-path
(`/locations/`) out of the box.

## License & data

Sample store data is fictional and for demonstration only. Brand assets belong
to their respective owners.

---

Designed & built as a demonstration of mobile-first web design and
brand-forward UX.
