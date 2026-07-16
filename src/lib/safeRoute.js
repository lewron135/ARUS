import * as turf from '@turf/turf'
import { getRoute } from '../api/routeApi.js'

const DETOUR_BUFFER_DEGREES = 0.003

function intersectsAnyFloodZone(lineGeometry, floodZones) {
  const line = turf.feature(lineGeometry)
  return floodZones.features.some((zone) => turf.booleanIntersects(line, zone))
}

function findIntersectingZone(lineGeometry, floodZones) {
  const line = turf.feature(lineGeometry)
  return floodZones.features.find((zone) => turf.booleanIntersects(line, zone))
}

function detourCandidates(zone) {
  const [minX, minY, maxX, maxY] = turf.bbox(zone)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const b = DETOUR_BUFFER_DEGREES

  return [
    { lat: maxY + b, lng: midX }, // north
    { lat: minY - b, lng: midX }, // south
    { lat: midY, lng: maxX + b }, // east
    { lat: midY, lng: minX - b }, // west
  ]
}

export async function findSafeRoute(start, end, normalGeometry, floodZones) {
  if (!intersectsAnyFloodZone(normalGeometry, floodZones)) {
    return normalGeometry
  }

  const zone = findIntersectingZone(normalGeometry, floodZones)
  const candidates = detourCandidates(zone)

  for (const viaPoint of candidates) {
    try {
      const candidateGeometry = await getRoute([start, viaPoint, end])
      if (!intersectsAnyFloodZone(candidateGeometry, floodZones)) {
        return candidateGeometry
      }
    } catch {
      // OSRM couldn't route through this via point (e.g. it's over water/inaccessible) — try the next one.
    }
  }

  return null
}
