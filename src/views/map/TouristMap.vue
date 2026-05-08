<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ChatDotRound,
  Clock,
  Flag,
  Location,
  MapLocation,
  Place,
  Tickets,
} from '@element-plus/icons-vue'
import { getLatestAgentRouteGeoApi, getMapInitApi, pageScenicAreasApi } from '@/api/map'
import { pinia, useUserStore } from '@/stores'
import MapCanvas from './MapCanvas.vue'
import UserMapControls from './UserMapControls.vue'
import { normalizePageResult } from './mapUtils'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore(pinia)
const SCENIC_NAME_CACHE_KEY = 'wanlv:scenic-area-name-cache'

const scenicOptions = ref([])
const selectedScenicId = ref(null)
const mapData = ref(null)
const selectedSpot = ref(null)
const isLoadingScenic = ref(false)
const isLoadingMap = ref(false)
const isLoadingAgentRoute = ref(false)
const isInfoPanelOpen = ref(true)
const visibleRouteIds = ref([])
const mapCanvasRef = ref(null)
const agentRoute = ref(null)

const scenicArea = computed(() => mapData.value?.scenicArea || null)
const spots = computed(() => mapData.value?.spots || [])
const routes = computed(() => mapData.value?.routes || [])
const geoFeatures = computed(() => mapData.value?.geoFeatures || [])
const displayRoutes = computed(() => (agentRoute.value ? [agentRoute.value, ...routes.value] : routes.value))
const displayMapData = computed(() =>
  mapData.value
    ? {
        ...mapData.value,
        routes: displayRoutes.value,
      }
    : mapData.value,
)

const enabledScenicOptions = computed(() =>
  scenicOptions.value.filter((item) => Number(item.status) === 1 || Number(item.id) === Number(selectedScenicId.value)),
)

const officialRoutes = computed(() =>
  routes.value.filter((item) => String(item.routeType || '').trim().toLowerCase() === 'official'),
)

const recommendedRoutes = computed(() => (agentRoute.value ? [agentRoute.value, ...officialRoutes.value] : officialRoutes.value))

const highlightedSpots = computed(() =>
  spots.value
    .filter((item) => String(item.poiType || '').trim() === 'SCENIC_SPOT')
    .slice()
    .sort((a, b) => (Number(b.recommendedLevel) || 0) - (Number(a.recommendedLevel) || 0))
    .slice(0, 6),
)

const scenicLocationText = computed(() => {
  const parts = [scenicArea.value?.province, scenicArea.value?.city, scenicArea.value?.district].filter(Boolean)
  return parts.length ? parts.join(' · ') : scenicArea.value?.address || '景区位置待完善'
})

const mapLegendItems = [
  { label: '景点标记', type: 'dot', className: 'tourist-map__dot--spot' },
  { label: '导览路线', type: 'dot', className: 'tourist-map__dot--route' },
  { label: '景区范围', type: 'dot', className: 'tourist-map__dot--area' },
  { label: '步行道路', type: 'line', className: 'tourist-map__line--walk' },
  { label: '车行道路', type: 'line', className: 'tourist-map__line--drive' },
  { label: '游览步道', type: 'line', className: 'tourist-map__line--tour' },
  { label: '服务通道', type: 'line', className: 'tourist-map__line--service' },
]

function readScenicNameCache() {
  try {
    return JSON.parse(localStorage.getItem(SCENIC_NAME_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function cacheScenicNames(rows = []) {
  const nextCache = readScenicNameCache()
  rows.forEach((item) => {
    if (item?.id && item?.scenicName) {
      nextCache[String(item.id)] = item.scenicName
    }
  })
  localStorage.setItem(SCENIC_NAME_CACHE_KEY, JSON.stringify(nextCache))
}

function getSelectedScenicName(id = selectedScenicId.value) {
  return (
    scenicOptions.value.find((item) => Number(item.id) === Number(id))?.scenicName ||
    scenicArea.value?.scenicName ||
    readScenicNameCache()[String(id)] ||
    ''
  )
}

function createAgentRouteId(id) {
  const routeId = Number(id)
  return Number.isFinite(routeId) ? -100000000 - routeId : `agent-${Date.now()}`
}

function parseSpotNamesText(value) {
  if (!value) return ''

  try {
    const names = JSON.parse(value)
    return Array.isArray(names) ? names.filter(Boolean).join('、') : ''
  } catch {
    return ''
  }
}

function normalizeAgentRoute(data) {
  if (!data?.geojson) return null

  return {
    ...data,
    // 专属路线使用前端临时 ID，避免和官方路线 ID 撞号后影响地图开关。
    id: createAgentRouteId(data.id),
    agentRouteGeoId: data.id,
    routeType: 'agent_custom',
    routeName: data.routeName || '我的专属路线',
    description: parseSpotNamesText(data.spotNamesJson),
    status: 1,
  }
}

async function fetchLatestAgentRoute() {
  agentRoute.value = null
  if (!userStore.isLoggedIn || !userStore.userId || !selectedScenicId.value) return

  isLoadingAgentRoute.value = true
  try {
    const result = await getLatestAgentRouteGeoApi({
      userId: userStore.userId,
      scenicAreaId: Number(selectedScenicId.value),
    })
    agentRoute.value = normalizeAgentRoute(result)
  } catch (error) {
    console.error('Failed to load latest agent route:', error)
  } finally {
    isLoadingAgentRoute.value = false
  }
}

function syncRouteQuery(id) {
  const scenicName = getSelectedScenicName(id)
  router.replace({
    query: {
      ...route.query,
      scenicAreaId: id || undefined,
      scenicAreaName: scenicName || undefined,
    },
  })
}

async function fetchScenicOptions() {
  isLoadingScenic.value = true
  try {
    const result = await pageScenicAreasApi({ current: 1, size: 100, status: 1 })
    const page = normalizePageResult(result)
    scenicOptions.value = page.records
    cacheScenicNames(page.records)

    const queryId = Number(route.query.scenicAreaId)
    const firstId = queryId || page.records[0]?.id
    if (firstId) {
      selectedScenicId.value = Number(firstId)
    }
  } finally {
    isLoadingScenic.value = false
  }
}

async function fetchMapData() {
  if (!selectedScenicId.value) return

  isLoadingMap.value = true
  selectedSpot.value = null
  try {
    mapData.value = await getMapInitApi(Number(selectedScenicId.value))
    cacheScenicNames([mapData.value?.scenicArea])
    syncRouteQuery(selectedScenicId.value)
    await fetchLatestAgentRoute()
    visibleRouteIds.value = recommendedRoutes.value.filter(hasRouteGeojson).map((item) => item.id).filter(Boolean).slice(0, 2)
    await nextTick()
    mapCanvasRef.value?.resize()
  } catch (error) {
    console.error('Failed to load tourist map:', error)
    ElMessage.error('景区地图加载失败，请稍后再试')
  } finally {
    isLoadingMap.value = false
  }
}

function handleScenicChange(value) {
  selectedScenicId.value = value
  syncRouteQuery(value)
}

function handleAskAi() {
  const scenicAreaId = Number(selectedScenicId.value)
  if (!Number.isFinite(scenicAreaId) || scenicAreaId <= 0) {
    ElMessage.warning('请先选择景区，再进入智能问答。')
    return
  }

  const target = {
    path: '/chat',
    query: {
      scenicAreaId,
      scenicAreaName: getSelectedScenicName(scenicAreaId) || undefined,
    },
  }

  // 游客点击智能问答时先去登录，登录成功后再带着景区上下文回到问答页。
  if (!userStore.isLoggedIn) {
    router.push({
      path: '/normal/login',
      query: {
        redirect: router.resolve(target).fullPath,
      },
    })
    return
  }

  router.push(target)
}

function handleSpotClick(id) {
  selectedSpot.value = spots.value.find((item) => Number(item.id) === Number(id)) || null
  isInfoPanelOpen.value = true
}

function toggleRoute(routeId) {
  const route = recommendedRoutes.value.find((item) => String(item.id) === String(routeId))
  if (!hasRouteGeojson(route)) {
    ElMessage.warning('该路线暂未配置轨迹')
    return
  }

  const normalizedId = String(routeId)

  visibleRouteIds.value = visibleRouteIds.value.some((item) => String(item) === normalizedId)
    ? visibleRouteIds.value.filter((item) => String(item) !== normalizedId)
    : [...visibleRouteIds.value, routeId]
}

function isRouteVisible(routeId) {
  return visibleRouteIds.value.some((item) => String(item) === String(routeId))
}

function hasRouteGeojson(route) {
  return Boolean(route?.geojson)
}

watch(selectedScenicId, (value) => {
  if (value) fetchMapData()
})

watch(
  () => route.query.scenicAreaId,
  (value) => {
    const nextId = Number(value)
    if (Number.isFinite(nextId) && nextId > 0 && nextId !== Number(selectedScenicId.value)) {
      selectedScenicId.value = nextId
    }
  },
)

onMounted(fetchScenicOptions)
</script>

<template>
  <section class="tourist-map">
    <div class="tourist-map__canvas" v-loading="isLoadingMap">
      <MapCanvas
        ref="mapCanvasRef"
        :map-data="displayMapData"
        :visible-route-ids="visibleRouteIds"
        :show-native-controls="false"
        compact
        @spot-click="handleSpotClick"
      />

      <div v-if="!mapData && !isLoadingMap" class="tourist-map__empty">
        <el-empty description="请选择景区查看导游地图" :image-size="92" />
      </div>
    </div>

    <header class="tourist-map__topbar">
      <div class="tourist-map__switcher">
        <span class="tourist-map__brand-icon">
          <el-icon><MapLocation /></el-icon>
        </span>

        <div class="tourist-map__switcher-main">
          <span>Wanlv Guide Map</span>
          <el-select
            v-model="selectedScenicId"
            class="tourist-map__select"
            :loading="isLoadingScenic"
            placeholder="切换景区"
            @change="handleScenicChange"
          >
            <el-option
              v-for="item in enabledScenicOptions"
              :key="item.id"
              :label="item.scenicName"
              :value="item.id"
            />
          </el-select>
        </div>

        <button type="button" class="tourist-map__top-info" @click="isInfoPanelOpen = !isInfoPanelOpen">
          <span><el-icon><Place /></el-icon>{{ spots.length }}</span>
          <span><el-icon><Flag /></el-icon>{{ displayRoutes.length }}</span>
          <span><el-icon><Tickets /></el-icon>{{ geoFeatures.length }}</span>
          <el-icon class="tourist-map__top-info-arrow" :class="{ 'is-open': isInfoPanelOpen }"><ArrowDown /></el-icon>
        </button>
      </div>
    </header>

    <aside class="tourist-map__floating">
      <UserMapControls
        :scenic-area="scenicArea"
        :spot-count="spots.length"
        :route-count="displayRoutes.length"
        :feature-count="geoFeatures.length"
        :loading="isLoadingMap"
        :panel-open="isInfoPanelOpen"
        @zoom-in="mapCanvasRef?.zoomIn()"
        @zoom-out="mapCanvasRef?.zoomOut()"
        @fit-view="mapCanvasRef?.fitView()"
        @locate="mapCanvasRef?.locate()"
        @refresh="fetchMapData"
        @toggle-panel="isInfoPanelOpen = !isInfoPanelOpen"
      />
    </aside>

    <transition name="tourist-map-panel">
      <section v-show="isInfoPanelOpen" class="tourist-map__panel">
        <button type="button" class="tourist-map__panel-toggle" @click="isInfoPanelOpen = false">
          <el-icon><ArrowDown /></el-icon>
        </button>

        <div class="tourist-map__panel-head">
          <p>当前景区</p>
          <h1>{{ scenicArea?.scenicName || '请选择景区' }}</h1>
          <span>
            <el-icon><Location /></el-icon>
            {{ scenicLocationText }}
          </span>
        </div>

        <div class="tourist-map__quick-info">
          <span><el-icon><Place /></el-icon>{{ spots.length }} 个景点</span>
          <span><el-icon><Flag /></el-icon>{{ displayRoutes.length }} 条路线</span>
          <span><el-icon><Tickets /></el-icon>{{ geoFeatures.length }} 个要素</span>
        </div>

        <div class="tourist-map__actions">
          <el-button type="primary" round @click="handleAskAi">
            <el-icon><ChatDotRound /></el-icon>
            咨询智能问答
          </el-button>
        </div>

        <p class="tourist-map__description">
          {{ selectedSpot?.spotName ? `已选中：${selectedSpot.spotName}` : scenicArea?.description || '这里会展示景区范围、景点、路线和服务设施，方便游客在手机端快速了解导览信息。' }}
        </p>

        <div class="tourist-map__section">
          <div class="tourist-map__section-title">
            <span>推荐路线</span>
            <small>点击开关显示</small>
          </div>
          <div v-if="recommendedRoutes.length" class="tourist-map__route-list">
            <button
              v-for="item in recommendedRoutes"
              :key="item.id"
              type="button"
              class="tourist-map__route"
              :class="{
                'is-active': isRouteVisible(item.id),
                'is-disabled': !hasRouteGeojson(item),
                'is-agent-route': item.routeType === 'agent_custom',
              }"
              @click="toggleRoute(item.id)"
            >
              <span>{{ item.routeName || '未命名路线' }}</span>
              <strong>{{ hasRouteGeojson(item) ? (isRouteVisible(item.id) ? '点击隐藏' : '点击显示') : '未配置轨迹' }}</strong>
            </button>
          </div>
          <p v-else-if="isLoadingAgentRoute" class="tourist-map__muted">正在加载专属路线...</p>
          <p v-else class="tourist-map__muted">当前景区暂无推荐路线。</p>
        </div>

        <div class="tourist-map__section">
          <div class="tourist-map__section-title">
            <span>地图功能说明</span>
            <small>游客端展示重点</small>
          </div>
          <div class="tourist-map__legend">
            <span v-for="item in mapLegendItems" :key="item.label">
              <i v-if="item.type === 'line'" class="tourist-map__line" :class="item.className"></i>
              <i v-else class="tourist-map__dot" :class="item.className"></i>
              {{ item.label }}
            </span>
          </div>
        </div>

        <div class="tourist-map__section tourist-map__section--spots">
          <div class="tourist-map__section-title">
            <span>推荐景点</span>
            <small>{{ selectedSpot?.spotName || '点击地图标记查看' }}</small>
          </div>
          <div v-if="highlightedSpots.length" class="tourist-map__spot-list">
            <span v-for="item in highlightedSpots" :key="item.id">{{ item.spotName || '未命名景点' }}</span>
          </div>
          <p v-else class="tourist-map__muted">当前景区暂无景点类型的推荐数据。</p>
        </div>

        <div v-if="scenicArea?.openingHours" class="tourist-map__hours">
          <el-icon><Clock /></el-icon>
          {{ scenicArea.openingHours }}
        </div>
      </section>
    </transition>
  </section>
</template>

<style scoped>
.tourist-map {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 24px;
  background: #e5edf3;
  box-shadow: 0 24px 58px rgba(15, 23, 42, 0.16);
}

.tourist-map__canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.tourist-map__canvas :deep(.map-canvas) {
  height: 100%;
}

.tourist-map__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(248, 250, 252, 0.88);
}

.tourist-map__topbar {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  z-index: 5;
  pointer-events: none;
}

.tourist-map__switcher {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(620px, 100%);
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.14);
  pointer-events: auto;
}

.tourist-map__brand-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 8px;
  background: #0f766e;
  color: #ffffff;
}

.tourist-map__switcher-main {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.tourist-map__switcher-main > span {
  display: block;
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
}

.tourist-map__select {
  width: 100%;
}

.tourist-map__select :deep(.el-select__wrapper) {
  min-height: 28px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.tourist-map__select :deep(.el-select__selected-item) {
  min-width: 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 800;
}

.tourist-map__top-info {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  border: 0;
  border-left: 1px solid #e2e8f0;
  padding: 0 4px 0 14px;
  background: transparent;
  color: #475569;
  cursor: pointer;
}

.tourist-map__top-info span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  white-space: nowrap;
}

.tourist-map__top-info-arrow {
  transition: transform 0.2s ease;
}

.tourist-map__top-info-arrow.is-open {
  transform: rotate(180deg);
}

.tourist-map__floating {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 6;
  pointer-events: none;
}

.tourist-map__panel {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 5;
  width: min(390px, calc(100% - 120px));
  max-height: calc(100% - 112px);
  overflow: auto;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 20px 46px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(16px);
}

.tourist-map__panel-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f5f9;
  color: #334155;
  cursor: pointer;
}

.tourist-map__panel-head {
  padding-right: 36px;
}

.tourist-map__panel-head p,
.tourist-map__section-title small {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.tourist-map__panel-head h1 {
  margin: 4px 0 8px;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.2;
}

.tourist-map__panel-head span,
.tourist-map__quick-info span,
.tourist-map__hours {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tourist-map__panel-head span {
  color: #475569;
  font-size: 13px;
}

.tourist-map__quick-info {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.tourist-map__quick-info span {
  min-width: 0;
  justify-content: center;
  padding: 8px 6px;
  border-radius: 8px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  white-space: nowrap;
}

.tourist-map__actions {
  display: flex;
  margin-top: 14px;
}

.tourist-map__actions :deep(.el-button) {
  width: 100%;
  justify-content: center;
}

.tourist-map__description {
  margin: 14px 0 0;
  color: #334155;
  font-size: 13px;
  line-height: 1.65;
}

.tourist-map__section {
  margin-top: 18px;
}

.tourist-map__section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.tourist-map__section-title span {
  color: #0f172a;
  font-weight: 800;
}

.tourist-map__route-list,
.tourist-map__spot-list,
.tourist-map__feature-tags,
.tourist-map__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tourist-map__route {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 150px;
  max-width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 9px 10px;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
}

.tourist-map__route span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tourist-map__route strong {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.tourist-map__route.is-active {
  border-color: rgba(15, 118, 110, 0.42);
  background: rgba(15, 118, 110, 0.1);
  color: #0f766e;
}

.tourist-map__route.is-agent-route {
  border-color: rgba(124, 58, 237, 0.35);
  background: rgba(124, 58, 237, 0.08);
}

.tourist-map__route.is-agent-route.is-active {
  color: #6d28d9;
}

.tourist-map__route.is-disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.tourist-map__legend span,
.tourist-map__spot-list span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  border-radius: 8px;
  padding: 6px 9px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
}

.tourist-map__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.tourist-map__line {
  width: 34px;
  height: 3px;
  border-radius: 999px;
}

.tourist-map__dot--spot {
  background: #0f766e;
}

.tourist-map__dot--route {
  background: #f97316;
}

.tourist-map__dot--area {
  background: #2563eb;
}

.tourist-map__line--walk {
  background: #cbd5e1;
}

.tourist-map__line--drive {
  background: #fdba74;
}

.tourist-map__line--tour {
  background: #86efac;
}

.tourist-map__line--service {
  background: #93c5fd;
}

.tourist-map__hours {
  margin-top: 18px;
  width: 100%;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 13px;
}

.tourist-map__muted {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}

.tourist-map-panel-enter-active,
.tourist-map-panel-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.tourist-map-panel-enter-from,
.tourist-map-panel-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

@media (max-width: 768px) {
  .tourist-map {
    border-radius: 20px;
  }

  .tourist-map__topbar {
    top: 12px;
    left: 12px;
    right: 12px;
  }

  .tourist-map__switcher {
    width: 100%;
    gap: 8px;
    padding: 9px 10px;
  }

  .tourist-map__brand-icon {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
  }

  .tourist-map__switcher-main > span {
    font-size: 11px;
  }

  .tourist-map__select :deep(.el-select__selected-item) {
    font-size: 16px;
  }

  .tourist-map__top-info {
    gap: 7px;
    padding-left: 9px;
  }

  .tourist-map__top-info span {
    font-size: 11px;
  }

  .tourist-map__floating {
    right: 12px;
    bottom: 12px;
  }

  .tourist-map__panel {
    top: 82px;
    left: 12px;
    right: 12px;
    bottom: auto;
    width: auto;
    max-height: min(42vh, 340px);
    padding: 16px;
  }

  .tourist-map__panel-head h1 {
    font-size: 20px;
  }

  .tourist-map__quick-info {
    grid-template-columns: 1fr;
  }

  .tourist-map__quick-info span {
    justify-content: flex-start;
  }
}
</style>
