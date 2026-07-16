const PETABENCANA_URL =
  'https://data.petabencana.id/floods?admin=ID-JK&minimum_state=1&geoformat=geojson'

export async function getFloodZones() {
  const seed = (await import('../data/seedFloods.json')).default

  try {
    const res = await fetch(PETABENCANA_URL)
    if (!res.ok) throw new Error(`PetaBencana responded ${res.status}`)
    const json = await res.json()
    const liveFeatures = json?.result?.features
    if (!Array.isArray(liveFeatures)) throw new Error('Unexpected PetaBencana response shape')

    return {
      type: 'FeatureCollection',
      features: [...seed.features, ...liveFeatures],
    }
  } catch {
    return seed
  }
}
