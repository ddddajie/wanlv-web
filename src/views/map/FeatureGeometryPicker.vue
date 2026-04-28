<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as turf from '@turf/turf'
import maplibregl from 'maplibre-gl'
import { getBaseMapStyle } from './mapBaseConfig'
import {
  buildGeoFeatureCollection,
  buildImageCoordinates,
  formatDistance,
  parseMapBounds,
  stringifyJson,
  summarizeGeojson,
  toFeatureList,
  toNullableNumber,
} from './mapUtils'

const props = defineProps({
  scenicArea: {
    type: Object,
    default: null,
  },
  geoFeatures: {
    type: Array,
    default: () => [],
  },
  excludeFeatureId: {
    type: [Number, String, null],
    default: null,
  },
  geojson: {
    type: String,
    default: '',
  },
  geometryType: {
    type: String,
    default: 'POLYGON',
  },
  label: {
    type: String,
    default: '空间要素',
  },
})

const emit = defineEmits(['geometry-change'])

const CHINA_CENTER = [104.195397, 35.86166]
const CHINA_BOUNDS = [
  [73.0, 18.0],
  [135.0, 54.0],
]
const BASE_SOURCE_ID = 'wanlv-feature-picker-base-source'
const BASE_LAYER_ID = 'wanlv-feature-picker-base-layer'
const BOUNDS_SOURCE_ID = 'wanlv-feature-picker-bounds-source'
const BOUNDS_FILL_LAYER_ID = 'wanlv-feature-picker-bounds-fill-layer'
const BOUNDS_LINE_LAYER_ID = 'wanlv-feature-picker-bounds-line-layer'
const CONTEXT_SOURCE_ID = 'wanlv-feature-picker-context-source'
const CONTEXT_FILL_LAYER_ID = 'wanlv-feature-picker-context-fill-layer'
const CONTEXT_LINE_LAYER_ID = 'wanlv-feature-picker-context-line-layer'
const DRAW_SOURCE_ID = 'wanlv-feature-picker-draw-source'
const DRAW_FILL_LAYER_ID = 'wanlv-feature-picker-draw-fill-layer'
const DRAW_LINE_LAYER_ID = 'wanlv-feature-picker-draw-line-layer'
const DRAW_VERTEX_LAYER_ID = 'wanlv-feature-picker-draw-vertex-layer'

const containerRef = ref(null)
const pointCount = ref(0)
const summaryText = ref('未绘制')

let mapInstance = null
let resizeObserver = null
let drawCoordinates = []

function emptyFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
  }
}

function normalizedGeometryType() {
  return props.geometryType === 'POINT' || props.geometryType === 'LINE' || props.geometryType === 'POLYGON'
    ? props.geometryType
    : 'POLYGON'
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

function buildContextFeatureCollection() {
  const excludeId = toNullableNumber(props.excludeFeatureId)
  const features = excludeId === null
    ? props.geoFeatures
    : props.geoFeatures.filter((item) => Number(item.id) !== excludeId)

  return buildGeoFeatureCollection(features)
}

function closeRing(coordinates) {
  if (!coordinates.length) return coordinates
  const first = coordinates[0]
  const last = coordinates[coordinates.length - 1]
  if (first?.[0] === last?.[0] && first?.[1] === last?.[1]) return coordinates
  return [...coordinates, first]
}

function buildGeometry() {
  const type = normalizedGeometryType()
  if (type === 'POINT') {
    if (!drawCoordinates.length) return null
    return {
      type: 'Point',
      coordinates: drawCoordinates[0],
    }
  }

  if (type === 'LINE') {
    if (drawCoordinates.length < 2) return null
    return {
      type: 'LineString',
      coordinates: drawCoordinates,
    }
  }

  if (drawCoordinates.length < 3) return null
  return {
    type: 'Polygon',
    coordinates: [closeRing(drawCoordinates)],
  }
}

function buildDrawFeatureCollection() {
  const features = []
  const geometry = buildGeometry()

  if (geometry) {
    features.push({
      type: 'Feature',
      geometry,
      properties: {
        kind: 'geometry',
        featureName: props.label || '空间要素',
      },
    })
  } else if (normalizedGeometryType() !== 'POINT' && drawCoordinates.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: drawCoordinates,
      },
      properties: {
        kind: 'draftLine',
      },
    })
  }

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

  return {
    type: 'FeatureCollection',
    features,
  }
}

function extractCoordinatesFromGeojson() {
  const features = toFeatureList(props.geojson)
  const geometry = features[0]?.geometry
  if (!geometry?.type) return []

  if (geometry.type === 'Point') return [geometry.coordinates]
  if (geometry.type === 'MultiPoint') return geometry.coordinates.slice(0, 1)
  if (geometry.type === 'LineString') return geometry.coordinates
  if (geometry.type === 'MultiLineString') return geometry.coordinates[0] || []
  if (geometry.type === 'Polygon') return (geometry.coordinates[0] || []).slice(0, -1)
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates[0]?.[0] || []).slice(0, -1)
  return []
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

function addStaticLayers() {
  setGeoJsonSource(BOUNDS_SOURCE_ID, buildBoundsFeatureCollection())
  setGeoJsonSource(CONTEXT_SOURCE_ID, buildContextFeatureCollection())
  setGeoJsonSource(DRAW_SOURCE_ID, buildDrawFeatureCollection())

  if (!mapInstance.getLayer(BOUNDS_FILL_LAYER_ID)) {
    mapInstance.addLayer({
      id: BOUNDS_FILL_LAYER_ID,
      type: 'fill',
      source: BOUNDS_SOURCE_ID,
      paint: {
        'fill-color': '#2563eb',
        'fill-opacity': 0.06,
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
        'line-opacity': 0.9,
        'line-dasharray': [2, 1.2],
      },
    })
  }

  if (!mapInstance.getLayer(CONTEXT_FILL_LAYER_ID)) {
    mapInstance.addLayer({
      id: CONTEXT_FILL_LAYER_ID,
      type: 'fill',
      source: CONTEXT_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': '#64748b',
        'fill-opacity': 0.08,
      },
    })
  }

  if (!mapInstance.getLayer(CONTEXT_LINE_LAYER_ID)) {
    mapInstance.addLayer({
      id: CONTEXT_LINE_LAYER_ID,
      type: 'line',
      source: CONTEXT_SOURCE_ID,
      paint: {
        'line-color': '#64748b',
        'line-width': 2,
        'line-opacity': 0.5,
      },
    })
  }

  if (!mapInstance.getLayer(DRAW_FILL_LAYER_ID)) {
    mapInstance.addLayer({
      id: DRAW_FILL_LAYER_ID,
      type: 'fill',
      source: DRAW_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': '#16a34a',
        'fill-opacity': 0.2,
      },
    })
  }

  if (!mapInstance.getLayer(DRAW_LINE_LAYER_ID)) {
    mapInstance.addLayer({
      id: DRAW_LINE_LAYER_ID,
      type: 'line',
      source: DRAW_SOURCE_ID,
      filter: ['!=', ['geometry-type'], 'Point'],
      paint: {
        'line-color': '#15803d',
        'line-width': 4,
        'line-opacity': 0.95,
      },
    })
  }

  if (!mapInstance.getLayer(DRAW_VERTEX_LAYER_ID)) {
    mapInstance.addLayer({
      id: DRAW_VERTEX_LAYER_ID,
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
  }
}

function updateSummary() {
  pointCount.value = drawCoordinates.length
  const geometry = buildGeometry()
  if (!geometry) {
    summaryText.value = '未绘制'
    return
  }

  const summary = summarizeGeojson(stringifyJson(geometry))
  const lengthText = summary?.lengthMeters ? `长度 ${formatDistance(summary.lengthMeters)}` : '长度 -'
  const areaText = summary?.areaSquareMeters ? `面积 ${summary.areaSquareMeters.toFixed(2)} m²` : '面积 -'
  summaryText.value = `${geometry.type} ｜ ${lengthText} ｜ ${areaText}`
}

function emitGeometryChange() {
  const geometry = buildGeometry()
  if (!geometry) {
    emit('geometry-change', {
      geojson: '',
      lengthMeters: '',
    })
    updateSummary()
    return
  }

  const geojson = stringifyJson(geometry)
  const summary = summarizeGeojson(geojson)
  emit('geometry-change', {
    geojson,
    lengthMeters: summary?.lengthMeters ? Number(summary.lengthMeters.toFixed(2)) : '',
  })
  updateSummary()
}

function updateDrawData() {
  setGeoJsonSource(DRAW_SOURCE_ID, buildDrawFeatureCollection())
  emitGeometryChange()
}

function renderAll() {
  if (!mapInstance?.isStyleLoaded()) return

  setGeoJsonSource(BOUNDS_SOURCE_ID, buildBoundsFeatureCollection())
  setGeoJsonSource(CONTEXT_SOURCE_ID, buildContextFeatureCollection())
  setGeoJsonSource(DRAW_SOURCE_ID, buildDrawFeatureCollection())
  renderBaseImage()
}

function fitMapView() {
  if (!mapInstance) return

  const drawFeatures = buildDrawFeatureCollection()
  if (drawFeatures.features.length) {
    if (normalizedGeometryType() === 'POINT' && drawCoordinates[0]) {
      mapInstance.jumpTo({
        center: drawCoordinates[0],
        zoom: 16,
      })
      return
    }

    const [west, south, east, north] = turf.bbox(drawFeatures)
    if ([west, south, east, north].every(Number.isFinite)) {
      mapInstance.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 48, duration: 0, maxZoom: normalizedGeometryType() === 'POINT' ? 16 : 15 },
      )
      return
    }
  }

  const bounds = parseMapBounds(props.scenicArea?.mapBoundsJson)
  if (bounds) {
    mapInstance.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: 40, duration: 0, maxZoom: 15 },
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

function hydrateFromProps() {
  drawCoordinates = extractCoordinatesFromGeojson()
  updateSummary()
  setGeoJsonSource(DRAW_SOURCE_ID, buildDrawFeatureCollection())
}

function resizeMap() {
  requestAnimationFrame(() => {
    mapInstance?.resize()
  })
}

function handleMapClick(event) {
  const coordinate = [Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6))]
  drawCoordinates = normalizedGeometryType() === 'POINT' ? [coordinate] : [...drawCoordinates, coordinate]
  updateDrawData()
}

function undoLastPoint() {
  if (!drawCoordinates.length) return
  drawCoordinates = drawCoordinates.slice(0, -1)
  updateDrawData()
}

function clearDrawing() {
  drawCoordinates = []
  updateDrawData()
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
    hydrateFromProps()
    addStaticLayers()
    renderBaseImage()
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
  () => [props.scenicArea, props.geoFeatures, props.excludeFeatureId],
  () => {
    renderAll()
    resizeMap()
  },
  { deep: true },
)

watch(
  () => [props.geojson, props.geometryType],
  () => {
    hydrateFromProps()
    renderAll()
    fitMapView()
    resizeMap()
  },
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
  <div class="feature-picker">
    <div class="feature-picker__toolbar">
      <div class="feature-picker__summary">
        <span>绘制点数</span>
        <strong>{{ pointCount }}</strong>
        <em>{{ summaryText }}</em>
      </div>
      <div class="feature-picker__actions">
        <el-button plain @click="undoLastPoint">撤销上一个点</el-button>
        <el-button plain @click="fitMapView">回到景区视图</el-button>
        <el-button type="danger" plain @click="clearDrawing">清空绘制</el-button>
      </div>
    </div>
    <div ref="containerRef" class="feature-picker__map"></div>
    <p class="feature-picker__hint">
      点要素点击一次即可；线要素按道路方向依次点击至少 2 个点；面要素沿边界依次点击至少 3 个点，系统会自动闭合并生成 GeoJSON。
    </p>
  </div>
</template>

<style scoped>
.feature-picker {
  display: grid;
  gap: 12px;
  width: 100%;
}

.feature-picker__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
}

.feature-picker__summary span,
.feature-picker__summary em {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-style: normal;
}

.feature-picker__summary strong {
  display: block;
  margin: 5px 0;
  color: #0f172a;
  font-size: 18px;
}

.feature-picker__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.feature-picker__map {
  width: 100%;
  min-height: 430px;
  border-radius: 24px;
  overflow: hidden;
}

.feature-picker__hint {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 768px) {
  .feature-picker__toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
