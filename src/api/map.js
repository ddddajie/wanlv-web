import request from '@/utils/request'

export function createScenicAreaApi(data) {
  return request.post('/map/scenic-areas', data)
}

export function updateScenicAreaApi(data) {
  return request.put('/map/scenic-areas', data)
}

export function pageScenicAreasApi(params) {
  return request.get('/map/scenic-areas/page', { params })
}

export function getScenicAreaDetailApi(id) {
  return request.get(`/map/scenic-areas/${id}`)
}

export function createSpotApi(data) {
  return request.post('/map/spots', data)
}

export function updateSpotApi(data) {
  return request.put('/map/spots', data)
}

export function pageSpotsApi(params) {
  return request.get('/map/spots/page', { params })
}

export function getSpotDetailApi(id) {
  return request.get(`/map/spots/${id}`)
}

export function createRouteApi(data) {
  return request.post('/map/routes', data)
}

export function updateRouteApi(data) {
  return request.put('/map/routes', data)
}

export function pageRoutesApi(params) {
  return request.get('/map/routes/page', { params })
}

export function getRouteDetailApi(id) {
  return request.get(`/map/routes/${id}`)
}

/**
 * @typedef {Object} RouteGeoPayload
 * @property {number=} id
 * @property {number=} routeId
 * @property {number=} scenicAreaId
 * @property {string=} geojson
 * @property {number=} version
 * @property {number=} status
 */

/**
 * @param {RouteGeoPayload} data
 */
export function createRouteGeoApi(data) {
  return request.post('/map/route-geos', data)
}

/**
 * @param {RouteGeoPayload} data
 */
export function updateRouteGeoApi(data) {
  return request.put('/map/route-geos', data)
}

export function listRouteGeosApi(routeId) {
  return request.get(`/map/route-geos/route/${routeId}`)
}

export function generateRouteGeoApi(routeId, data) {
  return request.post(`/map/routes/${routeId}/geo/generate`, data)
}

export function createGeoFeatureApi(data) {
  return request.post('/map/geo-features', data)
}

export function updateGeoFeatureApi(data) {
  return request.put('/map/geo-features', data)
}

export function listGeoFeaturesApi(scenicAreaId) {
  return request.get('/map/geo-features', {
    params: { scenicAreaId },
  })
}

export function getMapInitApi(scenicAreaId) {
  return request.get(`/map/init/${scenicAreaId}`)
}

export function createInteractionLogApi(data) {
  return request.post('/map/interaction-logs', data)
}
