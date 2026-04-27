<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { pinia, useUserStore } from '@/stores'
import {
  createGeoFeatureApi,
  createInteractionLogApi,
  createRouteApi,
  createRouteGeoApi,
  createScenicAreaApi,
  createSpotApi,
  getMapInitApi,
  getRouteDetailApi,
  getScenicAreaDetailApi,
  getSpotDetailApi,
  listGeoFeaturesApi,
  listRouteGeosApi,
  pageRoutesApi,
  pageScenicAreasApi,
  pageSpotsApi,
  updateGeoFeatureApi,
  updateRouteApi,
  updateRouteGeoApi,
  updateScenicAreaApi,
  updateSpotApi,
} from '@/api/map'
import MapCanvas from './MapCanvas.vue'
import ScenicAreaPicker from './ScenicAreaPicker.vue'
import {
  calculateDistanceMeters,
  cleanPayload,
  createSessionId,
  formatDateTime,
  formatDistance,
  formatStatus,
  normalizePageResult,
  parseMapBounds,
  stringifyJson,
  summarizeGeojson,
  summarizeRouteMeters,
  toNullableNumber,
} from './mapUtils'

const userStore = useUserStore(pinia)
const allowAccess = computed(() => userStore.isAdmin)
const activeTab = ref('scenic')
const selectedScenicId = ref(null)
const mapInit = ref(null)
const spotOptions = ref([])
const geoFeatureList = ref([])
const recentLogs = ref([])
const sessionId = ref(createSessionId())

const scenicPage = ref({ total: 0, records: [] })
const spotPage = ref({ total: 0, records: [] })
const routePage = ref({ total: 0, records: [] })
const routeGeoList = ref([])
const routeGeoRoute = ref(null)
const routeDetail = ref(null)
const spotDetail = ref(null)

const loading = reactive({
  scenic: false,
  map: false,
  spots: false,
  routes: false,
  features: false,
  routeGeos: false,
  routeDetail: false,
  spotDetail: false,
})

const submitting = reactive({
  scenic: false,
  spot: false,
  route: false,
  feature: false,
  routeGeo: false,
  interaction: false,
})

const dialogs = reactive({
  scenic: false,
  spot: false,
  route: false,
  feature: false,
  routeGeo: false,
  routeDetail: false,
  spotDetail: false,
})

const modes = reactive({
  scenic: 'create',
  spot: 'create',
  route: 'create',
  feature: 'create',
  routeGeo: 'create',
})

const scenicQuery = reactive({ pageNum: 1, pageSize: 8, scenicName: '', status: '' })
const spotQuery = reactive({ pageNum: 1, pageSize: 10, scenicAreaId: '', spotName: '', status: '' })
const routeQuery = reactive({ pageNum: 1, pageSize: 10, scenicAreaId: '', routeName: '', status: '' })

const scenicForm = reactive({
  id: null,
  scenicName: '',
  scenicCode: '',
  province: '',
  city: '',
  district: '',
  address: '',
  longitude: '',
  latitude: '',
  description: '',
  openingHours: '',
  contactPhone: '',
  coverImageUrl: '',
  mapBaseImageUrl: '',
  mapCenterLng: '',
  mapCenterLat: '',
  defaultZoom: 15,
  minZoom: 12,
  maxZoom: 20,
  mapBoundsJson: '',
  status: 1,
})

const spotForm = reactive({
  id: null,
  scenicAreaId: '',
  spotName: '',
  poiType: 'SCENIC_SPOT',
  iconType: '',
  spotCode: '',
  shortIntro: '',
  description: '',
  longitude: '',
  latitude: '',
  stayDurationMinutes: '',
  openingHours: '',
  coverImageUrl: '',
  audioUrl: '',
  videoUrl: '',
  knowledgeDocId: '',
  recommendedLevel: 0,
  sortNo: '',
  status: 1,
})

const routeForm = reactive({
  id: null,
  scenicAreaId: '',
  routeName: '',
  routeType: 'official',
  suitableCrowd: '',
  durationMinutes: '',
  distanceMeters: '',
  description: '',
  recommendedReason: '',
  status: 1,
  routeSpots: [],
})

const featureForm = reactive({
  id: null,
  scenicAreaId: '',
  featureName: '',
  featureType: 'BOUNDARY',
  geojson: '',
  status: 1,
  deleted: 0,
})

const routeGeoForm = reactive({
  id: null,
  routeId: '',
  geojson: '',
  version: '',
  status: 1,
})

const interactionForm = reactive({
  scenicAreaId: '',
  spotId: '',
  routeId: '',
  actionType: 'CLICK_SPOT',
  actionSource: 'MAP',
  agentResultJson: '',
  remark: '',
})

const scenicRef = ref(null)
const spotRef = ref(null)
const routeRef = ref(null)
const featureRef = ref(null)
const routeGeoRef = ref(null)
const scenicPickerKey = ref(0)

const scenicRules = { scenicName: [{ required: true, message: '请输入景区名称', trigger: 'blur' }] }
const spotRules = {
  scenicAreaId: [{ required: true, message: '请选择所属景区', trigger: 'change' }],
  spotName: [{ required: true, message: '请输入景点名称', trigger: 'blur' }],
}
const routeRules = {
  scenicAreaId: [{ required: true, message: '请选择所属景区', trigger: 'change' }],
  routeName: [{ required: true, message: '请输入路线名称', trigger: 'blur' }],
}
const featureRules = {
  scenicAreaId: [{ required: true, message: '请选择所属景区', trigger: 'change' }],
  featureName: [{ required: true, message: '请输入要素名称', trigger: 'blur' }],
  geojson: [{ required: true, message: '请输入 GeoJSON', trigger: 'blur' }],
}
const routeGeoRules = {
  routeId: [{ required: true, message: '请输入路线 ID', trigger: 'blur' }],
  geojson: [{ required: true, message: '请输入 GeoJSON', trigger: 'blur' }],
}

const scenicOptions = computed(() => scenicPage.value.records)
const selectedScenic = computed(() => scenicOptions.value.find((item) => Number(item.id) === Number(selectedScenicId.value)))
const routeGeoMetrics = computed(() => summarizeGeojson(routeGeoForm.geojson))
const featureMetrics = computed(() => summarizeGeojson(featureForm.geojson))
const routeDetailMetrics = computed(() => summarizeGeojson(routeDetail.value?.routeGeo?.geojson))
const boundsText = computed(() => {
  const bounds = parseMapBounds(mapInit.value?.scenicArea?.mapBoundsJson)
  return bounds ? `W ${bounds.west} / S ${bounds.south} / E ${bounds.east} / N ${bounds.north}` : '未配置'
})

const mapStats = computed(() => {
  const scenicArea = mapInit.value?.scenicArea
  const spots = mapInit.value?.spots || []
  const routes = mapInit.value?.routes || []
  const totalMeters = routes.reduce(
    (sum, item) => sum + (toNullableNumber(item.distanceMeters) ?? summarizeRouteMeters(item.geojson)),
    0,
  )
  let nearestText = '暂无'
  if (scenicArea?.mapCenterLng != null && scenicArea?.mapCenterLat != null) {
    const nearest = spots.reduce((best, item) => {
      const meters = calculateDistanceMeters(
        scenicArea.mapCenterLng,
        scenicArea.mapCenterLat,
        item.longitude,
        item.latitude,
      )
      if (meters == null) return best
      if (!best || meters < best.meters) return { spotName: item.spotName, meters }
      return best
    }, null)
    if (nearest) nearestText = `${nearest.spotName} · ${formatDistance(nearest.meters)}`
  }
  return [
    { label: '景点数', value: spots.length },
    { label: '路线数', value: routes.length },
    { label: '空间要素', value: mapInit.value?.geoFeatures?.length || 0 },
    { label: '路线总长', value: formatDistance(totalMeters) },
    { label: '最近景点', value: nearestText },
  ]
})

function resetScenicForm() {
  Object.assign(scenicForm, {
    id: null,
    scenicName: '',
    scenicCode: '',
    province: '',
    city: '',
    district: '',
    address: '',
    longitude: '',
    latitude: '',
    description: '',
    openingHours: '',
    contactPhone: '',
    coverImageUrl: '',
    mapBaseImageUrl: '',
    mapCenterLng: '',
    mapCenterLat: '',
    defaultZoom: 15,
    minZoom: 12,
    maxZoom: 20,
    mapBoundsJson: '',
    status: 1,
  })
  scenicPickerKey.value += 1
}

function resetSpotForm() {
  Object.assign(spotForm, {
    id: null,
    scenicAreaId: selectedScenicId.value || '',
    spotName: '',
    poiType: 'SCENIC_SPOT',
    iconType: '',
    spotCode: '',
    shortIntro: '',
    description: '',
    longitude: '',
    latitude: '',
    stayDurationMinutes: '',
    openingHours: '',
    coverImageUrl: '',
    audioUrl: '',
    videoUrl: '',
    knowledgeDocId: '',
    recommendedLevel: 0,
    sortNo: '',
    status: 1,
  })
}

function resetRouteForm() {
  Object.assign(routeForm, {
    id: null,
    scenicAreaId: selectedScenicId.value || '',
    routeName: '',
    routeType: 'official',
    suitableCrowd: '',
    durationMinutes: '',
    distanceMeters: '',
    description: '',
    recommendedReason: '',
    status: 1,
    routeSpots: [],
  })
}

function resetFeatureForm() {
  Object.assign(featureForm, {
    id: null,
    scenicAreaId: selectedScenicId.value || '',
    featureName: '',
    featureType: 'BOUNDARY',
    geojson: '',
    status: 1,
    deleted: 0,
  })
}

function resetRouteGeoForm() {
  Object.assign(routeGeoForm, {
    id: null,
    routeId: routeGeoRoute.value?.id || '',
    geojson: '',
    version: '',
    status: 1,
  })
  modes.routeGeo = 'create'
}

function createRouteSpotRow(item = {}) {
  return {
    spotId: item.spotId || '',
    sortNo: item.sortNo || '',
    stayDurationMinutes: item.stayDurationMinutes || '',
    isMustVisit: item.isMustVisit ?? 0,
    remark: item.remark || '',
  }
}

async function fetchScenicPage(forceSelectFirst = false) {
  loading.scenic = true
  try {
    scenicPage.value = normalizePageResult(
      await pageScenicAreasApi({
        pageNum: scenicQuery.pageNum,
        pageSize: scenicQuery.pageSize,
        scenicName: scenicQuery.scenicName || undefined,
        status: scenicQuery.status === '' ? undefined : Number(scenicQuery.status),
      }),
    )
    if (!scenicPage.value.records.length) {
      selectedScenicId.value = null
      mapInit.value = null
      spotPage.value = { total: 0, records: [] }
      routePage.value = { total: 0, records: [] }
      geoFeatureList.value = []
      spotOptions.value = []
      return
    }
    const exists = scenicPage.value.records.some((item) => Number(item.id) === Number(selectedScenicId.value))
    if (forceSelectFirst || !exists) selectedScenicId.value = scenicPage.value.records[0].id
  } finally {
    loading.scenic = false
  }
}

async function fetchSpots() {
  loading.spots = true
  try {
    spotPage.value = normalizePageResult(
      await pageSpotsApi({
        pageNum: spotQuery.pageNum,
        pageSize: spotQuery.pageSize,
        scenicAreaId: spotQuery.scenicAreaId === '' ? selectedScenicId.value || undefined : Number(spotQuery.scenicAreaId),
        spotName: spotQuery.spotName || undefined,
        status: spotQuery.status === '' ? undefined : Number(spotQuery.status),
      }),
    )
  } finally {
    loading.spots = false
  }
}

async function fetchSpotOptions() {
  if (!selectedScenicId.value) return
  spotOptions.value = normalizePageResult(
    await pageSpotsApi({ pageNum: 1, pageSize: 200, scenicAreaId: Number(selectedScenicId.value) }),
  ).records
}

async function fetchRoutes() {
  loading.routes = true
  try {
    routePage.value = normalizePageResult(
      await pageRoutesApi({
        pageNum: routeQuery.pageNum,
        pageSize: routeQuery.pageSize,
        scenicAreaId: routeQuery.scenicAreaId === '' ? selectedScenicId.value || undefined : Number(routeQuery.scenicAreaId),
        routeName: routeQuery.routeName || undefined,
        status: routeQuery.status === '' ? undefined : Number(routeQuery.status),
      }),
    )
  } finally {
    loading.routes = false
  }
}

async function fetchFeatures() {
  if (!selectedScenicId.value) return
  loading.features = true
  try {
    const result = await listGeoFeaturesApi(Number(selectedScenicId.value))
    geoFeatureList.value = Array.isArray(result) ? result : []
  } finally {
    loading.features = false
  }
}

async function fetchMapInit() {
  if (!selectedScenicId.value) return
  loading.map = true
  try {
    mapInit.value = await getMapInitApi(Number(selectedScenicId.value))
  } finally {
    loading.map = false
  }
}

async function refreshSelectedScenicData() {
  if (!selectedScenicId.value) return
  interactionForm.scenicAreaId = selectedScenicId.value
  await Promise.all([fetchMapInit(), fetchSpots(), fetchSpotOptions(), fetchRoutes(), fetchFeatures()])
}

function pushRecentLog(record) {
  recentLogs.value = [record, ...recentLogs.value].slice(0, 10)
}

async function submitInteractionLog(payload, silent = false) {
  if (!silent) submitting.interaction = true
  try {
    const requestPayload = cleanPayload(
      {
        userId: toNullableNumber(userStore.userId),
        sessionId: sessionId.value,
        scenicAreaId: payload.scenicAreaId ?? selectedScenicId.value,
        spotId: payload.spotId,
        routeId: payload.routeId,
        actionType: payload.actionType,
        actionSource: payload.actionSource || 'MAP',
        agentResultJson: payload.agentResultJson,
        remark: payload.remark,
      },
      ['userId', 'scenicAreaId', 'spotId', 'routeId'],
    )
    const id = await createInteractionLogApi(requestPayload)
    pushRecentLog({ id, ...requestPayload, createTime: new Date().toISOString() })
    if (!silent) ElMessage.success('交互日志已提交')
  } finally {
    if (!silent) submitting.interaction = false
  }
}

async function openSpotDetail(id, log = false) {
  dialogs.spotDetail = true
  loading.spotDetail = true
  try {
    spotDetail.value = await getSpotDetailApi(id)
    if (log) {
      await submitInteractionLog(
        {
          scenicAreaId: spotDetail.value?.scenicAreaId,
          spotId: id,
          actionType: 'CLICK_SPOT',
          actionSource: 'MAP',
          remark: `点击景点 ${spotDetail.value?.spotName || id}`,
        },
        true,
      )
    }
  } finally {
    loading.spotDetail = false
  }
}

async function openRouteDetail(id, log = false) {
  dialogs.routeDetail = true
  loading.routeDetail = true
  try {
    routeDetail.value = await getRouteDetailApi(id)
    if (log) {
      await submitInteractionLog(
        {
          scenicAreaId: routeDetail.value?.route?.scenicAreaId,
          routeId: id,
          actionType: 'VIEW_ROUTE',
          actionSource: 'MAP',
          remark: `查看路线 ${routeDetail.value?.route?.routeName || id}`,
        },
        true,
      )
    }
  } finally {
    loading.routeDetail = false
  }
}

function openScenicCreate() {
  modes.scenic = 'create'
  resetScenicForm()
  dialogs.scenic = true
}

async function openScenicEdit(row) {
  modes.scenic = 'edit'
  resetScenicForm()
  const detail = await getScenicAreaDetailApi(row.id)
  Object.assign(scenicForm, detail, { mapBoundsJson: stringifyJson(detail.mapBoundsJson) })
  scenicPickerKey.value += 1
  dialogs.scenic = true
}

function applyScenicDraft(draft) {
  if (!draft) {
    scenicForm.longitude = ''
    scenicForm.latitude = ''
    scenicForm.mapCenterLng = ''
    scenicForm.mapCenterLat = ''
    scenicForm.mapBoundsJson = ''
    return
  }

  scenicForm.longitude = draft.longitude.toFixed(6)
  scenicForm.latitude = draft.latitude.toFixed(6)
  scenicForm.mapCenterLng = draft.mapCenterLng.toFixed(6)
  scenicForm.mapCenterLat = draft.mapCenterLat.toFixed(6)
  scenicForm.mapBoundsJson = draft.mapBoundsJson
}

function openSpotCreate() {
  modes.spot = 'create'
  resetSpotForm()
  dialogs.spot = true
}

function openSpotEdit(row) {
  modes.spot = 'edit'
  resetSpotForm()
  Object.assign(spotForm, row)
  dialogs.spot = true
}

function openRouteCreate() {
  modes.route = 'create'
  resetRouteForm()
  dialogs.route = true
}

async function openRouteEdit(row) {
  modes.route = 'edit'
  resetRouteForm()
  const detail = await getRouteDetailApi(row.id)
  Object.assign(routeForm, detail.route, {
    routeSpots: (detail.spots || []).map((item) => createRouteSpotRow(item)),
  })
  dialogs.route = true
}

function openFeatureCreate() {
  modes.feature = 'create'
  resetFeatureForm()
  dialogs.feature = true
}

function openFeatureEdit(row) {
  modes.feature = 'edit'
  resetFeatureForm()
  Object.assign(featureForm, row)
  dialogs.feature = true
}

async function openRouteGeo(row) {
  routeGeoRoute.value = row
  dialogs.routeGeo = true
  resetRouteGeoForm()
  loading.routeGeos = true
  try {
    const result = await listRouteGeosApi(row.id)
    routeGeoList.value = Array.isArray(result) ? result : []
  } finally {
    loading.routeGeos = false
  }
}

function editRouteGeo(row) {
  modes.routeGeo = 'edit'
  Object.assign(routeGeoForm, row)
}

function addRouteSpot() {
  routeForm.routeSpots.push(createRouteSpotRow())
}

function removeRouteSpot(index) {
  routeForm.routeSpots.splice(index, 1)
}

async function submitScenic() {
  const valid = await scenicRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.scenic = true
  try {
    const payload = cleanPayload(
      { ...scenicForm },
      ['id', 'longitude', 'latitude', 'mapCenterLng', 'mapCenterLat', 'defaultZoom', 'minZoom', 'maxZoom', 'status'],
    )
    if (modes.scenic === 'create') {
      const created = await createScenicAreaApi(payload)
      ElMessage.success(`景区 ${created?.scenicName || payload.scenicName} 创建成功`)
      selectedScenicId.value = created?.id || selectedScenicId.value
    } else {
      await updateScenicAreaApi(payload)
      ElMessage.success(`景区 ${payload.scenicName} 更新成功`)
    }
    dialogs.scenic = false
    scenicQuery.pageNum = 1
    await fetchScenicPage(!selectedScenicId.value)
    await refreshSelectedScenicData()
  } finally {
    submitting.scenic = false
  }
}

async function submitSpot() {
  const valid = await spotRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.spot = true
  try {
    const payload = cleanPayload(
      { ...spotForm },
      ['id', 'scenicAreaId', 'longitude', 'latitude', 'stayDurationMinutes', 'knowledgeDocId', 'recommendedLevel', 'sortNo', 'status'],
    )
    if (modes.spot === 'create') {
      await createSpotApi(payload)
      ElMessage.success(`景点 ${payload.spotName} 创建成功`)
    } else {
      await updateSpotApi(payload)
      ElMessage.success(`景点 ${payload.spotName} 更新成功`)
    }
    dialogs.spot = false
    await Promise.all([fetchSpots(), fetchSpotOptions(), fetchMapInit()])
  } finally {
    submitting.spot = false
  }
}

async function submitRoute() {
  const valid = await routeRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.route = true
  try {
    const routeSpots = routeForm.routeSpots
      .map((item) => cleanPayload({ ...item }, ['spotId', 'sortNo', 'stayDurationMinutes', 'isMustVisit']))
      .filter((item) => item.spotId)
    const payload = cleanPayload(
      { ...routeForm, routeSpots },
      ['id', 'scenicAreaId', 'durationMinutes', 'distanceMeters', 'status'],
    )
    if (modes.route === 'create') {
      await createRouteApi(payload)
      ElMessage.success(`路线 ${payload.routeName} 创建成功`)
    } else {
      await updateRouteApi(payload)
      ElMessage.success(`路线 ${payload.routeName} 更新成功`)
    }
    dialogs.route = false
    await Promise.all([fetchRoutes(), fetchMapInit()])
  } finally {
    submitting.route = false
  }
}

async function submitFeature() {
  const valid = await featureRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.feature = true
  try {
    const payload = cleanPayload({ ...featureForm }, ['id', 'scenicAreaId', 'status', 'deleted'])
    if (modes.feature === 'create') {
      await createGeoFeatureApi(payload)
      ElMessage.success(`空间要素 ${payload.featureName} 创建成功`)
    } else {
      await updateGeoFeatureApi(payload)
      ElMessage.success(`空间要素 ${payload.featureName} 更新成功`)
    }
    dialogs.feature = false
    await Promise.all([fetchFeatures(), fetchMapInit()])
  } finally {
    submitting.feature = false
  }
}

async function submitRouteGeo() {
  const valid = await routeGeoRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.routeGeo = true
  try {
    const payload = cleanPayload({ ...routeGeoForm }, ['id', 'routeId', 'version', 'status'])
    if (modes.routeGeo === 'create') {
      await createRouteGeoApi(payload)
      ElMessage.success('轨迹版本已新增')
    } else {
      await updateRouteGeoApi(payload)
      ElMessage.success('轨迹版本已更新')
    }
    resetRouteGeoForm()
    if (routeGeoRoute.value) await openRouteGeo(routeGeoRoute.value)
    await Promise.all([fetchRoutes(), fetchMapInit()])
  } finally {
    submitting.routeGeo = false
  }
}

async function submitManualInteraction() {
  await submitInteractionLog(interactionForm)
  interactionForm.spotId = ''
  interactionForm.routeId = ''
  interactionForm.agentResultJson = ''
  interactionForm.remark = ''
}

watch(selectedScenicId, async (value, oldValue) => {
  if (!value || value === oldValue) return
  spotQuery.scenicAreaId = value
  routeQuery.scenicAreaId = value
  interactionForm.scenicAreaId = value
  await refreshSelectedScenicData()
})

onMounted(async () => {
  if (!allowAccess.value) return
  await fetchScenicPage(true)
  if (selectedScenicId.value) {
    spotQuery.scenicAreaId = selectedScenicId.value
    routeQuery.scenicAreaId = selectedScenicId.value
    interactionForm.scenicAreaId = selectedScenicId.value
    await refreshSelectedScenicData()
  }
})
</script>

<template>
  <div class="map-workspace">
    <el-empty
      v-if="!allowAccess"
      description="当前账号不是管理员，景区地图业务控制台不会开放。"
      :image-size="96"
    />

    <template v-else>
      <section class="hero glass-card">
        <div>
          <p class="eyebrow">MapLibre GL JS + Turf.js</p>
          <h2>景区地图业务控制台</h2>
          <p>
            管理员可以在这里完成景区、景点、路线、空间要素、轨迹版本和交互日志联调，并直接在地图上验证初始化、点击详情和轨迹展示。
          </p>
        </div>
        <div class="hero__actions">
          <el-select v-model="selectedScenicId" placeholder="请选择景区" filterable clearable>
            <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
          </el-select>
          <el-button type="primary" @click="openScenicCreate">新增景区</el-button>
          <el-button plain :loading="loading.map" @click="refreshSelectedScenicData">刷新地图</el-button>
        </div>
      </section>

      <div class="grid">
        <section class="panel panel--map">
          <div class="panel__head">
            <div>
              <p class="eyebrow">Map Init Preview</p>
              <h3>{{ mapInit?.scenicArea?.scenicName || '未选择景区' }}</h3>
            </div>
            <div class="tags">
              <el-tag effect="plain" type="success">{{ mapInit?.scenicArea?.status === 1 ? '启用' : '未启用' }}</el-tag>
              <el-tag effect="plain" type="info">bounds: {{ boundsText }}</el-tag>
            </div>
          </div>
          <div v-loading="loading.map" class="canvas-wrap">
            <MapCanvas
              :map-data="mapInit"
              @spot-click="(id) => openSpotDetail(id, true)"
              @route-click="(id) => openRouteDetail(id, true)"
            />
          </div>
          <div class="stats">
            <div v-for="item in mapStats" :key="item.label" class="stat">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section class="panel panel--side">
          <div class="block">
            <p class="eyebrow">Scenic Summary</p>
            <h3>{{ selectedScenic?.scenicName || '请选择景区' }}</h3>
            <p>{{ mapInit?.scenicArea?.description || '当前景区尚未填写说明。' }}</p>
          </div>
          <div class="block">
            <p class="eyebrow">Map Config</p>
            <div class="block__grid">
              <div><span>中心点</span><strong>{{ mapInit?.scenicArea?.mapCenterLng ?? '-' }}, {{ mapInit?.scenicArea?.mapCenterLat ?? '-' }}</strong></div>
              <div><span>缩放</span><strong>{{ mapInit?.scenicArea?.defaultZoom ?? '-' }} / {{ mapInit?.scenicArea?.minZoom ?? '-' }} / {{ mapInit?.scenicArea?.maxZoom ?? '-' }}</strong></div>
              <div><span>底图地址</span><strong class="break">{{ mapInit?.scenicArea?.mapBaseImageUrl || '未配置' }}</strong></div>
              <div><span>更新时间</span><strong>{{ formatDateTime(mapInit?.scenicArea?.updateTime) }}</strong></div>
            </div>
          </div>
          <div class="block">
            <p class="eyebrow">Recent Logs</p>
            <el-empty v-if="!recentLogs.length" description="尚未产生交互日志" :image-size="76" />
            <div v-else class="log-list">
              <article v-for="item in recentLogs" :key="item.id + item.createTime" class="log-item">
                <strong>{{ item.actionType }}</strong>
                <p>{{ item.remark || '无备注' }}</p>
                <span>{{ formatDateTime(item.createTime) }}</span>
              </article>
            </div>
          </div>
        </section>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="景区管理" name="scenic">
          <section class="module">
            <div class="toolbar">
              <el-input v-model.trim="scenicQuery.scenicName" placeholder="按景区名称查询" clearable />
              <el-select v-model="scenicQuery.status" placeholder="状态" clearable>
                <el-option label="启用" :value="1" />
                <el-option label="停用" :value="0" />
              </el-select>
              <el-button type="primary" :loading="loading.scenic" @click="fetchScenicPage">查询景区</el-button>
            </div>
            <el-table :data="scenicPage.records" v-loading="loading.scenic" stripe>
              <el-table-column prop="id" label="ID" min-width="70" />
              <el-table-column prop="scenicName" label="景区名称" min-width="160" />
              <el-table-column prop="province" label="省份" min-width="120" />
              <el-table-column prop="city" label="城市" min-width="120" />
              <el-table-column prop="address" label="地址" min-width="220" show-overflow-tooltip />
              <el-table-column label="状态" min-width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="Number(row.status) === 1 ? 'success' : 'danger'" effect="plain">
                    {{ formatStatus(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" min-width="180" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="selectedScenicId = row.id">加载地图</el-button>
                  <el-button link type="primary" @click="openScenicEdit(row)">编辑</el-button>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </el-tab-pane>

        <el-tab-pane label="景点管理" name="spots">
          <section class="module">
            <div class="toolbar">
              <el-select v-model="spotQuery.scenicAreaId" placeholder="所属景区" clearable>
                <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
              </el-select>
              <el-input v-model.trim="spotQuery.spotName" placeholder="按景点名称查询" clearable />
              <el-select v-model="spotQuery.status" placeholder="状态" clearable>
                <el-option label="启用" :value="1" />
                <el-option label="停用" :value="0" />
              </el-select>
              <el-button type="primary" :loading="loading.spots" @click="fetchSpots">查询景点</el-button>
              <el-button plain @click="openSpotCreate">新增景点</el-button>
            </div>
            <el-table :data="spotPage.records" v-loading="loading.spots" stripe>
              <el-table-column prop="id" label="ID" min-width="70" />
              <el-table-column prop="spotName" label="景点名称" min-width="150" />
              <el-table-column prop="poiType" label="类型" min-width="120" />
              <el-table-column prop="longitude" label="经度" min-width="120" />
              <el-table-column prop="latitude" label="纬度" min-width="120" />
              <el-table-column label="操作" min-width="160" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openSpotDetail(row.id)">详情</el-button>
                  <el-button link type="primary" @click="openSpotEdit(row)">编辑</el-button>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </el-tab-pane>

        <el-tab-pane label="路线管理" name="routes">
          <section class="module">
            <div class="toolbar">
              <el-select v-model="routeQuery.scenicAreaId" placeholder="所属景区" clearable>
                <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
              </el-select>
              <el-input v-model.trim="routeQuery.routeName" placeholder="按路线名称查询" clearable />
              <el-select v-model="routeQuery.status" placeholder="状态" clearable>
                <el-option label="启用" :value="1" />
                <el-option label="停用" :value="0" />
              </el-select>
              <el-button type="primary" :loading="loading.routes" @click="fetchRoutes">查询路线</el-button>
              <el-button plain @click="openRouteCreate">新增路线</el-button>
            </div>
            <el-table :data="routePage.records" v-loading="loading.routes" stripe>
              <el-table-column prop="id" label="ID" min-width="70" />
              <el-table-column prop="routeName" label="路线名称" min-width="160" />
              <el-table-column prop="routeType" label="类型" min-width="120" />
              <el-table-column label="长度" min-width="110">
                <template #default="{ row }">
                  {{ formatDistance(toNullableNumber(row.distanceMeters) ?? summarizeRouteMeters(row.geojson)) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" min-width="220" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openRouteDetail(row.id)">详情</el-button>
                  <el-button link type="primary" @click="openRouteEdit(row)">编辑</el-button>
                  <el-button link type="primary" @click="openRouteGeo(row)">轨迹版本</el-button>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </el-tab-pane>

        <el-tab-pane label="空间要素" name="features">
          <section class="module">
            <div class="toolbar">
              <el-button type="primary" plain @click="fetchFeatures">刷新要素</el-button>
              <el-button plain @click="openFeatureCreate">新增要素</el-button>
            </div>
            <el-table :data="geoFeatureList" v-loading="loading.features" stripe>
              <el-table-column prop="id" label="ID" min-width="70" />
              <el-table-column prop="featureName" label="要素名称" min-width="150" />
              <el-table-column prop="featureType" label="要素类型" min-width="140" />
              <el-table-column label="几何摘要" min-width="170">
                <template #default="{ row }">
                  {{ summarizeGeojson(row.geojson) ? Array.from(summarizeGeojson(row.geojson).typeSet).join(', ') : '未知' }}
                </template>
              </el-table-column>
              <el-table-column label="操作" min-width="120" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openFeatureEdit(row)">编辑</el-button>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </el-tab-pane>

        <el-tab-pane label="交互日志" name="logs">
          <section class="module split">
            <el-form label-position="top">
              <el-form-item label="会话 ID"><el-input v-model="sessionId" readonly /></el-form-item>
              <el-form-item label="景区 ID"><el-input v-model="interactionForm.scenicAreaId" /></el-form-item>
              <el-form-item label="景点 ID"><el-input v-model="interactionForm.spotId" /></el-form-item>
              <el-form-item label="路线 ID"><el-input v-model="interactionForm.routeId" /></el-form-item>
              <el-form-item label="操作类型">
                <el-select v-model="interactionForm.actionType">
                  <el-option label="点击景点" value="CLICK_SPOT" />
                  <el-option label="查看路线" value="VIEW_ROUTE" />
                  <el-option label="播放讲解" value="PLAY_AUDIO" />
                  <el-option label="推荐路线" value="RECOMMEND_ROUTE" />
                </el-select>
              </el-form-item>
              <el-form-item label="操作来源">
                <el-select v-model="interactionForm.actionSource">
                  <el-option label="地图" value="MAP" />
                  <el-option label="智能体" value="AGENT" />
                  <el-option label="系统" value="SYSTEM" />
                </el-select>
              </el-form-item>
              <el-form-item label="Agent 结果 JSON"><el-input v-model="interactionForm.agentResultJson" type="textarea" :rows="4" /></el-form-item>
              <el-form-item label="备注"><el-input v-model="interactionForm.remark" type="textarea" :rows="4" /></el-form-item>
              <el-button type="primary" :loading="submitting.interaction" @click="submitManualInteraction">提交联调日志</el-button>
            </el-form>
            <div class="block">
              <div class="toolbar toolbar--tight">
                <strong>最近提交记录</strong>
                <el-button plain @click="sessionId = createSessionId()">重置会话</el-button>
              </div>
              <el-empty v-if="!recentLogs.length" description="暂无日志" :image-size="76" />
              <div v-else class="log-list">
                <article v-for="item in recentLogs" :key="item.id + item.createTime" class="log-item">
                  <strong>{{ item.actionType }}</strong>
                  <p>{{ item.remark || '无备注' }}</p>
                  <span>logId: {{ item.id }} · {{ formatDateTime(item.createTime) }}</span>
                </article>
              </div>
            </div>
          </section>
        </el-tab-pane>
      </el-tabs>

      <el-dialog v-model="dialogs.scenic" :title="modes.scenic === 'create' ? '新增景区' : '编辑景区'" width="1040px">
        <el-form ref="scenicRef" :model="scenicForm" :rules="scenicRules" label-position="top" class="form-grid">
          <el-form-item label="景区名称" prop="scenicName"><el-input v-model="scenicForm.scenicName" /></el-form-item>
          <el-form-item label="景区编码"><el-input v-model="scenicForm.scenicCode" /></el-form-item>
          <el-form-item label="省份"><el-input v-model="scenicForm.province" /></el-form-item>
          <el-form-item label="城市"><el-input v-model="scenicForm.city" /></el-form-item>
          <el-form-item label="区县"><el-input v-model="scenicForm.district" /></el-form-item>
          <el-form-item label="联系电话"><el-input v-model="scenicForm.contactPhone" /></el-form-item>
          <el-form-item label="经度"><el-input v-model="scenicForm.longitude" /></el-form-item>
          <el-form-item label="纬度"><el-input v-model="scenicForm.latitude" /></el-form-item>
          <el-form-item label="中心经度"><el-input v-model="scenicForm.mapCenterLng" /></el-form-item>
          <el-form-item label="中心纬度"><el-input v-model="scenicForm.mapCenterLat" /></el-form-item>
          <el-form-item label="默认缩放"><el-input v-model="scenicForm.defaultZoom" /></el-form-item>
          <el-form-item label="最小缩放"><el-input v-model="scenicForm.minZoom" /></el-form-item>
          <el-form-item label="最大缩放"><el-input v-model="scenicForm.maxZoom" /></el-form-item>
          <el-form-item label="状态"><el-switch v-model="scenicForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
          <el-form-item label="地址" class="span-2"><el-input v-model="scenicForm.address" /></el-form-item>
          <el-form-item label="开放时间" class="span-2"><el-input v-model="scenicForm.openingHours" /></el-form-item>
          <el-form-item label="封面地址" class="span-2"><el-input v-model="scenicForm.coverImageUrl" /></el-form-item>
          <el-form-item label="自定义景区底图地址(可选)" class="span-2">
            <el-input
              v-model="scenicForm.mapBaseImageUrl"
              placeholder="可选：如果后续有景区平面底图，可在这里填写；不填写时也可以先用中国参考底图完成范围标注"
            />
          </el-form-item>
          <el-form-item label="景区描述" class="span-2"><el-input v-model="scenicForm.description" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="景区范围绘制" class="span-2">
            <ScenicAreaPicker
              :key="scenicPickerKey"
              :bounds-json="scenicForm.mapBoundsJson"
              :center-lng="scenicForm.mapCenterLng"
              :center-lat="scenicForm.mapCenterLat"
              @draft-change="applyScenicDraft"
            />
          </el-form-item>
          <el-form-item label="地图边界 JSON" class="span-2"><el-input v-model="scenicForm.mapBoundsJson" type="textarea" :rows="5" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogs.scenic = false">取消</el-button>
          <el-button type="primary" :loading="submitting.scenic" @click="submitScenic">保存</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="dialogs.spot" :title="modes.spot === 'create' ? '新增景点' : '编辑景点'" width="860px">
        <el-form ref="spotRef" :model="spotForm" :rules="spotRules" label-position="top" class="form-grid">
          <el-form-item label="所属景区" prop="scenicAreaId"><el-select v-model="spotForm.scenicAreaId"><el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" /></el-select></el-form-item>
          <el-form-item label="景点名称" prop="spotName"><el-input v-model="spotForm.spotName" /></el-form-item>
          <el-form-item label="点位类型"><el-input v-model="spotForm.poiType" /></el-form-item>
          <el-form-item label="图标类型"><el-input v-model="spotForm.iconType" /></el-form-item>
          <el-form-item label="景点编码"><el-input v-model="spotForm.spotCode" /></el-form-item>
          <el-form-item label="推荐等级"><el-input v-model="spotForm.recommendedLevel" /></el-form-item>
          <el-form-item label="经度"><el-input v-model="spotForm.longitude" /></el-form-item>
          <el-form-item label="纬度"><el-input v-model="spotForm.latitude" /></el-form-item>
          <el-form-item label="停留时长"><el-input v-model="spotForm.stayDurationMinutes" /></el-form-item>
          <el-form-item label="排序号"><el-input v-model="spotForm.sortNo" /></el-form-item>
          <el-form-item label="开放时间"><el-input v-model="spotForm.openingHours" /></el-form-item>
          <el-form-item label="状态"><el-switch v-model="spotForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
          <el-form-item label="简介" class="span-2"><el-input v-model="spotForm.shortIntro" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="描述" class="span-2"><el-input v-model="spotForm.description" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="封面地址" class="span-2"><el-input v-model="spotForm.coverImageUrl" /></el-form-item>
          <el-form-item label="音频地址" class="span-2"><el-input v-model="spotForm.audioUrl" /></el-form-item>
          <el-form-item label="视频地址" class="span-2"><el-input v-model="spotForm.videoUrl" /></el-form-item>
          <el-form-item label="知识文档 ID" class="span-2"><el-input v-model="spotForm.knowledgeDocId" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogs.spot = false">取消</el-button>
          <el-button type="primary" :loading="submitting.spot" @click="submitSpot">保存</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="dialogs.route" :title="modes.route === 'create' ? '新增路线' : '编辑路线'" width="980px">
        <el-form ref="routeRef" :model="routeForm" :rules="routeRules" label-position="top" class="form-grid">
          <el-form-item label="所属景区" prop="scenicAreaId"><el-select v-model="routeForm.scenicAreaId"><el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" /></el-select></el-form-item>
          <el-form-item label="路线名称" prop="routeName"><el-input v-model="routeForm.routeName" /></el-form-item>
          <el-form-item label="路线类型"><el-input v-model="routeForm.routeType" /></el-form-item>
          <el-form-item label="适合人群"><el-input v-model="routeForm.suitableCrowd" /></el-form-item>
          <el-form-item label="时长(分钟)"><el-input v-model="routeForm.durationMinutes" /></el-form-item>
          <el-form-item label="距离(米)"><el-input v-model="routeForm.distanceMeters" /></el-form-item>
          <el-form-item label="状态"><el-switch v-model="routeForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
          <el-form-item label="路线描述" class="span-2"><el-input v-model="routeForm.description" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="推荐理由" class="span-2"><el-input v-model="routeForm.recommendedReason" type="textarea" :rows="3" /></el-form-item>
        </el-form>
        <div class="block">
          <div class="toolbar toolbar--tight">
            <strong>路线景点关联</strong>
            <el-button plain @click="addRouteSpot">新增一行</el-button>
          </div>
          <div v-if="!routeForm.routeSpots.length" class="muted">当前未配置路线景点，保存时可只提交基础信息。</div>
          <div v-for="(item, index) in routeForm.routeSpots" :key="index" class="route-row">
            <el-select v-model="item.spotId" placeholder="选择景点"><el-option v-for="spot in spotOptions" :key="spot.id" :label="spot.spotName" :value="spot.id" /></el-select>
            <el-input v-model="item.sortNo" placeholder="排序号" />
            <el-input v-model="item.stayDurationMinutes" placeholder="停留分钟" />
            <el-select v-model="item.isMustVisit"><el-option label="否" :value="0" /><el-option label="是" :value="1" /></el-select>
            <el-input v-model="item.remark" placeholder="备注" />
            <el-button type="danger" plain @click="removeRouteSpot(index)">删除</el-button>
          </div>
        </div>
        <template #footer>
          <el-button @click="dialogs.route = false">取消</el-button>
          <el-button type="primary" :loading="submitting.route" @click="submitRoute">保存</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="dialogs.feature" :title="modes.feature === 'create' ? '新增空间要素' : '编辑空间要素'" width="860px">
        <el-form ref="featureRef" :model="featureForm" :rules="featureRules" label-position="top" class="form-grid">
          <el-form-item label="所属景区" prop="scenicAreaId"><el-select v-model="featureForm.scenicAreaId"><el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" /></el-select></el-form-item>
          <el-form-item label="要素名称" prop="featureName"><el-input v-model="featureForm.featureName" /></el-form-item>
          <el-form-item label="要素类型"><el-input v-model="featureForm.featureType" /></el-form-item>
          <el-form-item label="状态"><el-switch v-model="featureForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
          <el-form-item label="删除标记"><el-switch v-model="featureForm.deleted" :active-value="1" :inactive-value="0" /></el-form-item>
          <el-form-item label="GeoJSON" class="span-2" prop="geojson"><el-input v-model="featureForm.geojson" type="textarea" :rows="12" /></el-form-item>
        </el-form>
        <div class="metric">几何类型：{{ featureMetrics ? Array.from(featureMetrics.typeSet).join(', ') : '未解析' }} ｜ 面积：{{ featureMetrics?.areaSquareMeters ? `${featureMetrics.areaSquareMeters.toFixed(2)} m²` : '-' }}</div>
        <template #footer>
          <el-button @click="dialogs.feature = false">取消</el-button>
          <el-button type="primary" :loading="submitting.feature" @click="submitFeature">保存</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="dialogs.routeGeo" :title="`轨迹版本 · ${routeGeoRoute?.routeName || ''}`" width="1000px">
        <div class="split">
          <div class="block">
            <div class="toolbar toolbar--tight">
              <strong>版本列表</strong>
              <el-button plain @click="resetRouteGeoForm">新建版本</el-button>
            </div>
            <el-table :data="routeGeoList" v-loading="loading.routeGeos" size="small">
              <el-table-column prop="id" label="ID" min-width="70" />
              <el-table-column prop="version" label="版本" min-width="80" />
              <el-table-column label="状态" min-width="90">
                <template #default="{ row }"><el-tag size="small" :type="Number(row.status) === 1 ? 'success' : 'danger'" effect="plain">{{ formatStatus(row.status) }}</el-tag></template>
              </el-table-column>
              <el-table-column label="操作" min-width="90">
                <template #default="{ row }"><el-button link type="primary" @click="editRouteGeo(row)">编辑</el-button></template>
              </el-table-column>
            </el-table>
          </div>
          <div class="block">
            <el-form ref="routeGeoRef" :model="routeGeoForm" :rules="routeGeoRules" label-position="top">
              <el-form-item label="路线 ID" prop="routeId"><el-input v-model="routeGeoForm.routeId" /></el-form-item>
              <el-form-item label="版本号"><el-input v-model="routeGeoForm.version" /></el-form-item>
              <el-form-item label="状态"><el-switch v-model="routeGeoForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
              <el-form-item label="GeoJSON" prop="geojson"><el-input v-model="routeGeoForm.geojson" type="textarea" :rows="12" /></el-form-item>
            </el-form>
            <div class="metric">几何类型：{{ routeGeoMetrics ? Array.from(routeGeoMetrics.typeSet).join(', ') : '未解析' }} ｜ 长度：{{ formatDistance(routeGeoMetrics?.lengthMeters || 0) }}</div>
          </div>
        </div>
        <template #footer>
          <el-button @click="dialogs.routeGeo = false">关闭</el-button>
          <el-button type="primary" :loading="submitting.routeGeo" @click="submitRouteGeo">保存</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="dialogs.spotDetail" title="景点详情" width="720px">
        <div v-loading="loading.spotDetail">
          <el-descriptions v-if="spotDetail" :column="2" border>
            <el-descriptions-item label="景点名称">{{ spotDetail.spotName }}</el-descriptions-item>
            <el-descriptions-item label="所属景区">{{ spotDetail.scenicAreaId }}</el-descriptions-item>
            <el-descriptions-item label="点位类型">{{ spotDetail.poiType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="图标类型">{{ spotDetail.iconType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="经度">{{ spotDetail.longitude ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="纬度">{{ spotDetail.latitude ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="推荐等级">{{ spotDetail.recommendedLevel ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="知识文档">{{ spotDetail.knowledgeDocId ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">{{ spotDetail.description || '-' }}</el-descriptions-item>
            <el-descriptions-item label="音频" :span="2">{{ spotDetail.audioUrl || '-' }}</el-descriptions-item>
            <el-descriptions-item label="视频" :span="2">{{ spotDetail.videoUrl || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-dialog>

      <el-dialog v-model="dialogs.routeDetail" title="路线详情" width="900px">
        <div v-loading="loading.routeDetail" class="route-detail">
          <template v-if="routeDetail">
            <div class="stats stats--detail">
              <div class="stat"><span>路线名称</span><strong>{{ routeDetail.route.routeName }}</strong></div>
              <div class="stat"><span>类型</span><strong>{{ routeDetail.route.routeType || '-' }}</strong></div>
              <div class="stat"><span>轨迹长度</span><strong>{{ formatDistance(routeDetailMetrics?.lengthMeters || routeDetail.route.distanceMeters || 0) }}</strong></div>
              <div class="stat"><span>轨迹版本</span><strong>{{ routeDetail.routeGeo?.version ?? '未配置' }}</strong></div>
            </div>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="适合人群">{{ routeDetail.route.suitableCrowd || '-' }}</el-descriptions-item>
              <el-descriptions-item label="推荐理由">{{ routeDetail.route.recommendedReason || '-' }}</el-descriptions-item>
              <el-descriptions-item label="路线描述" :span="2">{{ routeDetail.route.description || '-' }}</el-descriptions-item>
            </el-descriptions>
            <el-table :data="routeDetail.spots || []" stripe>
              <el-table-column prop="sortNo" label="排序" min-width="80" />
              <el-table-column prop="spotName" label="景点名称" min-width="150" />
              <el-table-column label="必游" min-width="90"><template #default="{ row }">{{ Number(row.isMustVisit) === 1 ? '是' : '否' }}</template></el-table-column>
              <el-table-column prop="stayDurationMinutes" label="停留(分钟)" min-width="110" />
              <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            </el-table>
          </template>
        </div>
      </el-dialog>
    </template>
  </div>
</template>

<style scoped>
.map-workspace{display:grid;gap:20px}.hero,.panel,.module{padding:20px;border:1px solid rgba(255,255,255,.72);border-radius:28px;background:rgba(255,255,255,.84);backdrop-filter:blur(14px);box-shadow:0 18px 40px rgba(15,23,42,.08)}.hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);gap:20px}.hero h2,.panel h3{margin:0;color:#0f172a}.hero p,.block p{margin:12px 0 0;color:#475569;line-height:1.8}.hero__actions,.block__grid{display:grid;gap:12px;align-content:center}.eyebrow{margin:0 0 10px;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);gap:20px}.panel--side,.stats,.log-list{display:grid;gap:12px}.panel__head,.toolbar{display:flex;gap:12px;justify-content:space-between;align-items:center}.toolbar{flex-wrap:wrap}.toolbar--tight{margin-bottom:12px}.tags{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.canvas-wrap{min-height:430px}.stats{grid-template-columns:repeat(5,minmax(0,1fr));margin-top:16px}.stat,.block,.metric{padding:14px 16px;border-radius:20px;background:rgba(248,250,252,.92)}.stat span,.block span{display:block;color:#64748b;font-size:13px}.stat strong,.block strong{display:block;margin-top:8px;color:#0f172a;font-size:16px;line-height:1.6}.break{word-break:break-all}.log-item{padding:14px 16px;border-radius:18px;background:rgba(239,246,255,.92)}.log-item p{margin:8px 0;color:#475569;line-height:1.7}.log-item span{color:#64748b;font-size:12px}.split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:20px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.span-2{grid-column:1 / -1}.route-row{display:grid;grid-template-columns:minmax(220px,1.3fr) repeat(4,minmax(0,1fr)) auto;gap:12px;margin-top:12px}.muted{padding:14px 16px;border-radius:16px;background:rgba(226,232,240,.72);color:#475569}.metric{margin-top:16px;color:#334155}.route-detail{display:grid;gap:18px}.stats--detail{grid-template-columns:repeat(4,minmax(0,1fr))}@media (max-width:1280px){.grid,.split{grid-template-columns:1fr}.stats,.stats--detail{grid-template-columns:repeat(2,minmax(0,1fr))}.route-row{grid-template-columns:1fr 1fr}}@media (max-width:920px){.hero,.form-grid{grid-template-columns:1fr}.panel__head{flex-direction:column;align-items:flex-start}.stats,.stats--detail{grid-template-columns:1fr}}
</style>
