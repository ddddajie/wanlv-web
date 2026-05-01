<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import { getBaseMapStyle } from './mapBaseConfig'
import {
  buildBoundsPolygonCoordinates,
  buildPolygonFeature,
  buildScenicDraftFromCoordinates,
  parseMapBounds,
  toNullableNumber,
} from './mapUtils'

const props = defineProps({
  boundsJson: {
    type: String,
    default: '',
  },
  centerLng: {
    type: [Number, String, null],
    default: null,
  },
  centerLat: {
    type: [Number, String, null],
    default: null,
  },
})

const emit = defineEmits(['draft-change'])

const CHINA_CENTER = [104.195397, 35.86166]
const CHINA_BOUNDS = [
  [73.0, 18.0],
  [135.0, 54.0],
]
const DRAW_SOURCE_ID = 'wanlv-scenic-draw-source'
const CENTER_SOURCE_ID = 'wanlv-scenic-center-source'

const containerRef = ref(null)
const pointCount = ref(0)

let mapInstance = null
let resizeObserver = null
let drawCoordinates = []
let geolocateControl = null

function currentDraftMatchesProps() {
  const currentDraft = buildScenicDraftFromCoordinates(drawCoordinates)
  if (!currentDraft) {
    return !props.boundsJson && toNullableNumber(props.centerLng) === null && toNullableNumber(props.centerLat) === null
  }

  const propLng = toNullableNumber(props.centerLng)
  const propLat = toNullableNumber(props.centerLat)

  return (
    currentDraft.mapBoundsJson === props.boundsJson &&
    propLng !== null &&
    propLat !== null &&
    Number(currentDraft.mapCenterLng.toFixed(6)) === Number(propLng.toFixed(6)) &&
    Number(currentDraft.mapCenterLat.toFixed(6)) === Number(propLat.toFixed(6))
  )
}

function buildDrawFeatureCollection() {
  const features = []

  drawCoordinates.forEach((coordinate, index) => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coordinate,
      },
      properties: {
        kind: 'vertex',
        index,
      },
    })
  })

  if (drawCoordinates.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: drawCoordinates,
      },
      properties: {
        kind: 'line',
      },
    })
  }

  const polygon = buildPolygonFeature(drawCoordinates)
  if (polygon) {
    features.push({
      ...polygon,
      properties: {
        kind: 'polygon',
      },
    })
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

function buildCenterFeatureCollection() {
  const draft = buildScenicDraftFromCoordinates(drawCoordinates)
  if (!draft) {
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
          type: 'Point',
          coordinates: [draft.mapCenterLng, draft.mapCenterLat],
        },
        properties: {
          kind: 'center',
        },
      },
    ],
  }
}

function setSourceData(sourceId, data) {
  if (!mapInstance?.getSource(sourceId)) return
  mapInstance.getSource(sourceId).setData(data)
}

function emitDraftChange() {
  pointCount.value = drawCoordinates.length
  emit('draft-change', buildScenicDraftFromCoordinates(drawCoordinates))
}

function updateDrawData() {
  setSourceData(DRAW_SOURCE_ID, buildDrawFeatureCollection())
  setSourceData(CENTER_SOURCE_ID, buildCenterFeatureCollection())
  emitDraftChange()
}

function fitToCurrentGeometry() {
  const bounds = parseMapBounds(buildScenicDraftFromCoordinates(drawCoordinates)?.mapBoundsJson)
  if (!bounds || !mapInstance) return

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
}

function clearDrawing() {
  drawCoordinates = []
  updateDrawData()
  fitToChina()
}

function undoLastPoint() {
  if (!drawCoordinates.length) return
  drawCoordinates = drawCoordinates.slice(0, -1)
  updateDrawData()
}

function fitToChina() {
  mapInstance?.fitBounds(CHINA_BOUNDS, {
    padding: 20,
    duration: 0,
  })
}

function hydrateFromProps() {
  const fromBounds = buildBoundsPolygonCoordinates(props.boundsJson)
  if (fromBounds.length) {
    drawCoordinates = fromBounds
    updateDrawData()
    fitToCurrentGeometry()
    return
  }

  drawCoordinates = []
  updateDrawData()

  const lng = toNullableNumber(props.centerLng)
  const lat = toNullableNumber(props.centerLat)
  if (lng !== null && lat !== null && mapInstance) {
    mapInstance.jumpTo({
      center: [lng, lat],
      zoom: 12,
    })
    return
  }

  fitToChina()
}

function addDrawLayers() {
  mapInstance.addSource(DRAW_SOURCE_ID, {
    type: 'geojson',
    data: buildDrawFeatureCollection(),
  })

  mapInstance.addLayer({
    id: 'wanlv-scenic-polygon-fill',
    type: 'fill',
    source: DRAW_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': '#2563eb',
      'fill-opacity': 0.16,
    },
  })

  mapInstance.addLayer({
    id: 'wanlv-scenic-line',
    type: 'line',
    source: DRAW_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color': '#1d4ed8',
      'line-width': 3,
    },
  })

  mapInstance.addLayer({
    id: 'wanlv-scenic-vertex',
    type: 'circle',
    source: DRAW_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 6,
      'circle-color': '#f97316',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })

  mapInstance.addSource(CENTER_SOURCE_ID, {
    type: 'geojson',
    data: buildCenterFeatureCollection(),
  })

  mapInstance.addLayer({
    id: 'wanlv-scenic-center',
    type: 'circle',
    source: CENTER_SOURCE_ID,
    paint: {
      'circle-radius': 7,
      'circle-color': '#0f766e',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
}

function handleMapClick(event) {
  drawCoordinates = [...drawCoordinates, [Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6))]]
  updateDrawData()
}

function initializeMap() {
  if (!containerRef.value) return

  mapInstance = new maplibregl.Map({
    container: containerRef.value,
    style: getBaseMapStyle(),
    center: CHINA_CENTER,
    zoom: 3.5,
    minZoom: 3,
    attributionControl: true,
    localIdeographFontFamily: 'Microsoft YaHei, Noto Sans CJK SC, sans-serif',
  })

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
  mapInstance.on('load', () => {
    addDrawLayers()
    hydrateFromProps()
  })
  mapInstance.on('click', handleMapClick)
  mapInstance.on('mousemove', () => {
    if (!mapInstance) return
    mapInstance.getCanvas().style.cursor = 'crosshair'
  })

  resizeObserver = new ResizeObserver(() => {
    mapInstance?.resize()
  })
  resizeObserver.observe(containerRef.value)
}

watch(
  () => [props.boundsJson, props.centerLng, props.centerLat],
  () => {
    if (!mapInstance?.isStyleLoaded()) return
    if (currentDraftMatchesProps()) return
    hydrateFromProps()
  },
)

onMounted(() => {
  initializeMap()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  mapInstance?.remove()
  mapInstance = null
  geolocateControl = null
})
</script>

<template>
  <div class="scenic-picker">
    <div class="scenic-picker__toolbar">
      <div class="scenic-picker__summary">
        <span>绘制点数</span>
        <strong>{{ pointCount }}</strong>
      </div>
      <div class="scenic-picker__actions">
        <el-button plain @click="undoLastPoint">撤销上一个点</el-button>
        <el-button plain @click="fitToChina">回到中国视图</el-button>
        <el-button type="danger" plain @click="clearDrawing">清空绘制</el-button>
      </div>
    </div>
    <div ref="containerRef" class="scenic-picker__map"></div>
    <p class="scenic-picker__hint">
      在底图上按顺序点击景区范围的多个点，形成闭合区域后会自动回填景区中心经纬度和 `mapBoundsJson`。如果需要真正保存景区边界 GeoJSON，可在“空间要素”里继续维护 `BOUNDARY` 要素。
    </p>
  </div>
</template>

<style scoped>
.scenic-picker {
  display: grid;
  gap: 12px;
}

.scenic-picker__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
}

.scenic-picker__summary span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.scenic-picker__summary strong {
  display: block;
  margin-top: 6px;
  color: #0f172a;
  font-size: 18px;
}

.scenic-picker__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.scenic-picker__map {
  min-height: 360px;
  border-radius: 24px;
  overflow: hidden;
}

.scenic-picker__hint {
  margin: 0;
  color: #475569;
  line-height: 1.7;
}

@media (max-width: 768px) {
  .scenic-picker__toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
