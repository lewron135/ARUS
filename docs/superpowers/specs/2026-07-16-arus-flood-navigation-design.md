# ARUS — Flood-Aware Pedestrian Navigation (Jakarta)

## Purpose

30-hour hackathon project. Given a start and end point in Jakarta, show the
user two walking routes: the normal shortest route, and a "safe" route that
avoids active flood zones — so pedestrians can see at a glance whether their
usual path is flooded and what to take instead.

## Scope

Single-page app, no auth, no persistence, no routing library (one screen).
Manual testing only via dev server — no automated test suite, given the time
budget.

## Tech Stack

- React + Vite (existing scaffold in this repo, renamed from `arus-tmp` to `arus`)
- Leaflet + react-leaflet for the map
- CartoDB Dark Matter tiles (no API key)
- PetaBencana API for flood zones, with local fallback
- OSRM public routing server (foot profile) for walking directions
- Turf.js for route/flood-polygon intersection checks

## Architecture

Single `App.jsx` holds top-level state: `startPoint`, `endPoint`, `floodZones`,
`routes` (normal + safe), `error`/`warning` state.

### Components

- **`MapView.jsx`** — Leaflet map. Renders flood-zone polygons and up to two
  route lines. Click-to-place pins: first click sets start, second sets end,
  third click resets and starts over. Chosen over a text/address search box
  because it's faster to build and geocoding adds a third external
  dependency and failure mode we don't need for a demo.
- **`floodApi.js`** — `getFloodZones()`: fetches
  `https://data.petabencana.id/floods?admin=ID-JK&minimum_state=1&geoformat=geojson`.
  On network error, non-2xx, or CORS failure, falls back to the bundled
  `src/data/seedFloods.json` (already present in the repo) so the demo never
  shows an empty map.
- **`routeApi.js`** — `getRoutes(start, end)`: calls OSRM
  `https://router.project-osrm.org/route/v1/foot/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson&alternatives=true`.
  Returns the list of candidate route geometries OSRM provides.
- **`routeAnalysis.js`** — `pickRoutes(candidates, floodZones)`: the first
  OSRM candidate is always the "normal" route. Walks the remaining
  candidates and picks the first one whose line does NOT
  `turf.booleanIntersects` any flood polygon as the "safe" route. If no
  candidate avoids all flood zones, `safe` is `null` and the UI shows a
  warning instead of fabricating a route.

### Data Flow

1. User clicks two points on the map → start pin, end pin placed.
2. User clicks "Find Route".
3. `floodApi.getFloodZones()` runs (cached after first successful call this
   session) in parallel with `routeApi.getRoutes()`.
4. `routeAnalysis.pickRoutes()` determines normal vs. safe route.
5. Map renders: flood zones as red (`#FF4444`) polygons, normal route as
   dashed red line, safe route (if found) as solid teal (`#00E5A0`) line.

### Error Handling

- PetaBencana fetch fails → fall back to `seedFloods.json` silently (no user
  facing error — the seed data is a legitimate stand-in for the demo).
- OSRM fetch fails → inline error message near the route button; no route
  drawn.
- No flood-free alternative found among OSRM's candidates → warning banner
  ("No flood-free route found — showing the direct route") and only the
  normal route is drawn.

## Styling

- Background: `#1A1209` (dark warm)
- Safe route: `#00E5A0` (teal), solid line
- Normal/flood-risk route: `#FF4444` (red), dashed line
- Flood zone overlay: `#FF4444` fill, low opacity, over the dark tiles
- `frontend-design` skill guidance will be read before writing map/UI
  styling to keep this from looking like a default template.

## Out of Scope

- Address/text-based search (click-to-place only)
- User accounts, saved routes, history
- Automated tests
- Support for any city other than Jakarta
- Vehicle/transit routing (pedestrian only)
