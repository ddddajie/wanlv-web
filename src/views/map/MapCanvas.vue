<script setup>
import { createApp, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ForkSpoon,
  House,
  Location,
  MapLocation,
  OfficeBuilding,
  Place,
  Service,
  Shop,
  ToiletPaper,
  Van,
} from '@element-plus/icons-vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getBaseMapStyle } from './mapBaseConfig'
import {
  buildGeoFeatureCollection,
  buildImageCoordinates,
  buildRouteFeatureCollection,
  parseMapBounds,
} from './mapUtils'

const props = defineProps({
  mapData: {
    type: Object,
    default: null,
  },
  locationPicking: {
    type: Boolean,
    default: false,
  },
  pickedLocation: {
    type: Object,
    default: null,
  },
  pickedLocationLabel: {
    type: String,
    default: '当前选择位置',
  },
  visibleRouteIds: {
    type: Array,
    default: () => [],
  },
  showNativeControls: {
    type: Boolean,
    default: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['spot-click', 'route-click', 'location-pick'])

const BASE_SOURCE_ID = 'wanlv-map-base-source'
const BASE_LAYER_ID = 'wanlv-map-base-layer'
const SCENIC_BOUNDS_SOURCE_ID = 'wanlv-map-scenic-bounds-source'
const SCENIC_BOUNDS_FILL_LAYER_ID = 'wanlv-map-scenic-bounds-fill-layer'
const SCENIC_BOUNDS_LINE_LAYER_ID = 'wanlv-map-scenic-bounds-line-layer'
const FEATURE_SOURCE_ID = 'wanlv-map-feature-source'
const FEATURE_FILL_LAYER_ID = 'wanlv-map-feature-fill-layer'
const FEATURE_LINE_LAYER_ID = 'wanlv-map-feature-line-layer'
const FEATURE_POINT_LAYER_ID = 'wanlv-map-feature-point-layer'
const ROUTE_SOURCE_ID = 'wanlv-map-route-source'
const ROUTE_LAYER_ID = 'wanlv-map-route-layer'
const SPOT_LAYER_ID = 'wanlv-map-spot-layer'
const SPOT_OUTLINE_LAYER_ID = 'wanlv-map-spot-outline-layer'
const SPOT_SOURCE_ID = 'wanlv-map-spot-source'

const spotIconMap = {
  TRAFFIC: Van,
  LOCATION: Location,
  ENTRANCE: Place,
  SERVICE: Service,
  DINING: ForkSpoon,
  BUILDING: House,
  PARKING: Van,
  SCENIC_SPOT: MapLocation,
  SERVICE_CENTER: OfficeBuilding,
  RESTROOM: ToiletPaper,
  RESTAURANT: ForkSpoon,
  SHOP: Shop,
  TRANSPORT: Van,
}

const containerRef = ref(null)

let mapInstance = null
let resizeObserver = null
let spotMarkers = []
let geolocateControl = null
let userLocationMarker = null

function cleanupUserLocationMarker() {
  userLocationMarker?.remove()
  userLocationMarker = null
}

function renderUserLocationMarker(longitude, latitude) {
  if (!mapInstance || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return

  cleanupUserLocationMarker()

  const element = document.createElement('span')
  element.className = 'user-location-marker'
  element.title = '我的位置'

  userLocationMarker = new maplibregl.Marker({
    element,
    anchor: 'center',
  })
    .setLngLat([longitude, latitude])
    .addTo(mapInstance)
}

function resolveBeforeLayerId(beforeId) {
  return beforeId && mapInstance.getLayer(beforeId) ? beforeId : undefined
}

function ensureLayer(layerId, beforeId, createLayer) {
  if (!mapInstance.getLayer(layerId)) {
    mapInstance.addLayer(createLayer(), resolveBeforeLayerId(beforeId))
    return
  }

  const resolvedBeforeId = resolveBeforeLayerId(beforeId)
  if (resolvedBeforeId && resolvedBeforeId !== layerId) {
    mapInstance.moveLayer(layerId, resolvedBeforeId)
  }
}

function updateGeoJsonSource(sourceId, data) {
  if (mapInstance.getSource(sourceId)) {
    mapInstance.getSource(sourceId).setData(data)
    return
  }

  mapInstance.addSource(sourceId, {
    type: 'geojson',
    data,
  })
}

function removeLayerAndSource(layerId, sourceId) {
  if (mapInstance.getLayer(layerId)) {
    mapInstance.removeLayer(layerId)
  }

  if (sourceId && mapInstance.getSource(sourceId)) {
    mapInstance.removeSource(sourceId)
  }
}

function cleanupSpotMarkers() {
  spotMarkers.forEach(({ marker, app }) => {
    marker.remove()
    app.unmount()
  })
  spotMarkers = []
}

function removeScenicBoundsLayer() {
  if (mapInstance.getLayer(SCENIC_BOUNDS_LINE_LAYER_ID)) {
    mapInstance.removeLayer(SCENIC_BOUNDS_LINE_LAYER_ID)
  }

  if (mapInstance.getLayer(SCENIC_BOUNDS_FILL_LAYER_ID)) {
    mapInstance.removeLayer(SCENIC_BOUNDS_FILL_LAYER_ID)
  }

  if (mapInstance.getSource(SCENIC_BOUNDS_SOURCE_ID)) {
    mapInstance.removeSource(SCENIC_BOUNDS_SOURCE_ID)
  }
}

function buildScenicBoundsFeatureCollection(bounds) {
  if (!bounds) {
    return {
      type: 'FeatureCollection',
      features: [],
    }
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [bounds.west, bounds.south],
              [bounds.east, bounds.south],
              [bounds.east, bounds.north],
              [bounds.west, bounds.north],
              [bounds.west, bounds.south],
            ],
          ],
        },
        properties: {
          kind: 'scenicBounds',
        },
      },
    ],
  }
}

function renderBaseImage() {
  removeLayerAndSource(BASE_LAYER_ID, BASE_SOURCE_ID)

  const scenicArea = props.mapData?.scenicArea
  const bounds = parseMapBounds(scenicArea?.mapBoundsJson)
  const coordinates = buildImageCoordinates(bounds)

  if (!scenicArea?.mapBaseImageUrl || !coordinates) return

  mapInstance.addSource(BASE_SOURCE_ID, {
    type: 'image',
    url: scenicArea.mapBaseImageUrl,
    coordinates,
  })

  mapInstance.addLayer({
    id: BASE_LAYER_ID,
    type: 'raster',
    source: BASE_SOURCE_ID,
    paint: {
      'raster-opacity': 0.92,
      'raster-fade-duration': 0,
    },
  })
}

function renderScenicBounds() {
  const bounds = parseMapBounds(props.mapData?.scenicArea?.mapBoundsJson)
  if (!bounds) {
    removeScenicBoundsLayer()
    return
  }

  updateGeoJsonSource(SCENIC_BOUNDS_SOURCE_ID, buildScenicBoundsFeatureCollection(bounds))

  ensureLayer(SCENIC_BOUNDS_FILL_LAYER_ID, SCENIC_BOUNDS_LINE_LAYER_ID, () => ({
    id: SCENIC_BOUNDS_FILL_LAYER_ID,
    type: 'fill',
    source: SCENIC_BOUNDS_SOURCE_ID,
    paint: {
      'fill-color': '#2563eb',
      'fill-opacity': 0.08,
    },
  }))

  ensureLayer(SCENIC_BOUNDS_LINE_LAYER_ID, ROUTE_LAYER_ID, () => ({
    id: SCENIC_BOUNDS_LINE_LAYER_ID,
    type: 'line',
    source: SCENIC_BOUNDS_SOURCE_ID,
    paint: {
      'line-color': '#dc2626',
      'line-width': 3,
      'line-opacity': 0.95,
      'line-dasharray': [2, 1.2],
    },
  }))
}

function renderGeoFeatures() {
  const featureCollection = buildGeoFeatureCollection(props.mapData?.geoFeatures || [])
  updateGeoJsonSource(FEATURE_SOURCE_ID, featureCollection)

  ensureLayer(FEATURE_FILL_LAYER_ID, ROUTE_LAYER_ID, () => ({
    id: FEATURE_FILL_LAYER_ID,
    type: 'fill',
    source: FEATURE_SOURCE_ID,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'featureType'], 'ROAD']],
    paint: {
      'fill-color': [
        'match',
        ['get', 'featureType'],
        'BOUNDARY',
        '#2563eb',
        'RESTRICTED',
        '#ef4444',
        'ZONE',
        '#0f766e',
        'ENTRANCE_AREA',
        '#f59e0b',
        'ROAD',
        '#86efac',
        '#475569',
      ],
      'fill-opacity': 0.14,
    },
  }))

  ensureLayer(FEATURE_LINE_LAYER_ID, ROUTE_LAYER_ID, () => ({
    id: FEATURE_LINE_LAYER_ID,
    type: 'line',
    source: FEATURE_SOURCE_ID,
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'featureType'], 'ROAD'],
        [
          'match',
          ['get', 'featureSubType'],
          'WALK',
          '#cbd5e1',
          'DRIVE',
          '#fdba74',
          'TOUR',
          '#86efac',
          'SERVICE',
          '#93c5fd',
          '#86efac',
        ],
        [
          'match',
          ['get', 'featureType'],
          'BOUNDARY',
          '#1d4ed8',
          'RESTRICTED',
          '#dc2626',
          'ZONE',
          '#0f766e',
          'ENTRANCE_AREA',
          '#d97706',
          '#334155',
        ],
      ],
      'line-width': 2,
      'line-opacity': ['case', ['==', ['get', 'featureType'], 'ROAD'], 0.68, 0.82],
    },
  }))

  ensureLayer(FEATURE_POINT_LAYER_ID, ROUTE_LAYER_ID, () => ({
    id: FEATURE_POINT_LAYER_ID,
    type: 'circle',
    source: FEATURE_SOURCE_ID,
    filter: ['==', ['get', 'geometryType'], 'POINT'],
    paint: {
      'circle-color': [
        'match',
        ['get', 'featureType'],
        'BOUNDARY',
        '#1d4ed8',
        'RESTRICTED',
        '#dc2626',
        'ZONE',
        '#0f766e',
        'ENTRANCE_AREA',
        '#d97706',
        'ROAD',
        '#86efac',
        '#334155',
      ],
      'circle-radius': 5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-opacity': 0.82,
    },
  }))
}

function renderRoutes() {
  const visibleRouteIdSet = new Set((props.visibleRouteIds || []).map((item) => Number(item)))
  const routes = visibleRouteIdSet.size
    ? (props.mapData?.routes || []).filter((route) => visibleRouteIdSet.has(Number(route.id)))
    : []
  const featureCollection = buildRouteFeatureCollection(routes)
  updateGeoJsonSource(ROUTE_SOURCE_ID, featureCollection)

  ensureLayer(ROUTE_LAYER_ID, SPOT_OUTLINE_LAYER_ID, () => ({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: {
      'line-color': '#f97316',
      'line-width': 4,
      'line-opacity': 0.92,
    },
  }))
}

function createSpotMarker({ longitude, latitude, label, iconType, poiType, onClick, className = '' }) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return

  const element = document.createElement('button')
  element.type = 'button'
  element.className = `spot-marker ${className}`.trim()
  element.title = label || '景点'

  const labelElement = document.createElement('span')
  labelElement.className = 'spot-marker__label'
  labelElement.textContent = label || '未命名景点'
  const iconElement = document.createElement('span')
  iconElement.className = 'spot-marker__icon'

  element.append(labelElement, iconElement)

  const iconComponent = spotIconMap[iconType] || spotIconMap[poiType] || MapLocation
  const app = createApp({
    render() {
      return h(iconComponent)
    },
  })
  app.mount(iconElement)

  element.addEventListener('click', (event) => {
    event.stopPropagation()
    onClick?.()
  })

  const marker = new maplibregl.Marker({
    element,
    anchor: 'center',
  })
    .setLngLat([longitude, latitude])
    .addTo(mapInstance)

  spotMarkers.push({ marker, app })
}

function renderSpots() {
  cleanupSpotMarkers()
  removeLayerAndSource(SPOT_LAYER_ID)
  removeLayerAndSource(SPOT_OUTLINE_LAYER_ID, SPOT_SOURCE_ID)

  ;(props.mapData?.spots || []).forEach((spot) => {
    const longitude = Number(spot.longitude)
    const latitude = Number(spot.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return

    createSpotMarker({
      longitude,
      latitude,
      label: spot.spotName,
      iconType: spot.iconType,
      poiType: spot.poiType,
      onClick: () => {
        const entityId = Number(spot.id)
        if (Number.isFinite(entityId)) emit('spot-click', entityId)
      },
    })
  })

  const pickedLongitude = Number(props.pickedLocation?.longitude)
  const pickedLatitude = Number(props.pickedLocation?.latitude)
  if (props.locationPicking && Number.isFinite(pickedLongitude) && Number.isFinite(pickedLatitude)) {
    createSpotMarker({
      longitude: pickedLongitude,
      latitude: pickedLatitude,
      label: props.pickedLocationLabel,
      iconType: 'LOCATION',
      className: 'spot-marker--draft',
    })
  }
}

function toValidZoom(value) {
  const zoom = Number(value)
  return Number.isFinite(zoom) ? zoom : null
}

function clampZoom(zoom, minZoom, maxZoom) {
  if (zoom === null) return null

  let nextZoom = zoom
  if (minZoom !== null) nextZoom = Math.max(nextZoom, minZoom)
  if (maxZoom !== null) nextZoom = Math.min(nextZoom, maxZoom)
  return nextZoom
}

function getZoomConfig(scenicArea) {
  let minZoom = toValidZoom(scenicArea?.minZoom)
  let maxZoom = toValidZoom(scenicArea?.maxZoom)

  if (minZoom !== null && maxZoom !== null && minZoom > maxZoom) {
    ;[minZoom, maxZoom] = [maxZoom, minZoom]
  }

  return {
    defaultZoom: clampZoom(toValidZoom(scenicArea?.defaultZoom) ?? 14, minZoom, maxZoom),
    minZoom,
    maxZoom,
  }
}

function applyZoomLimits({ minZoom, maxZoom }) {
  mapInstance.setMaxZoom(24)
  mapInstance.setMinZoom(minZoom ?? 0)
  mapInstance.setMaxZoom(maxZoom ?? 24)
}

function fitMapView() {
  const scenicArea = props.mapData?.scenicArea
  const bounds = parseMapBounds(scenicArea?.mapBoundsJson)
  const zoomConfig = getZoomConfig(scenicArea)
  applyZoomLimits(zoomConfig)

  const pickedLongitude = Number(props.pickedLocation?.longitude)
  const pickedLatitude = Number(props.pickedLocation?.latitude)
  if (props.locationPicking && Number.isFinite(pickedLongitude) && Number.isFinite(pickedLatitude)) {
    mapInstance.jumpTo({
      center: [pickedLongitude, pickedLatitude],
      zoom: 15,
    })
    return
  }

  const centerLng = Number(scenicArea?.mapCenterLng)
  const centerLat = Number(scenicArea?.mapCenterLat)
  if (Number.isFinite(centerLng) && Number.isFinite(centerLat)) {
    mapInstance.jumpTo({
      center: [centerLng, centerLat],
      zoom: zoomConfig.defaultZoom ?? mapInstance.getZoom(),
    })
    return
  }

  if (bounds) {
    mapInstance.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: 40, duration: 0, maxZoom: zoomConfig.defaultZoom ?? zoomConfig.maxZoom ?? undefined },
    )
    return
  }
}

function renderAllLayers() {
  if (!mapInstance?.isStyleLoaded()) return

  renderBaseImage()
  renderGeoFeatures()
  renderScenicBounds()
  renderRoutes()
  renderSpots()
  fitMapView()
}

function handleMapClick(event) {
  if (!mapInstance) return

  if (props.locationPicking) {
    emit('location-pick', {
      longitude: Number(event.lngLat.lng.toFixed(6)),
      latitude: Number(event.lngLat.lat.toFixed(6)),
    })
    return
  }

  const features = mapInstance.queryRenderedFeatures(event.point, {
    layers: [ROUTE_LAYER_ID],
  })

  if (!features.length) return

  const target = features[0]
  const entityId = Number(target.properties?.id)
  if (!Number.isFinite(entityId)) return

  if (target.layer.id === ROUTE_LAYER_ID) {
    emit('route-click', entityId)
  }
}

function handlePointerMove(event) {
  if (!mapInstance) return

  const features = mapInstance.queryRenderedFeatures(event.point, {
    layers: [ROUTE_LAYER_ID],
  })

  mapInstance.getCanvas().style.cursor = features.length ? 'pointer' : ''
}

function initializeMap() {
  if (!containerRef.value) return

  mapInstance = new maplibregl.Map({
    container: containerRef.value,
    style: getBaseMapStyle(),
    center: [120.155161, 30.236581],
    zoom: 12,
    attributionControl: false,
    localIdeographFontFamily: 'Microsoft YaHei, Noto Sans CJK SC, sans-serif',
  })

  if (props.showNativeControls) {
    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
      fitBoundsOptions: {
        maxZoom: 17,
      },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
    })
    mapInstance.addControl(geolocateControl, 'top-right')
    geolocateControl.on('geolocate', (event) => {
      renderUserLocationMarker(event.coords.longitude, event.coords.latitude)
    })
  }
  mapInstance.on('load', renderAllLayers)
  mapInstance.on('click', handleMapClick)
  mapInstance.on('mousemove', handlePointerMove)

  resizeObserver = new ResizeObserver(() => {
    mapInstance?.resize()
  })
  resizeObserver.observe(containerRef.value)
}

watch(
  () => [props.mapData, props.locationPicking, props.pickedLocation, props.pickedLocationLabel, props.visibleRouteIds],
  () => {
    renderAllLayers()
  },
  { deep: true },
)

onMounted(() => {
  initializeMap()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cleanupSpotMarkers()
  cleanupUserLocationMarker()
  mapInstance?.remove()
  mapInstance = null
  geolocateControl = null
})

defineExpose({
  zoomIn() {
    mapInstance?.zoomIn()
  },
  zoomOut() {
    mapInstance?.zoomOut()
  },
  fitView() {
    if (!mapInstance) return
    fitMapView()
  },
  locate() {
    if (geolocateControl) {
      geolocateControl.trigger()
      return
    }

    if (!mapInstance || typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      renderUserLocationMarker(position.coords.longitude, position.coords.latitude)
      mapInstance?.flyTo({
        center: [position.coords.longitude, position.coords.latitude],
        zoom: Math.max(mapInstance.getZoom(), 16),
      })
    })
  },
  resize() {
    mapInstance?.resize()
  },
})
</script>

<template>
  <div ref="containerRef" class="map-canvas" :class="{ 'map-canvas--compact': compact }"></div>
</template>

<style scoped>
.map-canvas {
  width: 100%;
  height: 100%;
  min-height: 420px;
  border-radius: 28px;
  overflow: hidden;
}

.map-canvas--compact {
  min-height: 0;
  border-radius: 0;
}

:deep(.spot-marker) {
  display: inline-grid;
  grid-template-rows: auto auto;
  justify-items: center;
  align-items: center;
  gap: 2px;
  min-width: 64px;
  border: 0;
  padding: 0;
  background: transparent;
  color: #0f172a;
  font: 600 13px/1.2 "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  cursor: pointer;
}

:deep(.spot-marker__icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #0f766e;
  filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.95)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
}

:deep(.spot-marker__icon svg) {
  width: 28px;
  height: 28px;
}

:deep(.spot-marker__label) {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #0f172a;
  text-shadow:
    0 1px 0 #ffffff,
    1px 0 0 #ffffff,
    -1px 0 0 #ffffff,
    0 -1px 0 #ffffff;
  pointer-events: none;
}

:deep(.spot-marker--draft .spot-marker__icon) {
  color: #dc2626;
}

:deep(.spot-marker--draft .spot-marker__label) {
  color: #dc2626;
}

:deep(.user-location-marker) {
  display: block;
  width: 18px;
  height: 18px;
  border: 3px solid #ffffff;
  border-radius: 999px;
  background: #2563eb;
  box-shadow:
    0 0 0 8px rgba(37, 99, 235, 0.18),
    0 8px 18px rgba(15, 23, 42, 0.24);
}
</style>
