<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getBaseMapStyle } from './mapBaseConfig'
import {
  buildGeoFeatureCollection,
  buildImageCoordinates,
  buildRouteFeatureCollection,
  buildSpotFeatureCollection,
  parseMapBounds,
} from './mapUtils'

const props = defineProps({
  mapData: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['spot-click', 'route-click'])

const BASE_SOURCE_ID = 'wanlv-map-base-source'
const BASE_LAYER_ID = 'wanlv-map-base-layer'
const FEATURE_SOURCE_ID = 'wanlv-map-feature-source'
const FEATURE_FILL_LAYER_ID = 'wanlv-map-feature-fill-layer'
const FEATURE_LINE_LAYER_ID = 'wanlv-map-feature-line-layer'
const ROUTE_SOURCE_ID = 'wanlv-map-route-source'
const ROUTE_LAYER_ID = 'wanlv-map-route-layer'
const SPOT_SOURCE_ID = 'wanlv-map-spot-source'
const SPOT_LAYER_ID = 'wanlv-map-spot-layer'
const SPOT_OUTLINE_LAYER_ID = 'wanlv-map-spot-outline-layer'

const containerRef = ref(null)

let mapInstance = null
let resizeObserver = null

function ensureLayer(layerId, beforeId, createLayer) {
  if (!mapInstance.getLayer(layerId)) {
    mapInstance.addLayer(createLayer(), beforeId)
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

function renderGeoFeatures() {
  const featureCollection = buildGeoFeatureCollection(props.mapData?.geoFeatures || [])
  updateGeoJsonSource(FEATURE_SOURCE_ID, featureCollection)

  ensureLayer(FEATURE_FILL_LAYER_ID, ROUTE_LAYER_ID, () => ({
    id: FEATURE_FILL_LAYER_ID,
    type: 'fill',
    source: FEATURE_SOURCE_ID,
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
      'line-width': 2,
      'line-opacity': 0.9,
    },
  }))
}

function renderRoutes() {
  const featureCollection = buildRouteFeatureCollection(props.mapData?.routes || [])
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

function renderSpots() {
  const featureCollection = buildSpotFeatureCollection(props.mapData?.spots || [])
  updateGeoJsonSource(SPOT_SOURCE_ID, featureCollection)

  ensureLayer(SPOT_LAYER_ID, undefined, () => ({
    id: SPOT_LAYER_ID,
    type: 'circle',
    source: SPOT_SOURCE_ID,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 10],
      'circle-color': ['match', ['get', 'recommendedLevel'], 2, '#ef4444', 1, '#f59e0b', '#0f766e'],
      'circle-opacity': 0.95,
    },
  }))

  ensureLayer(SPOT_OUTLINE_LAYER_ID, undefined, () => ({
    id: SPOT_OUTLINE_LAYER_ID,
    type: 'circle',
    source: SPOT_SOURCE_ID,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 14, 12],
      'circle-color': '#ffffff',
      'circle-opacity': 0.4,
    },
  }))
}

function fitMapView() {
  const scenicArea = props.mapData?.scenicArea
  const bounds = parseMapBounds(scenicArea?.mapBoundsJson)

  if (bounds) {
    mapInstance.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: 40, duration: 0 },
    )
    return
  }

  if (scenicArea?.mapCenterLng != null && scenicArea?.mapCenterLat != null) {
    mapInstance.jumpTo({
      center: [Number(scenicArea.mapCenterLng), Number(scenicArea.mapCenterLat)],
      zoom: Number(scenicArea.defaultZoom) || 14,
    })
  }
}

function renderAllLayers() {
  if (!mapInstance?.isStyleLoaded()) return

  renderBaseImage()
  renderGeoFeatures()
  renderRoutes()
  renderSpots()
  fitMapView()
}

function handleMapClick(event) {
  if (!mapInstance) return

  const features = mapInstance.queryRenderedFeatures(event.point, {
    layers: [SPOT_LAYER_ID, ROUTE_LAYER_ID],
  })

  if (!features.length) return

  const target = features[0]
  const entityId = Number(target.properties?.id)
  if (!Number.isFinite(entityId)) return

  if (target.layer.id === SPOT_LAYER_ID) {
    emit('spot-click', entityId)
    return
  }

  if (target.layer.id === ROUTE_LAYER_ID) {
    emit('route-click', entityId)
  }
}

function handlePointerMove(event) {
  if (!mapInstance) return

  const features = mapInstance.queryRenderedFeatures(event.point, {
    layers: [SPOT_LAYER_ID, ROUTE_LAYER_ID],
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

  mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  mapInstance.on('load', renderAllLayers)
  mapInstance.on('click', handleMapClick)
  mapInstance.on('mousemove', handlePointerMove)

  resizeObserver = new ResizeObserver(() => {
    mapInstance?.resize()
  })
  resizeObserver.observe(containerRef.value)
}

watch(
  () => props.mapData,
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
  mapInstance?.remove()
  mapInstance = null
})
</script>

<template>
  <div ref="containerRef" class="map-canvas"></div>
</template>

<style scoped>
.map-canvas {
  width: 100%;
  height: 100%;
  min-height: 420px;
  border-radius: 28px;
  overflow: hidden;
}
</style>
