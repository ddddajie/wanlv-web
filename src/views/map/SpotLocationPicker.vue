<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import { getBaseMapStyle } from './mapBaseConfig'
import { buildImageCoordinates, parseMapBounds, toNullableNumber } from './mapUtils'

const props = defineProps({
  scenicArea: {
    type: Object,
    default: null,
  },
  spots: {
    type: Array,
    default: () => [],
  },
  longitude: {
    type: [Number, String, null],
    default: null,
  },
  latitude: {
    type: [Number, String, null],
    default: null,
  },
  label: {
    type: String,
    default: '当前选择位置',
  },
})

const emit = defineEmits(['location-change'])

const BASE_SOURCE_ID = 'wanlv-spot-picker-base-source'
const BASE_LAYER_ID = 'wanlv-spot-picker-base-layer'
const BOUNDS_SOURCE_ID = 'wanlv-spot-picker-bounds-source'
const BOUNDS_FILL_LAYER_ID = 'wanlv-spot-picker-bounds-fill-layer'
const BOUNDS_LINE_LAYER_ID = 'wanlv-spot-picker-bounds-line-layer'
const SPOTS_SOURCE_ID = 'wanlv-spot-picker-spots-source'
const SPOTS_LAYER_ID = 'wanlv-spot-picker-spots-layer'
const SPOTS_LABEL_LAYER_ID = 'wanlv-spot-picker-spots-label-layer'
const PICKED_SOURCE_ID = 'wanlv-spot-picker-picked-source'
const PICKED_LAYER_ID = 'wanlv-spot-picker-picked-layer'
const PICKED_LABEL_LAYER_ID = 'wanlv-spot-picker-picked-label-layer'

const CHINA_CENTER = [104.195397, 35.86166]
const CHINA_BOUNDS = [
  [73.0, 18.0],
  [135.0, 54.0],
]

const containerRef = ref(null)

let mapInstance = null
let resizeObserver = null

function emptyFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
  }
}

function buildBoundsFeatureCollection() {
  const bounds = parseMapBounds(props.scenicArea?.mapBoundsJson)
  if (!bounds) return emptyFeatureCollection()

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
        properties: {},
      },
    ],
  }
}

function buildSpotsFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: props.spots
      .filter((spot) => toNullableNumber(spot.longitude) !== null && toNullableNumber(spot.latitude) !== null)
      .map((spot) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [toNullableNumber(spot.longitude), toNullableNumber(spot.latitude)],
        },
        properties: {
          id: spot.id,
          spotName: spot.spotName || '未命名景点',
        },
      })),
  }
}

function buildPickedFeatureCollection() {
  const longitude = toNullableNumber(props.longitude)
  const latitude = toNullableNumber(props.latitude)
  if (longitude === null || latitude === null) return emptyFeatureCollection()

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        properties: {
          spotName: props.label || '当前选择位置',
        },
      },
    ],
  }
}

function setGeoJsonSource(sourceId, data) {
  const source = mapInstance?.getSource(sourceId)
  if (source) {
    source.setData(data)
    return
  }

  mapInstance?.addSource(sourceId, {
    type: 'geojson',
    data,
  })
}

function removeLayerAndSource(layerId, sourceId) {
  if (mapInstance?.getLayer(layerId)) {
    mapInstance.removeLayer(layerId)
  }

  if (sourceId && mapInstance?.getSource(sourceId)) {
    mapInstance.removeSource(sourceId)
  }
}

function renderBaseImage() {
  removeLayerAndSource(BASE_LAYER_ID, BASE_SOURCE_ID)

  const bounds = parseMapBounds(props.scenicArea?.mapBoundsJson)
  const coordinates = buildImageCoordinates(bounds)
  if (!props.scenicArea?.mapBaseImageUrl || !coordinates) return

  mapInstance.addSource(BASE_SOURCE_ID, {
    type: 'image',
    url: props.scenicArea.mapBaseImageUrl,
    coordinates,
  })

  mapInstance.addLayer(
    {
      id: BASE_LAYER_ID,
      type: 'raster',
      source: BASE_SOURCE_ID,
      paint: {
        'raster-opacity': 0.92,
        'raster-fade-duration': 0,
      },
    },
    BOUNDS_FILL_LAYER_ID,
  )
}

function renderBounds() {
  setGeoJsonSource(BOUNDS_SOURCE_ID, buildBoundsFeatureCollection())

  if (!mapInstance.getLayer(BOUNDS_FILL_LAYER_ID)) {
    mapInstance.addLayer({
      id: BOUNDS_FILL_LAYER_ID,
      type: 'fill',
      source: BOUNDS_SOURCE_ID,
      paint: {
        'fill-color': '#2563eb',
        'fill-opacity': 0.08,
      },
    })
  }

  if (!mapInstance.getLayer(BOUNDS_LINE_LAYER_ID)) {
    mapInstance.addLayer({
      id: BOUNDS_LINE_LAYER_ID,
      type: 'line',
      source: BOUNDS_SOURCE_ID,
      paint: {
        'line-color': '#dc2626',
        'line-width': 2.5,
        'line-opacity': 0.95,
        'line-dasharray': [2, 1.2],
      },
    })
  }
}

function renderSpots() {
  setGeoJsonSource(SPOTS_SOURCE_ID, buildSpotsFeatureCollection())

  if (!mapInstance.getLayer(SPOTS_LAYER_ID)) {
    mapInstance.addLayer({
      id: SPOTS_LAYER_ID,
      type: 'circle',
      source: SPOTS_SOURCE_ID,
      paint: {
        'circle-radius': 6,
        'circle-color': '#0f766e',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })
  }

  if (!mapInstance.getLayer(SPOTS_LABEL_LAYER_ID)) {
    mapInstance.addLayer({
      id: SPOTS_LABEL_LAYER_ID,
      type: 'symbol',
      source: SPOTS_SOURCE_ID,
      layout: {
        'text-field': ['get', 'spotName'],
        'text-size': 12,
        'text-offset': [0, -1.2],
        'text-anchor': 'bottom',
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#0f172a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    })
  }
}

function renderPickedLocation() {
  setGeoJsonSource(PICKED_SOURCE_ID, buildPickedFeatureCollection())

  if (!mapInstance.getLayer(PICKED_LAYER_ID)) {
    mapInstance.addLayer({
      id: PICKED_LAYER_ID,
      type: 'circle',
      source: PICKED_SOURCE_ID,
      paint: {
        'circle-radius': 8,
        'circle-color': '#dc2626',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })
  }

  if (!mapInstance.getLayer(PICKED_LABEL_LAYER_ID)) {
    mapInstance.addLayer({
      id: PICKED_LABEL_LAYER_ID,
      type: 'symbol',
      source: PICKED_SOURCE_ID,
      layout: {
        'text-field': ['get', 'spotName'],
        'text-size': 13,
        'text-offset': [0, -1.35],
        'text-anchor': 'bottom',
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#dc2626',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.6,
      },
    })
  }
}

function renderAll() {
  if (!mapInstance?.isStyleLoaded()) return

  renderBounds()
  renderBaseImage()
  renderSpots()
  renderPickedLocation()
}

function fitMapView() {
  if (!mapInstance) return

  const longitude = toNullableNumber(props.longitude)
  const latitude = toNullableNumber(props.latitude)
  if (longitude !== null && latitude !== null) {
    mapInstance.jumpTo({
      center: [longitude, latitude],
      zoom: 15,
    })
    return
  }

  const bounds = parseMapBounds(props.scenicArea?.mapBoundsJson)
  if (bounds) {
    mapInstance.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      {
        padding: 40,
        duration: 0,
        maxZoom: 15,
      },
    )
    return
  }

  const lng = toNullableNumber(props.scenicArea?.mapCenterLng)
  const lat = toNullableNumber(props.scenicArea?.mapCenterLat)
  if (lng !== null && lat !== null) {
    mapInstance.jumpTo({
      center: [lng, lat],
      zoom: toNullableNumber(props.scenicArea?.defaultZoom) ?? 12,
    })
    return
  }

  mapInstance.fitBounds(CHINA_BOUNDS, {
    padding: 20,
    duration: 0,
  })
}

function resizeMap() {
  requestAnimationFrame(() => {
    mapInstance?.resize()
  })
}

function handleMapClick(event) {
  emit('location-change', {
    longitude: Number(event.lngLat.lng.toFixed(6)),
    latitude: Number(event.lngLat.lat.toFixed(6)),
  })
}

function initializeMap() {
  if (!containerRef.value || mapInstance) return

  mapInstance = new maplibregl.Map({
    container: containerRef.value,
    style: getBaseMapStyle(),
    center: CHINA_CENTER,
    zoom: 3.5,
    attributionControl: false,
    localIdeographFontFamily: 'Microsoft YaHei, Noto Sans CJK SC, sans-serif',
  })

  mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  mapInstance.on('load', () => {
    renderAll()
    fitMapView()
    resizeMap()
  })
  mapInstance.on('click', handleMapClick)
  mapInstance.on('mousemove', () => {
    if (!mapInstance) return
    mapInstance.getCanvas().style.cursor = 'crosshair'
  })

  resizeObserver = new ResizeObserver(() => {
    resizeMap()
  })
  resizeObserver.observe(containerRef.value)
}

watch(
  () => [props.scenicArea, props.spots, props.longitude, props.latitude, props.label],
  () => {
    renderAll()
    fitMapView()
    resizeMap()
  },
  { deep: true },
)

onMounted(async () => {
  await nextTick()
  requestAnimationFrame(() => {
    initializeMap()
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  mapInstance?.remove()
  mapInstance = null
})
</script>

<template>
  <div class="spot-location-picker">
    <div ref="containerRef" class="spot-location-picker__map"></div>
    <p class="spot-location-picker__hint">在地图上点击景点位置，系统会自动保存经纬度。</p>
  </div>
</template>

<style scoped>
.spot-location-picker {
  display: grid;
  gap: 10px;
  width: 100%;
  height: 100%;
  min-height: 430px;
}

.spot-location-picker__map {
  width: 100%;
  min-height: 380px;
  border-radius: 24px;
  overflow: hidden;
}

.spot-location-picker__hint {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}
</style>
