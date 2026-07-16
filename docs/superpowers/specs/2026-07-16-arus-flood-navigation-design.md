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
  The live response is `{ statusCode, result: { type: "FeatureCollection",
  features: [...] } }` (verified live) — the function unwraps `.result` and
  returns that FeatureCollection. Feature geometries are `MultiPolygon`
  with a top-level `properties.state`. On network error, non-2xx, or CORS
  failure, falls back to the bundled `src/data/seedFloods.json` (already
  present in the repo). This fallback is load-bearing, not cosmetic: live
  tested, the real API currently returns only a single flood report for
  all of Jakarta, so the seed data is what makes the demo showable.
- **`routeApi.js`** — `getRoute(points)`: calls OSRM
  `https://router.project-osrm.org/route/v1/foot/{lng1},{lat1};...;{lngN},{latN}?overview=full&geometries=geojson`
  where `points` is an array of 2+ `{lat, lng}` stops (start, optional via
  points, end). Returns the single route's LineString geometry. **Verified
  live against the public OSRM server**: `alternatives=true` and
  `alternatives=<n>` never produce more than one route (tested foot and
  driving profiles, short and long distances) — the original "pick a
  flood-free alternative from OSRM" design does not work against this
  server and has been replaced below.
- **`safeRoute.js`** — `findSafeRoute(start, end, normalGeometry, floodZones)`:
  if `normalGeometry` doesn't intersect any flood polygon
  (`turf.booleanIntersects`), returns it unchanged (no detour needed). If it
  does, takes the first intersecting flood zone, computes its bounding box
  (`turf.bbox`), expands it by a small buffer, and tries up to 4 via-point
  candidates (north/south/east/west of the expanded bbox, at its midpoint
  on that side) — requesting `getRoute([start, viaPoint, end])` for each and
  returning the first result that does NOT intersect any flood zone.
  Verified live: routing via a point just outside a flood zone's bbox
  produces a genuinely different, real street-following detour. If none of
  the 4 candidates avoid the flood zone, returns `null` and the UI shows a
  warning instead of fabricating a safe route.

### Data Flow

1. User clicks two points on the map → start pin, end pin placed.
2. User clicks "Find Route".
3. `floodApi.getFloodZones()` runs (cached after first successful call this
   session) in parallel with `routeApi.getRoute([start, end])` (the normal
   route).
4. `safeRoute.findSafeRoute()` determines the safe route, if any, using the
   via-waypoint detour described above.
5. Map renders: flood zones as red (`#FF4444`) polygons, normal route as
   dashed red line, safe route (if found and different from normal) as
   solid teal (`#00E5A0`) line.

### Error Handling

- PetaBencana fetch fails → fall back to `seedFloods.json` silently (no user
  facing error — the seed data is a legitimate stand-in for the demo).
- OSRM fetch fails → inline error message near the route button; no route
  drawn.
- Normal route doesn't cross any flood zone → it IS the safe route; drawn
  once as solid teal, no dashed line, no detour attempted.
- All 4 detour candidates still intersect a flood zone → warning banner
  ("No flood-free route found — showing the direct route") and only the
  normal route (dashed red) is drawn.

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
