<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Location,
  MapLocation,
  MostlyCloudy,
  Refresh,
  Sunny,
  TrendCharts,
  Warning,
} from '@element-plus/icons-vue'
import { pageScenicAreasApi } from '@/api/map'
import { listReservationEnabledSpotsApi, listReservationSlotsApi } from '@/api/reservation'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const emit = defineEmits(['navigate'])

const trendChartRef = ref(null)
const scenicOptions = ref([])
const spotRows = ref([])
const selectedScenicAreaId = ref('')
const selectedDate = ref(formatDate())
const currentTime = ref(new Date())
const loading = reactive({
  scenic: false,
  dashboard: false,
})

let clockTimer = null
let trendChart = null

const futureDates = computed(() => {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return {
      value: formatDate(date),
      day: index === 0 ? '今天' : index === 1 ? '明天' : `${date.getMonth() + 1}/${date.getDate()}`,
      week: weekText(date),
    }
  })
})

const selectedScenicName = computed(() => {
  return scenicOptions.value.find((item) => Number(item.id) === Number(selectedScenicAreaId.value))?.scenicName || '全部景区'
})

const allSlots = computed(() => spotRows.value.flatMap((spot) => spot.slots))
const reservableSlots = computed(() => allSlots.value.filter((slot) => slot.available && toNumber(slot.remainingCount) > 0))
const totalCapacity = computed(() => sum(allSlots.value, 'totalCapacity'))
const totalRemaining = computed(() => sum(allSlots.value, 'remainingCount'))
const totalReserved = computed(() => Math.max(totalCapacity.value - totalRemaining.value, 0))
const usageRate = computed(() => (totalCapacity.value ? Math.round((totalReserved.value / totalCapacity.value) * 100) : 0))
const calmSpotCount = computed(() => spotCards.value.filter((item) => item.level === 'relaxed').length)

const timeText = computed(() => {
  return [currentTime.value.getHours(), currentTime.value.getMinutes(), currentTime.value.getSeconds()]
    .map((item) => String(item).padStart(2, '0'))
    .join(':')
})

const statusOverview = computed(() => {
  if (!allSlots.value.length) {
    return {
      label: '暂无放票',
      desc: '当前日期还没有开放预约时段',
      icon: Warning,
      tone: 'muted',
    }
  }

  if (!reservableSlots.value.length) {
    return {
      label: '名额已满',
      desc: '建议切换日期或关注后续放票',
      icon: Warning,
      tone: 'danger',
    }
  }

  if (usageRate.value >= 80) {
    return {
      label: '余量偏紧',
      desc: '热门时段较集中，建议尽快预约',
      icon: MostlyCloudy,
      tone: 'warning',
    }
  }

  return {
    label: '预约充足',
    desc: '当前仍有多个时段可预约',
    icon: Sunny,
    tone: 'success',
  }
})

const metricCards = computed(() => [
  {
    title: '可预约时段',
    value: reservableSlots.value.length,
    unit: '个',
    desc: allSlots.value.length ? `共开放 ${allSlots.value.length} 个时段` : '暂无时段',
    icon: Clock,
  },
  {
    title: '剩余名额',
    value: totalRemaining.value,
    unit: '人',
    desc: totalCapacity.value ? `总容量 ${totalCapacity.value} 人` : '暂无容量',
    icon: Calendar,
  },
  {
    title: '整体热度',
    value: usageRate.value,
    unit: '%',
    desc: statusOverview.value.desc,
    icon: TrendCharts,
  },
  {
    title: '舒适景点',
    value: calmSpotCount.value,
    unit: '处',
    desc: '低热度景点更适合错峰游览',
    icon: MapLocation,
  },
])

const spotCards = computed(() =>
  spotRows.value.map((spot) => {
    const capacity = sum(spot.slots, 'totalCapacity')
    const remaining = sum(spot.slots, 'remainingCount')
    const reserved = Math.max(capacity - remaining, 0)
    const rate = capacity ? Math.round((reserved / capacity) * 100) : 0
    const availableSlots = spot.slots.filter((slot) => slot.available && toNumber(slot.remainingCount) > 0)
    const bestSlot = [...availableSlots].sort((a, b) => toNumber(b.remainingCount) - toNumber(a.remainingCount))[0]

    return {
      ...spot,
      capacity,
      remaining,
      rate,
      availableCount: availableSlots.length,
      bestTime: bestSlot ? formatTimeRange(bestSlot) : '暂无可约',
      level: getSpotLevel(rate, availableSlots.length),
    }
  }),
)

const recommendedSpots = computed(() =>
  [...spotCards.value]
    .filter((item) => item.availableCount > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 3),
)

const peakSlots = computed(() => {
  const grouped = new Map()
  allSlots.value.forEach((slot) => {
    const key = formatTimeRange(slot)
    if (!grouped.has(key)) grouped.set(key, { time: key, capacity: 0, remaining: 0 })
    const row = grouped.get(key)
    row.capacity += toNumber(slot.totalCapacity)
    row.remaining += toNumber(slot.remainingCount)
  })

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      reserved: Math.max(item.capacity - item.remaining, 0),
      rate: item.capacity ? Math.round(((item.capacity - item.remaining) / item.capacity) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4)
})

const trendData = computed(() =>
  spotRows.value.map((spot) => ({
    name: spot.spotName,
    value: spotCards.value.find((item) => item.spotId === spot.spotId)?.rate || 0,
  })),
)

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

function normalizePageResult(result) {
  return {
    total: Number(result?.total || 0),
    records: Array.isArray(result?.records) ? result.records : [],
  }
}

async function fetchScenicOptions() {
  loading.scenic = true
  try {
    const page = normalizePageResult(await pageScenicAreasApi({ pageNum: 1, pageSize: 200, status: 1 }))
    scenicOptions.value = page.records
    if (!selectedScenicAreaId.value && page.records.length) {
      selectedScenicAreaId.value = page.records[0].id
    }
  } finally {
    loading.scenic = false
  }
}

async function fetchDashboard() {
  if (!selectedScenicAreaId.value) {
    spotRows.value = []
    renderTrendChart()
    return
  }

  loading.dashboard = true
  try {
    const spots = await listReservationEnabledSpotsApi(cleanParams({ scenicAreaId: selectedScenicAreaId.value }))
    const nextRows = await Promise.all(
      spots.map(async (spot) => {
        try {
          const result = await listReservationSlotsApi({
            spotId: Number(spot.spotId || spot.id),
            visitDate: selectedDate.value,
          })
          return {
            ...spot,
            spotId: spot.spotId || spot.id,
            slots: Array.isArray(result?.slots) ? result.slots : [],
          }
        } catch {
          return {
            ...spot,
            spotId: spot.spotId || spot.id,
            slots: [],
          }
        }
      }),
    )
    spotRows.value = nextRows
    await nextTick()
    renderTrendChart()
    resizeCharts()
  } catch {
    spotRows.value = []
    ElMessage.warning('预约状态暂时无法获取，请稍后再试')
  } finally {
    loading.dashboard = false
  }
}

function initChart() {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value)
  renderTrendChart()
}

function renderTrendChart() {
  if (!trendChart) return

  trendChart.setOption({
    color: ['#13a89e'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.86)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
      formatter(params) {
        const row = params?.[0]
        return `${row?.name || '-'}<br/>热度：${row?.value || 0}%`
      },
    },
    grid: { top: 20, right: 14, bottom: 30, left: 34 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.value.map((item) => item.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d8e6ee' } },
      axisLabel: { color: '#64748b', fontWeight: 700, interval: 0 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#64748b', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#e7eff5', type: 'dashed' } },
    },
    series: [
      {
        name: '景点热度',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 4 },
        areaStyle: { color: 'rgba(19, 168, 158, 0.12)' },
        data: trendData.value.map((item) => item.value),
      },
    ],
  })
}

function resizeCharts() {
  trendChart?.resize()
}

function chooseDate(date) {
  selectedDate.value = date
}

function refreshDashboard() {
  currentTime.value = new Date()
  fetchDashboard()
}

function backToConsole() {
  emit('navigate', 'overview')
}

function formatDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weekText(date) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
}

function formatTimeRange(row) {
  return `${String(row?.startTime || '').slice(0, 5)}-${String(row?.endTime || '').slice(0, 5)}`
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function sum(rows, field) {
  return rows.reduce((total, item) => total + toNumber(item?.[field]), 0)
}

function getSpotLevel(rate, availableCount) {
  if (!availableCount) return 'full'
  if (rate >= 80) return 'busy'
  if (rate >= 55) return 'normal'
  return 'relaxed'
}

function levelText(level) {
  if (level === 'full') return '不可预约'
  if (level === 'busy') return '偏热'
  if (level === 'normal') return '适中'
  return '舒适'
}

function levelDesc(level) {
  if (level === 'full') return '建议更换日期'
  if (level === 'busy') return '建议尽快预约'
  if (level === 'normal') return '名额仍可选择'
  return '适合错峰游览'
}

onMounted(async () => {
  clockTimer = window.setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
  await nextTick()
  initChart()
  await fetchScenicOptions()
  await fetchDashboard()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
})

watch([selectedScenicAreaId, selectedDate], () => {
  fetchDashboard()
})
</script>

<template>
  <section class="user-reservation-screen" v-loading="loading.scenic || loading.dashboard">
    <header class="screen-hero">
      <div class="hero-topline">
        <button type="button" class="icon-button" aria-label="返回控制台" @click="backToConsole">
          <el-icon>
            <ArrowLeft />
          </el-icon>
        </button>
        <div>
          <p>预约状态</p>
          <h1>{{ selectedScenicName }}</h1>
        </div>
        <button type="button" class="icon-button icon-button--primary" aria-label="刷新" @click="refreshDashboard">
          <el-icon>
            <Refresh />
          </el-icon>
        </button>
      </div>

      <div class="hero-status" :class="`hero-status--${statusOverview.tone}`">
        <div class="hero-status__icon">
          <el-icon>
            <component :is="statusOverview.icon" />
          </el-icon>
        </div>
        <div>
          <span>当前状态</span>
          <strong>{{ statusOverview.label }}</strong>
          <p>{{ statusOverview.desc }}</p>
        </div>
      </div>

      <div class="hero-controls">
        <el-select v-model="selectedScenicAreaId" class="hero-select" filterable placeholder="选择景区">
          <template #prefix>
            <el-icon>
              <Location />
            </el-icon>
          </template>
          <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
        </el-select>
        <div class="time-pill">
          <el-icon>
            <Clock />
          </el-icon>
          <span>{{ timeText }}</span>
        </div>
      </div>
    </header>

    <section class="date-strip" aria-label="预约日期">
      <button v-for="item in futureDates" :key="item.value" type="button" class="date-chip"
        :class="{ 'is-active': selectedDate === item.value }" @click="chooseDate(item.value)">
        <strong>{{ item.day }}</strong>
        <span>{{ item.week }}</span>
      </button>
    </section>

    <section class="metric-grid" aria-label="预约概览">
      <article v-for="item in metricCards" :key="item.title" class="metric-card">
        <div class="metric-card__icon">
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
        </div>
        <div>
          <span>{{ item.title }}</span>
          <strong>{{ item.value }}<em>{{ item.unit }}</em></strong>
          <p>{{ item.desc }}</p>
        </div>
      </article>
    </section>

    <section class="panel recommend-panel">
      <div class="panel-title">
        <el-icon>
          <Sunny />
        </el-icon>
        <h2>推荐预约</h2>
      </div>
      <div class="recommend-list">
        <article v-for="item in recommendedSpots" :key="item.spotId" class="recommend-card">
          <div>
            <strong>{{ item.spotName }}</strong>
            <span>{{ item.bestTime }}</span>
          </div>
          <p>剩余 {{ item.remaining }} 人，{{ levelDesc(item.level) }}</p>
        </article>
        <el-empty v-if="!recommendedSpots.length" description="当前日期暂无可推荐时段" :image-size="76" />
      </div>
    </section>

    <section class="panel spot-panel">
      <div class="panel-title">
        <el-icon>
          <MapLocation />
        </el-icon>
        <h2>景点预约状态</h2>
      </div>
      <div class="spot-list">
        <article v-for="item in spotCards" :key="item.spotId" class="spot-card" :class="`spot-card--${item.level}`">
          <div class="spot-card__top">
            <div>
              <h3>{{ item.spotName }}</h3>
              <p>{{ item.bestTime }} · {{ levelDesc(item.level) }}</p>
            </div>
            <span>{{ levelText(item.level) }}</span>
          </div>
          <div class="spot-card__bar">
            <i :style="{ width: `${item.rate}%` }" />
          </div>
          <div class="spot-card__meta">
            <span>热度 {{ item.rate }}%</span>
            <span>剩余 {{ item.remaining }} / {{ item.capacity }}</span>
          </div>
        </article>
        <el-empty v-if="!spotCards.length" description="当前景区暂无可预约景点" :image-size="88" />
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">
        <el-icon>
          <Clock />
        </el-icon>
        <h2>热门时段</h2>
      </div>
      <div class="slot-list">
        <article v-for="item in peakSlots" :key="item.time" class="slot-row">
          <strong>{{ item.time }}</strong>
          <div class="slot-row__bar"><i :style="{ width: `${item.rate}%` }" /></div>
          <span>{{ item.rate }}%</span>
        </article>
        <el-empty v-if="!peakSlots.length" description="暂无时段热度数据" :image-size="76" />
      </div>
    </section>
  </section>
</template>

<style scoped>
.user-reservation-screen {
  min-height: 100vh;
  padding: 14px;
  color: #10203c;
  background:
    radial-gradient(circle at 12% 0%, rgba(19, 168, 158, 0.2), transparent 28%),
    linear-gradient(180deg, #f4fbfa 0%, #eef6fb 100%);
  overflow: auto;
}

.screen-hero {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid rgba(199, 222, 231, 0.86);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18px 38px rgba(25, 88, 120, 0.11);
}

.hero-topline,
.hero-controls,
.panel-title,
.metric-card,
.spot-card__top,
.spot-card__meta,
.slot-row {
  display: flex;
  align-items: center;
}

.hero-topline {
  justify-content: space-between;
  gap: 12px;
}

.hero-topline p {
  margin: 0 0 4px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.hero-topline h1 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.18;
  font-weight: 900;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border: 1px solid #d3e2ea;
  border-radius: 14px;
  background: #fff;
  color: #0f766e;
  font-size: 18px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  cursor: pointer;
}

.icon-button--primary {
  border-color: transparent;
  background: linear-gradient(135deg, #0f9f96, #14b8a6);
  color: #fff;
}

.hero-status {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  min-height: 116px;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(19, 168, 158, 0.14), rgba(255, 255, 255, 0.7));
}

.hero-status__icon {
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  border-radius: 18px;
  background: #0f9f96;
  color: #fff;
  font-size: 30px;
}

.hero-status--warning .hero-status__icon {
  background: #f59e0b;
}

.hero-status--danger .hero-status__icon {
  background: #ef4444;
}

.hero-status--muted .hero-status__icon {
  background: #64748b;
}

.hero-status span,
.metric-card span,
.spot-card__meta,
.recommend-card span {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.hero-status strong {
  display: block;
  margin: 2px 0;
  color: #0f172a;
  font-size: 30px;
  line-height: 1.05;
  font-weight: 900;
}

.hero-status p,
.metric-card p,
.spot-card p,
.recommend-card p {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.45;
}

.hero-controls {
  gap: 10px;
}

.hero-select {
  flex: 1;
  min-width: 0;
}

.hero-controls :deep(.el-select__wrapper),
.time-pill {
  min-height: 44px;
  border-radius: 14px;
  box-shadow: none;
}

.time-pill {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #0f766e;
  font-weight: 800;
  white-space: nowrap;
}

.date-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(72px, 1fr);
  gap: 8px;
  margin: 14px 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.date-strip::-webkit-scrollbar {
  display: none;
}

.date-chip {
  display: grid;
  gap: 3px;
  min-height: 64px;
  padding: 10px 8px;
  border: 1px solid #d3e2ea;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
  color: #0f172a;
  cursor: pointer;
}

.date-chip strong {
  font-size: 15px;
}

.date-chip span {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.date-chip.is-active {
  border-color: transparent;
  background: linear-gradient(135deg, #0f9f96, #14b8a6);
  color: #fff;
}

.date-chip.is-active span {
  color: rgba(255, 255, 255, 0.78);
}

.metric-grid,
.spot-list,
.recommend-list,
.slot-list {
  display: grid;
  gap: 10px;
}

.metric-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 12px;
}

.metric-card,
.panel {
  border: 1px solid rgba(199, 222, 231, 0.86);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 14px 30px rgba(25, 88, 120, 0.08);
}

.metric-card {
  gap: 10px;
  min-height: 126px;
  padding: 14px;
}

.metric-card__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 14px;
  background: rgba(19, 168, 158, 0.12);
  color: #0f9f96;
  font-size: 22px;
}

.metric-card strong {
  display: block;
  margin: 4px 0;
  color: #0f172a;
  font-size: 26px;
  line-height: 1;
  font-weight: 900;
}

.metric-card em {
  margin-left: 2px;
  font-size: 13px;
  font-style: normal;
}

.panel {
  margin-top: 12px;
  padding: 16px;
}

.panel-title {
  gap: 8px;
  margin-bottom: 12px;
  color: #0f9f96;
}

.panel-title h2 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 900;
}

.recommend-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.12), rgba(255, 255, 255, 0.78));
}

.recommend-card div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.recommend-card strong,
.spot-card h3,
.slot-row strong {
  color: #0f172a;
  font-size: 16px;
  font-weight: 900;
}

.spot-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid #d8e7ee;
  border-radius: 16px;
  background: #fff;
}

.spot-card__top {
  justify-content: space-between;
  gap: 12px;
}

.spot-card h3 {
  margin: 0 0 4px;
}

.spot-card__top>span {
  flex: 0 0 auto;
  padding: 5px 10px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 12px;
  font-weight: 900;
}

.spot-card--normal .spot-card__top>span {
  background: #e0f2fe;
  color: #0369a1;
}

.spot-card--busy .spot-card__top>span {
  background: #fef3c7;
  color: #b45309;
}

.spot-card--full .spot-card__top>span {
  background: #fee2e2;
  color: #b91c1c;
}

.spot-card__bar,
.slot-row__bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e6eef4;
}

.spot-card__bar i,
.slot-row__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0f9f96, #14b8a6);
}

.spot-card--busy .spot-card__bar i,
.slot-row__bar i {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.spot-card--full .spot-card__bar i {
  background: linear-gradient(90deg, #ef4444, #fb7185);
}

.spot-card__meta {
  justify-content: space-between;
  gap: 12px;
}

.slot-row {
  display: grid;
  grid-template-columns: minmax(96px, 120px) minmax(0, 1fr) 44px;
  gap: 10px;
}

.slot-row span {
  color: #0f766e;
  font-weight: 900;
  text-align: right;
}

.trend-chart {
  height: 220px;
}

@media (min-width: 760px) {
  .user-reservation-screen {
    padding: 22px;
  }

  .screen-hero {
    grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.2fr);
    align-items: center;
  }

  .hero-topline,
  .hero-controls {
    grid-column: 1;
  }

  .hero-status {
    grid-row: 1 / span 2;
    grid-column: 2;
  }

  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .spot-list,
  .recommend-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1180px) {
  .user-reservation-screen {
    display: grid;
    grid-template-columns: minmax(320px, 0.95fr) minmax(520px, 1.45fr);
    gap: 16px;
    align-content: start;
    padding: 26px;
  }

  .screen-hero,
  .date-strip,
  .metric-grid {
    grid-column: 1 / -1;
  }

  .date-strip {
    grid-template-columns: repeat(7, minmax(72px, 1fr));
    grid-auto-flow: row;
    grid-auto-columns: initial;
    overflow-x: visible;
  }

  .metric-grid {
    margin-bottom: 0;
  }

  .spot-panel {
    grid-row: span 2;
  }

  .trend-panel {
    grid-column: 1 / -1;
  }
}

@media (max-width: 420px) {
  .user-reservation-screen {
    padding: 10px;
  }

  .screen-hero {
    padding: 14px;
    border-radius: 18px;
  }

  .hero-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .time-pill {
    justify-content: center;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .slot-row {
    grid-template-columns: 96px minmax(0, 1fr) 40px;
  }
}
</style>
