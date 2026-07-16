const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot/'

export async function getRoute(points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}${coords}?overview=full&geometries=geojson`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM responded ${res.status}`)

  const json = await res.json()
  if (json.code !== 'Ok' || !json.routes?.[0]) {
    throw new Error(`OSRM could not find a route (code: ${json.code})`)
  }

  return json.routes[0].geometry
}
