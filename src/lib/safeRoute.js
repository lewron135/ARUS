import * as turf from '@turf/turf'
import { getRoute } from '../api/routeApi.js'

const DETOUR_BUFFER_DEGREES = 0.005
const TOO_LONG_RATIO = 2

function intersectsAnyFloodZone(lineGeometry, floodZones) {
  const line = turf.feature(lineGeometry)
  return floodZones.features.some((zone) => turf.booleanIntersects(line, zone))
}

function findIntersectingZone(lineGeometry, floodZones) {
  const line = turf.feature(lineGeometry)
  return floodZones.features.find((zone) => turf.booleanIntersects(line, zone))
}

// A single via-point only forces the route to pass near that point — OSRM
// is still free to cut back through the flood zone before or after it
// (verified live: a lone via-point north of a zone still produced a route
// that dipped back south through it). A two-point "shelf" that offsets the
// zone's entire bounding-box width (or height) to one side forces the whole
// crossing to happen outside it instead.
function detourShelves(zone) {
  const [minX, minY, maxX, maxY] = turf.bbox(zone)
  const b = DETOUR_BUFFER_DEGREES

  return [
    [{ lat: minY - b, lng: minX - b }, { lat: minY - b, lng: maxX + b }], // south shelf
    [{ lat: maxY + b, lng: minX - b }, { lat: maxY + b, lng: maxX + b }], // north shelf
    [{ lat: minY - b, lng: maxX + b }, { lat: maxY + b, lng: maxX + b }], // east shelf
    [{ lat: minY - b, lng: minX - b }, { lat: maxY + b, lng: minX - b }], // west shelf
  ]
}

function buildResult(geometry, normalGeometry) {
  const safeDistance = turf.length(turf.feature(geometry), { units: 'kilometers' })
  const normalDistance = turf.length(turf.feature(normalGeometry), { units: 'kilometers' })
  const tooLong = normalDistance > 0 && safeDistance / normalDistance > TOO_LONG_RATIO
  return { geometry, tooLong }
}

export async function findSafeRoute(start, end, normalGeometry, floodZones) {
  if (!intersectsAnyFloodZone(normalGeometry, floodZones)) {
    return buildResult(normalGeometry, normalGeometry)
  }

  const zone = findIntersectingZone(normalGeometry, floodZones)

  for (const viaPoints of detourShelves(zone)) {
    try {
      const candidateGeometry = await getRoute([start, ...viaPoints, end])
      if (!intersectsAnyFloodZone(candidateGeometry, floodZones)) {
        return buildResult(candidateGeometry, normalGeometry)
      }
    } catch {
      // OSRM couldn't route through these via points (e.g. over water/inaccessible) — try the next shelf.
    }
  }

  return null
}
