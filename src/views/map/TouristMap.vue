<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChatbubbleEllipsesOutline,
  ChevronDownOutline,
  FlagOutline,
  LocationOutline,
  MapOutline,
  TicketOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import { getLatestAgentRouteGeoApi, getMapInitApi, pageScenicAreasApi } from '@/api/map'
import { useScenicWarmReminder } from '@/composables/useScenicWarmReminder'
import { pinia, useUserStore } from '@/stores'
import { message } from '@/utils/feedback'
import MapCanvas from './MapCanvas.vue'
import UserMapControls from './UserMapControls.vue'
import { normalizePageResult } from './mapUtils'

defineProps({
  headerTarget: {
    type: String,
    default: '',
  },
})

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

// 重点：Naive UI Select 使用统一的 label/value 结构，避免模板里重复转换景区数据。
const scenicSelectOptions = computed(() =>
  enabledScenicOptions.value.map((item) => ({
    label: item.scenicName,
    value: item.id,
  })),
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
const scenicWarmReminderName = computed(() => getSelectedScenicName(selectedScenicId.value))

useScenicWarmReminder({
  scenicAreaId: selectedScenicId,
  scenicAreaName: scenicWarmReminderName,
})

const mapLegendItems = [
  { label: '景点标记', type: 'dot', className: 'bg-teal-600' },
  { label: '导览路线', type: 'dot', className: 'bg-orange-500' },
  { label: '景区范围', type: 'dot', className: 'bg-sky-600' },
  { label: '步行道路', type: 'line', className: 'bg-slate-300' },
  { label: '车行道路', type: 'line', className: 'bg-orange-300' },
  { label: '游览步道', type: 'line', className: 'bg-emerald-300' },
  { label: '服务通道', type: 'line', className: 'bg-sky-300' },
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
    message.error('景区地图加载失败，请稍后再试')
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
    message.warning('请先选择景区，再进入智能问答。')
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
    message.warning('该路线暂未配置轨迹')
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
  <section class="tourist-map relative h-full min-h-0 overflow-hidden bg-slate-200">
    <n-spin :show="isLoadingMap" class="tourist-map__spin">
      <MapCanvas
        ref="mapCanvasRef"
        :map-data="displayMapData"
        :visible-route-ids="visibleRouteIds"
        :show-native-controls="false"
        compact
        @spot-click="handleSpotClick"
      />

      <div v-if="!mapData && !isLoadingMap" class="tourist-map__empty absolute inset-0 grid place-items-center bg-slate-50/90">
        <n-empty description="请选择景区查看导游地图" />
      </div>
    </n-spin>

    <Teleport v-if="headerTarget" :to="headerTarget">
      <div class="tourist-map__titlebar-control">
        <n-select
          v-model:value="selectedScenicId"
          class="tourist-map__titlebar-select"
          :options="scenicSelectOptions"
          :loading="isLoadingScenic"
          filterable
          placeholder="切换景区"
          @update:value="handleScenicChange"
        />

        <n-button quaternary class="tourist-map__top-info" @click="isInfoPanelOpen = !isInfoPanelOpen">
          <span><n-icon><LocationOutline /></n-icon>{{ spots.length }}</span>
          <span><n-icon><FlagOutline /></n-icon>{{ displayRoutes.length }}</span>
          <span><n-icon><TicketOutline /></n-icon>{{ geoFeatures.length }}</span>
          <n-icon class="transition-transform" :class="{ 'rotate-180': isInfoPanelOpen }"><ChevronDownOutline /></n-icon>
        </n-button>
      </div>
    </Teleport>

    <header v-else class="pointer-events-none absolute left-4 right-4 top-4 z-[5]">
      <n-card class="tourist-map__top-card pointer-events-auto" size="small" :bordered="false">
        <div class="flex min-w-0 items-center gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-700 text-white shadow-sm">
            <n-icon :size="22"><MapOutline /></n-icon>
          </span>

          <div class="grid min-w-0 flex-1 gap-1">
            <span class="text-xs leading-none text-slate-500">Wanlv Guide Map</span>
            <n-select
              v-model:value="selectedScenicId"
              class="tourist-map__select"
              :options="scenicSelectOptions"
              :loading="isLoadingScenic"
              filterable
              placeholder="切换景区"
              @update:value="handleScenicChange"
            />
          </div>

          <n-button quaternary class="tourist-map__top-info" @click="isInfoPanelOpen = !isInfoPanelOpen">
            <span><n-icon><LocationOutline /></n-icon>{{ spots.length }}</span>
            <span><n-icon><FlagOutline /></n-icon>{{ displayRoutes.length }}</span>
            <span><n-icon><TicketOutline /></n-icon>{{ geoFeatures.length }}</span>
            <n-icon class="transition-transform" :class="{ 'rotate-180': isInfoPanelOpen }"><ChevronDownOutline /></n-icon>
          </n-button>
        </div>
      </n-card>
    </header>

    <aside class="pointer-events-none absolute bottom-4 right-4 z-[6]">
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
      <n-card v-show="isInfoPanelOpen" class="tourist-map__panel" :bordered="false">
        <template #header>
          <div class="min-w-0 pr-9">
            <p class="m-0 text-xs text-slate-500">当前景区</p>
            <h1 class="m-0 mt-1 text-2xl font-bold leading-tight text-slate-950">{{ scenicArea?.scenicName || '请选择景区' }}</h1>
          </div>
        </template>
        <template #header-extra>
          <n-button quaternary circle aria-label="收起景区信息" @click="isInfoPanelOpen = false">
            <template #icon><n-icon><ChevronDownOutline /></n-icon></template>
          </n-button>
        </template>

        <div class="grid gap-4">
          <n-space align="center" :wrap="false" class="min-w-0 text-slate-600">
            <n-icon><LocationOutline /></n-icon>
            <span class="truncate text-sm">{{ scenicLocationText }}</span>
          </n-space>

          <div class="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            <div class="tourist-map__stat"><n-icon><LocationOutline /></n-icon><span>{{ spots.length }} 个景点</span></div>
            <div class="tourist-map__stat"><n-icon><FlagOutline /></n-icon><span>{{ displayRoutes.length }} 条路线</span></div>
            <div class="tourist-map__stat"><n-icon><TicketOutline /></n-icon><span>{{ geoFeatures.length }} 个要素</span></div>
          </div>

          <n-button type="primary" size="large" round block @click="handleAskAi">
            <template #icon><n-icon><ChatbubbleEllipsesOutline /></n-icon></template>
            咨询智能问答
          </n-button>

          <p class="m-0 text-sm leading-7 text-slate-700">
            {{ selectedSpot?.spotName ? `已选中：${selectedSpot.spotName}` : scenicArea?.description || '这里会展示景区范围、景点、路线和服务设施，方便游客在手机端快速了解导览信息。' }}
          </p>

          <section class="grid gap-2">
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="m-0 text-base font-bold text-slate-950">推荐路线</h2>
              <small class="text-xs text-slate-500">点击开关显示</small>
            </div>
            <div v-if="recommendedRoutes.length" class="grid gap-2">
              <button
                v-for="item in recommendedRoutes"
                :key="item.id"
                type="button"
                class="tourist-map__route"
                :class="{
                  'tourist-map__route--active': isRouteVisible(item.id),
                  'tourist-map__route--disabled': !hasRouteGeojson(item),
                  'tourist-map__route--agent': item.routeType === 'agent_custom',
                }"
                @click="toggleRoute(item.id)"
              >
                <span class="truncate">{{ item.routeName || '未命名路线' }}</span>
                <n-tag :type="isRouteVisible(item.id) ? 'success' : 'default'" size="small" round>
                  {{ hasRouteGeojson(item) ? (isRouteVisible(item.id) ? '已显示' : '可显示') : '未配置' }}
                </n-tag>
              </button>
            </div>
            <p v-else-if="isLoadingAgentRoute" class="m-0 text-sm text-slate-400">正在加载专属路线...</p>
            <p v-else class="m-0 text-sm text-slate-400">当前景区暂无推荐路线。</p>
          </section>

          <section class="grid gap-2">
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="m-0 text-base font-bold text-slate-950">地图图例</h2>
              <small class="text-xs text-slate-500">游客端展示重点</small>
            </div>
            <div class="flex flex-wrap gap-2">
              <n-tag v-for="item in mapLegendItems" :key="item.label" round :bordered="false">
                <template #icon>
                  <i v-if="item.type === 'line'" class="h-1 w-8 rounded-full" :class="item.className"></i>
                  <i v-else class="h-2.5 w-2.5 rounded-full" :class="item.className"></i>
                </template>
                {{ item.label }}
              </n-tag>
            </div>
          </section>

          <section class="grid gap-2">
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="m-0 text-base font-bold text-slate-950">推荐景点</h2>
              <small class="truncate text-xs text-slate-500">{{ selectedSpot?.spotName || '点击地图标记查看' }}</small>
            </div>
            <div v-if="highlightedSpots.length" class="flex flex-wrap gap-2">
              <n-tag v-for="item in highlightedSpots" :key="item.id" round>{{ item.spotName || '未命名景点' }}</n-tag>
            </div>
            <p v-else class="m-0 text-sm text-slate-400">当前景区暂无景点类型的推荐数据。</p>
          </section>

          <n-alert v-if="scenicArea?.openingHours" type="warning" :bordered="false">
            <template #icon><n-icon><TimeOutline /></n-icon></template>
            {{ scenicArea.openingHours }}
          </n-alert>
        </div>
      </n-card>
    </transition>
  </section>
</template>

<style scoped>
.tourist-map {
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  border-radius: 24px;
  box-shadow: 0 24px 58px rgba(15, 23, 42, 0.16);
  contain: layout paint;
}

.tourist-map__spin,
.tourist-map__spin :deep(.n-spin-content),
.tourist-map__spin :deep(.map-canvas) {
  height: 100%;
}

.tourist-map__spin {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.tourist-map__top-card {
  width: min(620px, 100%);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(16px);
}

.tourist-map__top-card :deep(.n-card__content) {
  padding: 10px 12px;
}

.tourist-map__titlebar-control {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(560px, 100%);
  min-width: 0;
}

.tourist-map__titlebar-select {
  width: min(340px, 42vw);
  min-width: 220px;
}

.tourist-map__select :deep(.n-base-selection) {
  --n-height: 30px;
  --n-border: 0;
  --n-border-hover: 0;
  --n-border-focus: 0;
  --n-box-shadow-focus: none;
  --n-color: transparent;
  --n-padding-single: 0;
  --n-font-size: 18px;
  font-weight: 800;
}

.tourist-map__top-info {
  min-width: 148px;
  border-left: 1px solid #e2e8f0;
  color: #475569;
}

.tourist-map__top-info :deep(.n-button__content) {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.tourist-map__top-info span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;
}

.tourist-map__panel {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 5;
  width: min(410px, calc(100% - 120px));
  max-height: calc(100% - 112px);
  overflow: auto;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 20px 46px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(16px);
}

.tourist-map__stat {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  background: #f8fafc;
  padding: 8px 6px;
  color: #334155;
  font-size: 12px;
  white-space: nowrap;
}

.tourist-map__route {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
}

.tourist-map__route:hover {
  background: #f8fafc;
}

.tourist-map__route--active {
  border-color: rgba(15, 118, 110, 0.42);
  background: rgba(15, 118, 110, 0.08);
  color: #0f766e;
}

.tourist-map__route--agent {
  border-color: rgba(124, 58, 237, 0.32);
  background: rgba(124, 58, 237, 0.06);
}

.tourist-map__route--disabled {
  color: #94a3b8;
  cursor: not-allowed;
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

  .tourist-map__select :deep(.n-base-selection) {
    font-size: 16px;
  }

  .tourist-map__titlebar-control {
    gap: 6px;
    width: 100%;
  }

  .tourist-map__titlebar-select {
    flex: 1;
    width: auto;
    min-width: 0;
  }

  .tourist-map__top-info {
    min-width: auto;
    padding-left: 8px;
  }

  .tourist-map__top-info span {
    display: none;
  }

  .tourist-map__panel {
    top: 82px;
    left: 12px;
    right: 12px;
    bottom: auto;
    width: auto;
    max-height: min(42vh, 340px);
  }
}
</style>
