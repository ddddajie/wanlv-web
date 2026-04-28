import * as turf from '@turf/turf'

export function normalizePageResult(result) {
  return {
    total: Number(result?.total) || 0,
    records: Array.isArray(result?.records) ? result.records : [],
  }
}

export function formatDateTime(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatStatus(value) {
  return Number(value) === 1 ? '启用' : '停用'
}

export function formatDistance(meters) {
  if (!Number.isFinite(Number(meters))) return '-'

  const normalized = Number(meters)
  if (normalized >= 1000) {
    return `${(normalized / 1000).toFixed(2)} km`
  }

  return `${normalized.toFixed(0)} m`
}

export function parseJsonText(text, fallback = null) {
  if (!text && text !== 0) return fallback
  if (typeof text === 'object') return text

  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

export function stringifyJson(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

export function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null

  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

export function toNullableString(value) {
  if (value === null || value === undefined) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
}

export function cleanPayload(payload, numberFields = []) {
  const numberSet = new Set(numberFields)
  const nextPayload = {}

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (numberSet.has(key)) {
      nextPayload[key] = toNullableNumber(value)
      return
    }

    if (Array.isArray(value)) {
      nextPayload[key] = value
      return
    }

    if (typeof value === 'string') {
      nextPayload[key] = toNullableString(value)
      return
    }

    nextPayload[key] = value
  })

  return nextPayload
}

export function parseMapBounds(boundsJson) {
  const parsed = parseJsonText(boundsJson)
  if (!parsed) return null

  const west = toNullableNumber(parsed.west)
  const south = toNullableNumber(parsed.south)
  const east = toNullableNumber(parsed.east)
  const north = toNullableNumber(parsed.north)

  if ([west, south, east, north].some((item) => item === null)) {
    return null
  }

  return { west, south, east, north }
}

export function buildImageCoordinates(bounds) {
  if (!bounds) return null

  return [
    [bounds.west, bounds.north],
    [bounds.east, bounds.north],
    [bounds.east, bounds.south],
    [bounds.west, bounds.south],
  ]
}

export function toFeatureList(geojsonLike, extraProperties = {}) {
  const parsed = parseJsonText(geojsonLike)
  if (!parsed?.type) return []

  if (parsed.type === 'FeatureCollection') {
    return parsed.features.map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties || {}),
        ...extraProperties,
      },
    }))
  }

  if (parsed.type === 'Feature') {
    return [
      {
        ...parsed,
        properties: {
          ...(parsed.properties || {}),
          ...extraProperties,
        },
      },
    ]
  }

  return [
    {
      type: 'Feature',
      geometry: parsed,
      properties: extraProperties,
    },
  ]
}

export function buildSpotFeatureCollection(spots = []) {
  return {
    type: 'FeatureCollection',
    features: spots
      .filter((spot) => toNullableNumber(spot.longitude) !== null && toNullableNumber(spot.latitude) !== null)
      .map((spot) =>
        turf.point([Number(spot.longitude), Number(spot.latitude)], {
          id: spot.id,
          scenicAreaId: spot.scenicAreaId,
          spotName: spot.spotName,
          iconType: spot.iconType,
          poiType: spot.poiType,
          recommendedLevel: Number(spot.recommendedLevel) || 0,
          status: Number(spot.status) || 0,
        }),
      ),
  }
}

export function buildRouteFeatureCollection(routes = []) {
  return {
    type: 'FeatureCollection',
    features: routes.flatMap((route) =>
      toFeatureList(route.geojson, {
        id: route.id,
        scenicAreaId: route.scenicAreaId,
        routeName: route.routeName,
        routeType: route.routeType,
        geoVersion: route.geoVersion,
        status: Number(route.status) || 0,
      }),
    ),
  }
}

export function buildGeoFeatureCollection(features = []) {
  return {
    type: 'FeatureCollection',
    features: features.flatMap((feature) => {
      const extraProperties = parseJsonText(feature.propertiesJson, {})
      return toFeatureList(feature.geojson, {
        ...(extraProperties && !Array.isArray(extraProperties) ? extraProperties : {}),
        id: feature.id,
        scenicAreaId: feature.scenicAreaId,
        featureName: feature.featureName,
        featureType: feature.featureType,
        geometryType: feature.geometryType,
        featureSubType: feature.featureSubType,
        lengthMeters: toNullableNumber(feature.lengthMeters),
        propertiesJson: feature.propertiesJson,
        status: Number(feature.status) || 0,
        deleted: Number(feature.deleted) || 0,
      })
    }),
  }
}

function geometryMetrics(feature) {
  const geometryType = feature?.geometry?.type
  if (!geometryType) {
    return { types: [], lengthMeters: 0, areaSquareMeters: 0 }
  }

  let lengthMeters = 0
  let areaSquareMeters = 0

  if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
    lengthMeters = turf.length(feature, { units: 'kilometers' }) * 1000
  }

  if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
    areaSquareMeters = turf.area(feature)
  }

  return {
    types: [geometryType],
    lengthMeters,
    areaSquareMeters,
  }
}

export function summarizeGeojson(geojsonLike) {
  const features = toFeatureList(geojsonLike)
  if (!features.length) return null

  return features.reduce(
    (accumulator, feature) => {
      const metrics = geometryMetrics(feature)
      accumulator.featureCount += 1
      accumulator.lengthMeters += metrics.lengthMeters
      accumulator.areaSquareMeters += metrics.areaSquareMeters
      metrics.types.forEach((type) => accumulator.typeSet.add(type))
      return accumulator
    },
    {
      featureCount: 0,
      lengthMeters: 0,
      areaSquareMeters: 0,
      typeSet: new Set(),
    },
  )
}

export function summarizeRouteMeters(geojsonLike) {
  const summary = summarizeGeojson(geojsonLike)
  return summary ? summary.lengthMeters : 0
}

export function calculateDistanceMeters(fromLng, fromLat, toLng, toLat) {
  const values = [fromLng, fromLat, toLng, toLat].map((item) => toNullableNumber(item))
  if (values.some((item) => item === null)) return null

  const [aLng, aLat, bLng, bLat] = values

  return (
    turf.distance(turf.point([aLng, aLat]), turf.point([bLng, bLat]), {
      units: 'kilometers',
    }) * 1000
  )
}

export function createSessionId() {
  return `map-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function buildBoundsPolygonCoordinates(boundsJson) {
  const bounds = parseMapBounds(boundsJson)
  if (!bounds) return []

  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.south],
    [bounds.east, bounds.north],
    [bounds.west, bounds.north],
  ]
}

export function buildPolygonFeature(coordinates = []) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) return null

  return turf.polygon([[...coordinates, coordinates[0]]])
}

export function buildScenicDraftFromCoordinates(coordinates = []) {
  const polygon = buildPolygonFeature(coordinates)
  if (!polygon) return null

  const [west, south, east, north] = turf.bbox(polygon)
  const center = turf.center(polygon)
  const [centerLng, centerLat] = center.geometry.coordinates

  return {
    coordinates,
    longitude: centerLng,
    latitude: centerLat,
    mapCenterLng: centerLng,
    mapCenterLat: centerLat,
    mapBoundsJson: JSON.stringify(
      {
        west: Number(west.toFixed(6)),
        south: Number(south.toFixed(6)),
        east: Number(east.toFixed(6)),
        north: Number(north.toFixed(6)),
      },
      null,
      2,
    ),
  }
}
