<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  AlarmClock,
  ArrowLeft,
  Calendar,
  Clock,
  CloseBold,
  DataAnalysis,
  Histogram,
  Location,
  MapLocation,
  Refresh,
  TrendCharts,
  User,
  WarningFilled,
} from '@element-plus/icons-vue'
import { getReservationDashboardApi } from '@/api/reservation'

echarts.use([LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const emit = defineEmits(['navigate'])

const sourceChartRef = ref(null)
const trendChartRef = ref(null)
const loading = ref(false)
const useMockData = ref(false)
const selectedScenicAreaId = ref('')
const selectedDate = ref(formatDate())
const currentTime = ref(new Date())

let clockTimer = null
let sourceChart = null
let trendChart = null

const sourceColorMap = {
  FRONTEND: '#0fa896',
  AGENT: '#2296f3',
  ADMIN: '#ffae42',
}

const statusColorMap = {
  CONFIRMED: '#0f9f96',
  PENDING: '#ff9f1c',
  COMPLETED: '#37b65f',
  CANCELLED: '#ff4d4f',
  EXPIRED: '#8b9bb2',
}

const mockDashboard = {
  scenicAreas: [
    { id: 1, name: '万旅山水景区' },
    { id: 2, name: '花溪湖景区' },
  ],
  summary: {
    orderCount: 1286,
    orderCompareText: '较昨日 +12.8%',
    visitorCount: 3842,
    visitorHint: '峰值接近午后',
    capacityUsageRate: 76,
    capacityHint: '3个景点偏紧',
    cancelRate: 6,
    cancelHint: '高于近7日均值',
  },
  capacityRanks: [
    { spotId: 101, spotName: '云顶观景台', usageRate: 93 },
    { spotId: 102, spotName: '水岸栈道', usageRate: 84 },
    { spotId: 103, spotName: '花溪入口', usageRate: 71 },
    { spotId: 104, spotName: '古桥广场', usageRate: 66 },
    { spotId: 105, spotName: '游客中心', usageRate: 58 },
  ],
  sourceDistribution: [
    { sourceType: 'FRONTEND', sourceName: '前台', rate: 62 },
    { sourceType: 'AGENT', sourceName: 'Agent', rate: 24 },
    { sourceType: 'ADMIN', sourceName: '后台', rate: 14 },
  ],
  statusDistribution: [
    { status: 'CONFIRMED', statusName: '已预约', rate: 52 },
    { status: 'PENDING', statusName: '待确认', rate: 16 },
    { status: 'COMPLETED', statusName: '已完成', rate: 16 },
    { status: 'CANCELLED', statusName: '已取消', rate: 16 },
  ],
  heatSpots: [
    { spotId: 101, spotName: '云顶观景台', usageRate: 93, level: 'danger', remainingCount: 34 },
    { spotId: 102, spotName: '水岸栈道', usageRate: 84, level: 'warning', remainingCount: 72 },
    { spotId: 103, spotName: '花溪入口', usageRate: 71, level: 'normal', remainingCount: 151 },
    { spotId: 104, spotName: '古桥广场', usageRate: 66, level: 'normal', remainingCount: 198 },
  ],
  trend: [
    { label: '04-28', orderCount: 980, visitorCount: 1820 },
    { label: '04-29', orderCount: 1320, visitorCount: 2240 },
    { label: '04-30', orderCount: 1780, visitorCount: 2480 },
    { label: '05-01', orderCount: 3160, visitorCount: 2680 },
    { label: '05-02', orderCount: 3680, visitorCount: 2980 },
    { label: '05-03', orderCount: 4060, visitorCount: 3340 },
    { label: '05-04', orderCount: 4860, visitorCount: 4120 },
  ],
  warnings: [
    { title: '云顶观景台 10:00 快满', tag: '紧张', level: 'danger', description: '剩余8个名额，建议暂停推荐或追加临时容量' },
    { title: '水岸栈道 14:00 偏紧', tag: '偏紧', level: 'warning', description: '团队预约集中，需留意检票和分流安排' },
    { title: '取消率异常 6.4%', tag: '异常', level: 'warning', description: '高于均值，建议排查天气和订单确认流程' },
  ],
  liveActivities: [
    { timeText: '00:31', title: '王** 预约 云顶观景台', description: '来源：前台，10:00-11:00' },
    { timeText: '00:22', title: '李** 取消 水岸栈道', description: '原因：行程变动' },
    { timeText: '00:15', title: '张** 预约 花溪入口', description: '来源：Agent' },
    { timeText: '00:09', title: '团队单 新增 28 人', description: '时段：14:00-15:00' },
  ],
  peakTimes: [
    { timeRange: '09:00-10:00', visitorCount: 624 },
    { timeRange: '10:00-11:00', visitorCount: 968 },
    { timeRange: '14:00-15:00', visitorCount: 812 },
  ],
}

const dashboard = reactive(structuredClone(mockDashboard))

const timeText = computed(() => {
  const timeParts = [currentTime.value.getHours(), currentTime.value.getMinutes(), currentTime.value.getSeconds()]
  return timeParts.map((item) => String(item).padStart(2, '0')).join(':')
})

const metrics = computed(() => [
  {
    title: '今日预约',
    value: formatNumber(dashboard.summary.orderCount),
    desc: dashboard.summary.orderCompareText || '暂无对比数据',
    icon: Calendar,
    tone: 'teal',
    trend: String(dashboard.summary.orderCompareText || '').includes('+') ? 'up' : '',
  },
  {
    title: '今日游客',
    value: formatNumber(dashboard.summary.visitorCount),
    desc: dashboard.summary.visitorHint || '暂无峰值提示',
    icon: User,
    tone: 'teal',
  },
  {
    title: '容量利用率',
    value: `${formatRate(dashboard.summary.capacityUsageRate)}%`,
    desc: dashboard.summary.capacityHint || '暂无容量提示',
    icon: DataAnalysis,
    tone: 'teal',
  },
  {
    title: '取消率',
    value: `${formatRate(dashboard.summary.cancelRate)}%`,
    desc: dashboard.summary.cancelHint || '暂无取消率提示',
    icon: CloseBold,
    tone: 'teal',
    trend: 'up-danger',
  },
  {
    title: '预警数',
    value: formatNumber(warnings.value.length),
    desc: warnings.value.length ? '需重点关注' : '暂无预警',
    icon: WarningFilled,
    tone: 'danger',
  },
])

const capacityRanks = computed(() =>
  dashboard.capacityRanks.slice(0, 5).map((item) => ({
    name: item.spotName || item.name || '-',
    rate: toNumber(item.usageRate ?? item.rate),
  })),
)

const sourceDistribution = computed(() =>
  dashboard.sourceDistribution.map((item) => ({
    name: item.sourceName || item.name || item.sourceType || '-',
    value: toNumber(item.rate ?? item.value),
    color: item.color || sourceColorMap[item.sourceType] || '#0fa896',
  })),
)

const orderStatuses = computed(() =>
  dashboard.statusDistribution.map((item) => ({
    name: item.statusName || item.name || item.status || '-',
    rate: toNumber(item.rate),
    color: item.color || statusColorMap[item.status] || '#0f9f96',
  })),
)

const heatSpots = computed(() =>
  dashboard.heatSpots.slice(0, 4).map((item) => {
    const rate = toNumber(item.usageRate ?? item.rate)
    const level = item.level || rateToLevel(rate)
    return {
      name: item.spotName || item.name || '-',
      rate,
      status: levelText(level),
      level,
      remain: toNumber(item.remainingCount ?? item.remain),
    }
  }),
)

const warnings = computed(() =>
  dashboard.warnings.slice(0, 3).map((item) => ({
    title: item.title || '-',
    tag: item.tag || levelText(item.level),
    level: item.level === 'danger' ? 'danger' : item.level === 'warning' ? 'warning' : 'orange',
    desc: item.description || item.desc || '',
  })),
)

const liveActivities = computed(() =>
  dashboard.liveActivities.slice(0, 4).map((item) => ({
    time: item.time || item.timeText || '刚刚',
    title: item.title || '-',
    desc: item.description || item.desc || '',
    type: inferActivityType(item.title),
  })),
)

const peakTimes = computed(() => {
  const rows = dashboard.peakTimes.slice(0, 3)
  const maxVisitors = Math.max(...rows.map((item) => toNumber(item.visitorCount ?? item.visitors)), 1)
  return rows.map((item) => {
    const visitors = toNumber(item.visitorCount ?? item.visitors)
    return {
      time: item.timeRange || item.time || '-',
      visitors,
      rate: Math.round((visitors / maxVisitors) * 100),
    }
  })
})

function getRateColor(rate) {
  if (rate >= 90) return '#ff4d4f'
  if (rate >= 80) return '#ff9f1c'
  if (rate >= 70) return '#2fbf71'
  return '#16b9ad'
}

async function fetchDashboard({ silent = false } = {}) {
  loading.value = true
  try {
    // 重点：看板 date 统一传预约日期 visitDate，不按订单创建日期统计。
    const result = await getReservationDashboardApi({
      scenicAreaId: selectedScenicAreaId.value || undefined,
      date: selectedDate.value || undefined,
    })
    Object.assign(dashboard, normalizeDashboard(result))
    useMockData.value = false
    await nextTick()
    renderSourceChart()
    renderTrendChart()
    resizeCharts()
  } catch {
    Object.assign(dashboard, structuredClone(mockDashboard))
    useMockData.value = true
    await nextTick()
    renderSourceChart()
    renderTrendChart()
    resizeCharts()
    if (!silent) ElMessage.warning('预约运营看板接口暂不可用，当前展示示例数据')
  } finally {
    loading.value = false
  }
}

function normalizeDashboard(result = {}) {
  const nextDashboard = {
    ...structuredClone(mockDashboard),
    ...result,
    summary: { ...mockDashboard.summary, ...(result.summary || {}) },
    scenicAreas: normalizeArray(result.scenicAreas, mockDashboard.scenicAreas),
    capacityRanks: normalizeArray(result.capacityRanks, mockDashboard.capacityRanks),
    sourceDistribution: normalizeArray(result.sourceDistribution, mockDashboard.sourceDistribution),
    statusDistribution: normalizeArray(result.statusDistribution, mockDashboard.statusDistribution),
    heatSpots: normalizeArray(result.heatSpots, mockDashboard.heatSpots),
    trend: normalizeArray(result.trend, mockDashboard.trend),
    warnings: Array.isArray(result.warnings) ? result.warnings : mockDashboard.warnings,
    liveActivities: Array.isArray(result.liveActivities) ? result.liveActivities : mockDashboard.liveActivities,
    peakTimes: normalizeArray(result.peakTimes, mockDashboard.peakTimes),
  }

  return nextDashboard
}

function normalizeArray(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback
}

function initCharts() {
  if (!sourceChartRef.value || !trendChartRef.value) return

  sourceChart = echarts.init(sourceChartRef.value)
  trendChart = echarts.init(trendChartRef.value)

  renderSourceChart()
  renderTrendChart()
}

function renderSourceChart() {
  if (!sourceChart) return

  sourceChart.setOption({
    color: sourceDistribution.value.map((item) => item.color),
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {d}%',
      backgroundColor: 'rgba(15, 23, 42, 0.86)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
    },
    series: [
      {
        name: '预约来源占比',
        type: 'pie',
        radius: ['54%', '78%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: '#ffffff',
          borderWidth: 3,
          borderRadius: 8,
        },
        data: sourceDistribution.value,
      },
    ],
  })
}

function renderTrendChart() {
  if (!trendChart) return

  trendChart.setOption({
    color: ['#0fa896', '#ff9700'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.86)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
    },
    legend: {
      top: 0,
      right: 12,
      itemWidth: 20,
      itemHeight: 8,
      textStyle: { color: '#53657d', fontWeight: 600 },
    },
    grid: {
      top: 42,
      right: 24,
      bottom: 28,
      left: 56,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dashboard.trend.map((item) => item.label),
      axisLine: { lineStyle: { color: '#dce7ef' } },
      axisTick: { show: false },
      axisLabel: { color: '#54657d', fontWeight: 600 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 5000,
      interval: 1000,
      axisLabel: { color: '#54657d' },
      splitLine: { lineStyle: { color: '#e7eef4', type: 'dashed' } },
    },
    series: [
      {
        name: '订单',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 4 },
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        data: dashboard.trend.map((item) => toNumber(item.orderCount)),
      },
      {
        name: '游客',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 4 },
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        data: dashboard.trend.map((item) => toNumber(item.visitorCount)),
      },
    ],
  })
}

function resizeCharts() {
  sourceChart?.resize()
  trendChart?.resize()
}

function refreshDashboard() {
  currentTime.value = new Date()
  fetchDashboard()
}

function backToConsole() {
  emit('navigate', 'tourist-map')
}

function formatDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN')
}

function formatRate(value) {
  const number = toNumber(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(1)
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function rateToLevel(rate) {
  if (rate >= 90) return 'danger'
  if (rate >= 80) return 'warning'
  return 'normal'
}

function levelText(level) {
  if (level === 'danger') return '紧张'
  if (level === 'warning') return '偏紧'
  return '正常'
}

function inferActivityType(title = '') {
  if (title.includes('取消')) return 'cancel'
  if (title.includes('团队')) return 'team'
  return 'reserve'
}

onMounted(async () => {
  clockTimer = window.setInterval(() => {
    currentTime.value = new Date()
  }, 1000)

  await nextTick()
  initCharts()
  fetchDashboard({ silent: true })
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
  window.removeEventListener('resize', resizeCharts)
  sourceChart?.dispose()
  trendChart?.dispose()
})

watch([selectedScenicAreaId, selectedDate], () => {
  fetchDashboard()
})
</script>

<template>
  <section class="reservation-dashboard-v2" v-loading="loading">
    <!-- 顶部标题栏：展示品牌、页面标题和运营筛选项 -->
    <header class="screen-header">
      <div class="brand-block">
        <div class="brand-logo" aria-label="Wanlv">
          <span class="brand-logo__peak"></span>
          <span class="brand-logo__wave"></span>
        </div>
        <div class="brand-title">
          <p>WANLV RESERVATION OPERATION</p>
          <h1>景区预约运营大屏</h1>
        </div>
      </div>

      <div class="tech-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div class="header-actions">
        <el-select v-model="selectedScenicAreaId" class="header-control" size="large" clearable placeholder="全部景区">
          <template #prefix>
            <el-icon>
              <Location />
            </el-icon>
          </template>
          <el-option v-for="item in dashboard.scenicAreas" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>

        <el-date-picker v-model="selectedDate" class="header-control header-control--date" type="date"
          value-format="YYYY-MM-DD" size="large" placeholder="日期">
          <template #prefix>
            <el-icon>
              <Calendar />
            </el-icon>
          </template>
        </el-date-picker>

        <div class="time-pill">
          <el-icon>
            <Clock />
          </el-icon>
          <span>当前时间：</span>
          <strong>{{ timeText }}</strong>
        </div>

        <el-button class="back-button" size="large" @click="backToConsole">
          <el-icon>
            <ArrowLeft />
          </el-icon>
          <span>进入系统</span>
        </el-button>

        <el-button class="refresh-button" size="large" :loading="loading" @click="refreshDashboard">
          <span class="refresh-button__icon">
            <el-icon>
              <Refresh />
            </el-icon>
          </span>
          <span>刷新</span>
        </el-button>
      </div>
    </header>

    <el-alert v-if="useMockData" class="mock-alert" title="预约运营看板接口暂不可用，当前展示示例数据。" type="warning" :closable="false"
      show-icon />

    <!-- 顶部核心指标：按日期展示景区真实承载状态 -->
    <section class="metric-grid" aria-label="核心指标">
      <article v-for="item in metrics" :key="item.title" class="metric-card" :class="`metric-card--${item.tone}`">
        <div class="metric-card__icon">
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
        </div>
        <div class="metric-card__body">
          <span>{{ item.title }}</span>
          <strong>{{ item.value }}</strong>
          <p>
            {{ item.desc }}
            <i v-if="item.trend" :class="{ 'is-danger': item.trend === 'up-danger' }">▲</i>
          </p>
        </div>
      </article>
    </section>

    <!-- 主体三栏布局：左侧排名与结构，中间态势与趋势，右侧预警与动态 -->
    <main class="dashboard-grid">
      <aside class="dashboard-column dashboard-column--left">
        <section class="panel capacity-panel">
          <div class="panel-title">
            <el-icon>
              <Histogram />
            </el-icon>
            <h2>景点容量排行</h2>
          </div>
          <div class="rank-list">
            <div v-for="(item, index) in capacityRanks" :key="item.name" class="rank-row">
              <span class="rank-index">{{ index + 1 }}</span>
              <span class="rank-name">{{ item.name }}</span>
              <div class="rank-bar">
                <i :style="{ width: `${item.rate}%`, background: getRateColor(item.rate) }" />
              </div>
              <strong>{{ item.rate }}%</strong>
            </div>
          </div>
        </section>

        <section class="panel source-panel">
          <div class="panel-title">
            <el-icon>
              <Histogram />
            </el-icon>
            <h2>预约来源占比</h2>
          </div>
          <div class="source-content">
            <div ref="sourceChartRef" class="source-chart"></div>
            <div class="legend-list">
              <div v-for="item in sourceDistribution" :key="item.name" class="legend-row">
                <span :style="{ background: item.color }"></span>
                <em>{{ item.name }}</em>
                <strong>{{ item.value }}%</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="panel status-panel">
          <div class="panel-title">
            <el-icon>
              <Histogram />
            </el-icon>
            <h2>订单状态占比</h2>
          </div>
          <div class="status-list">
            <div v-for="item in orderStatuses" :key="item.name" class="status-row">
              <span>{{ item.name }}</span>
              <div class="status-bar">
                <i :style="{ width: `${item.rate}%`, background: item.color }" />
              </div>
              <strong>{{ item.rate }}%</strong>
            </div>
          </div>
        </section>
      </aside>

      <section class="dashboard-column dashboard-column--center">
        <section class="panel heat-panel">
          <div class="panel-title">
            <el-icon>
              <MapLocation />
            </el-icon>
            <h2>预约热力态势</h2>
          </div>
          <div class="heat-grid">
            <article v-for="item in heatSpots" :key="item.name" class="heat-card" :class="`heat-card--${item.level}`">
              <div class="heat-card__icon">
                <el-icon>
                  <MapLocation />
                </el-icon>
              </div>
              <div class="heat-card__main">
                <div class="heat-card__header">
                  <h3>{{ item.name }}</h3>
                  <span>{{ item.status }}</span>
                </div>
                <div class="heat-card__stats">
                  <div>
                    <span>容量利用率</span>
                    <strong>{{ item.rate }}%</strong>
                  </div>
                  <div>
                    <span>剩余名额</span>
                    <strong>{{ item.remain }}</strong>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="panel trend-panel">
          <div class="panel-title">
            <el-icon>
              <TrendCharts />
            </el-icon>
            <h2>近7日预约趋势</h2>
          </div>
          <div ref="trendChartRef" class="trend-chart"></div>
        </section>
      </section>

      <aside class="dashboard-column dashboard-column--right">
        <section class="panel warning-panel">
          <div class="panel-title panel-title--danger">
            <el-icon>
              <WarningFilled />
            </el-icon>
            <h2>实时预警</h2>
          </div>
          <div class="warning-list">
            <article v-for="item in warnings" :key="item.title" class="warning-card"
              :class="`warning-card--${item.level}`">
              <div class="warning-card__icon">!</div>
              <div>
                <div class="warning-card__top">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.tag }}</span>
                </div>
                <p>{{ item.desc }}</p>
              </div>
            </article>
            <div v-if="!warnings.length" class="empty-state">暂无数据</div>
          </div>
        </section>

        <section class="panel live-panel">
          <div class="panel-title">
            <el-icon>
              <Clock />
            </el-icon>
            <h2>最新预约动态</h2>
          </div>
          <div class="timeline-list">
            <article v-for="item in liveActivities" :key="`${item.time}-${item.title}`" class="timeline-item">
              <time>{{ item.time }}</time>
              <span class="timeline-dot" :class="`timeline-dot--${item.type}`"></span>
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.desc }}</p>
              </div>
            </article>
            <div v-if="!liveActivities.length" class="empty-state">暂无数据</div>
          </div>
        </section>
      </aside>
    </main>

    <!-- 底部高峰时段：用于运营值班判断分流重点 -->
    <section class="panel peak-panel">
      <div class="panel-title">
        <el-icon>
          <AlarmClock />
        </el-icon>
        <h2>高峰时段分布</h2>
      </div>
      <div class="peak-grid">
        <article v-for="item in peakTimes" :key="item.time" class="peak-card">
          <el-icon>
            <Clock />
          </el-icon>
          <div class="peak-card__body">
            <strong>{{ item.time }}</strong>
            <div class="peak-card__bar">
              <i :style="{ width: `${item.rate}%` }" />
            </div>
          </div>
          <span>{{ item.visitors }}<em>人</em></span>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.reservation-dashboard-v2 {
  min-height: 100vh;
  padding: clamp(18px, 1.45vw, 28px) clamp(20px, 1.65vw, 32px);
  color: #10203c;
  background:
    radial-gradient(circle at 12% 0%, rgba(49, 195, 183, 0.18), transparent 24%),
    radial-gradient(circle at 90% 10%, rgba(33, 150, 243, 0.12), transparent 26%),
    linear-gradient(180deg, #f6fbff 0%, #eef6fb 100%);
  overflow: auto;
}

.screen-header {
  display: grid;
  grid-template-columns: minmax(330px, auto) minmax(110px, 1fr) auto;
  align-items: center;
  gap: clamp(14px, 1.45vw, 28px);
  margin-bottom: 22px;
}

.mock-alert {
  margin: -8px 0 16px;
  border-radius: 10px;
}

.brand-block,
.header-actions,
.panel-title,
.metric-card,
.rank-row,
.legend-row,
.status-row,
.heat-card,
.warning-card__top,
.timeline-item,
.peak-card {
  display: flex;
  align-items: center;
}

.brand-block {
  gap: 20px;
}

.brand-logo {
  position: relative;
  width: clamp(58px, 3.75vw, 72px);
  height: clamp(58px, 3.75vw, 72px);
  flex: 0 0 clamp(58px, 3.75vw, 72px);
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(16, 169, 153, 0.14), rgba(255, 255, 255, 0.78));
}

.brand-logo__peak,
.brand-logo__peak::before,
.brand-logo__peak::after {
  position: absolute;
  bottom: 26px;
  display: block;
  width: 16px;
  height: 42px;
  border-radius: 10px 10px 4px 4px;
  background: linear-gradient(180deg, #0a938f, #16b9ad);
  transform: skewX(-26deg);
  content: '';
}

.brand-logo__peak {
  left: 21px;
}

.brand-logo__peak::before {
  left: -16px;
  height: 28px;
}

.brand-logo__peak::after {
  left: 16px;
  height: 34px;
}

.brand-logo__wave {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 13px;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, #10a999, #50d4cd);
  box-shadow: 0 10px 0 rgba(16, 169, 153, 0.22);
}

.brand-title p {
  margin: 0 0 4px;
  color: #0b9d95;
  font-size: clamp(12px, 0.78vw, 15px);
  font-weight: 800;
  letter-spacing: 3px;
}

.brand-title h1 {
  margin: 0;
  color: #061938;
  font-size: clamp(30px, 2.08vw, 40px);
  line-height: 1.05;
  font-weight: 900;
}

.tech-lines {
  position: relative;
  height: 68px;
  opacity: 0.45;
}

.tech-lines::before {
  position: absolute;
  inset: 3px auto auto 4px;
  width: 82px;
  height: 48px;
  background-image: radial-gradient(#80d8d5 1.4px, transparent 1.4px);
  background-size: 10px 10px;
  content: '';
}

.tech-lines span {
  position: absolute;
  left: 86px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, #6bd7d3, transparent);
}

.tech-lines span:nth-child(1) {
  top: 15px;
  width: 190px;
}

.tech-lines span:nth-child(2) {
  top: 34px;
  width: 310px;
}

.tech-lines span:nth-child(3) {
  top: 53px;
  width: 210px;
}

.header-actions {
  justify-content: flex-end;
  gap: clamp(8px, 0.62vw, 12px);
  min-width: 0;
}

.header-control {
  width: clamp(160px, 10.9vw, 210px);
}

.header-control--date {
  width: clamp(170px, 10.4vw, 200px);
}

.time-pill,
.back-button,
.refresh-button,
.header-actions :deep(.el-input__wrapper) {
  height: 46px;
  border: 1px solid #cfe0ec;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 22px rgba(25, 88, 120, 0.08);
}

.header-actions :deep(.el-input__wrapper) {
  padding: 0 16px;
}

.time-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 clamp(10px, 0.83vw, 16px);
  color: #31435d;
  font-weight: 700;
  white-space: nowrap;
}

.time-pill .el-icon,
.header-actions :deep(.el-icon) {
  color: #0f9f96;
  font-size: 20px;
}

.time-pill strong {
  color: #05a37f;
  font-variant-numeric: tabular-nums;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-color: #b9d7e4;
  background: rgba(255, 255, 255, 0.94);
  color: #18314e;
  font-weight: 800;
}

.back-button :deep(.el-icon) {
  color: #0f9f96;
}

.refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-color: transparent;
  background: linear-gradient(135deg, #0b928e, #12a897);
  color: #fff;
  font-weight: 800;
  min-width: 96px;
}

.refresh-button :deep(.el-icon) {
  color: #fff;
}

.refresh-button__icon {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
}

.refresh-button__icon .el-icon {
  font-size: 17px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: clamp(12px, 1.25vw, 24px);
  margin-bottom: 22px;
}

.metric-card,
.panel {
  border: 1px solid rgba(198, 219, 232, 0.88);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 14px 36px rgba(34, 83, 111, 0.09);
}

.metric-card {
  min-height: 154px;
  gap: clamp(14px, 1.25vw, 24px);
  padding: clamp(18px, 1.25vw, 24px) clamp(18px, 1.75vw, 34px);
}

.metric-card__icon {
  display: grid;
  place-items: center;
  width: clamp(62px, 4.06vw, 78px);
  height: clamp(62px, 4.06vw, 78px);
  flex: 0 0 clamp(62px, 4.06vw, 78px);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(14, 177, 167, 0.16), rgba(14, 177, 167, 0.04));
  color: #0f9f96;
  font-size: clamp(30px, 2.08vw, 40px);
}

.metric-card--danger .metric-card__icon {
  background: linear-gradient(135deg, rgba(255, 77, 79, 0.16), rgba(255, 77, 79, 0.05));
  color: #ff4d4f;
}

.metric-card__body span,
.heat-card__stats span,
.warning-card p,
.timeline-item p {
  color: #506079;
}

.metric-card__body strong {
  display: block;
  margin-top: 6px;
  color: #061938;
  font-size: clamp(34px, 2.5vw, 48px);
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0;
}

.metric-card--danger .metric-card__body strong {
  color: #ff4d4f;
}

.metric-card__body p {
  margin: 9px 0 0;
  color: #53657d;
  font-size: 15px;
  font-weight: 700;
}

.metric-card__body i {
  margin-left: 6px;
  color: #20b486;
  font-style: normal;
}

.metric-card__body i.is-danger {
  color: #ff4d4f;
}

.dashboard-grid {
  display: grid;
  grid-template-columns:
    minmax(320px, 0.86fr) minmax(520px, 1.44fr) minmax(360px, 0.96fr);
  gap: clamp(12px, 0.83vw, 16px);
  margin-bottom: 14px;
}

.dashboard-column {
  display: grid;
  min-width: 0;
  gap: 16px;
  align-content: start;
}

.panel {
  min-width: 0;
  padding: clamp(16px, 0.94vw, 18px) clamp(16px, 1.14vw, 22px);
}

.panel-title {
  gap: 10px;
  margin-bottom: 16px;
  color: #0f9f96;
}

.panel-title h2 {
  margin: 0;
  color: #12213a;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 900;
}

.panel-title .el-icon {
  font-size: 22px;
}

.panel-title--danger {
  color: #ff4d4f;
}

.capacity-panel {
  min-height: 244px;
}

.rank-list,
.status-list,
.warning-list,
.timeline-list {
  display: grid;
  gap: 14px;
}

.rank-row {
  display: grid;
  grid-template-columns: 28px 110px minmax(0, 1fr) 48px;
  gap: 12px;
  color: #243653;
  font-size: 17px;
  font-weight: 800;
}

.rank-index {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: linear-gradient(135deg, #12b8ad, #1fcec1);
  color: #fff;
  font-size: 15px;
}

.rank-bar,
.status-bar,
.peak-card__bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e4eef5;
}

.rank-bar i,
.status-bar i,
.peak-card__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.rank-row strong,
.status-row strong {
  color: #10203c;
  text-align: right;
}

.source-panel,
.status-panel {
  min-height: 184px;
}

.source-content {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.source-chart {
  width: 170px;
  height: 128px;
}

.legend-list {
  display: grid;
  gap: 14px;
}

.legend-row {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) 48px;
  gap: 10px;
  color: #10203c;
  font-size: 17px;
  font-weight: 800;
}

.legend-row span {
  width: 12px;
  height: 12px;
  border-radius: 999px;
}

.legend-row em {
  font-style: normal;
  font-weight: 700;
}

.legend-row strong {
  text-align: right;
}

.status-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 48px;
  gap: 14px;
  color: #33415c;
  font-size: 16px;
  font-weight: 800;
}

.heat-panel {
  min-height: 374px;
}

.heat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.heat-card {
  gap: clamp(14px, 1.14vw, 22px);
  min-height: 136px;
  padding: clamp(16px, 1.04vw, 20px) clamp(16px, 1.25vw, 24px);
  border: 1px solid #d8e8ed;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(246, 253, 251, 0.86));
}

.heat-card__icon {
  display: grid;
  place-items: center;
  width: clamp(54px, 3.43vw, 66px);
  height: clamp(54px, 3.43vw, 66px);
  flex: 0 0 clamp(54px, 3.43vw, 66px);
  border-radius: 999px;
  background: linear-gradient(135deg, #27c275, #47d58a);
  color: #fff;
  font-size: 30px;
}

.heat-card--danger .heat-card__icon {
  background: linear-gradient(135deg, #ff6f6f, #ff4d4f);
}

.heat-card--warning .heat-card__icon {
  background: linear-gradient(135deg, #ffbc58, #ff9700);
}

.heat-card__main {
  flex: 1;
  min-width: 0;
}

.heat-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.heat-card__header h3 {
  margin: 0;
  color: #10203c;
  font-size: clamp(17px, 1.04vw, 20px);
  font-weight: 900;
}

.heat-card__header span,
.warning-card__top span {
  padding: 4px 10px;
  border-radius: 6px;
  background: #2fbf71;
  color: #fff;
  font-size: 14px;
  font-weight: 900;
}

.heat-card--danger .heat-card__header span {
  background: #ff4d4f;
}

.heat-card--warning .heat-card__header span {
  background: #ff9700;
}

.heat-card__stats {
  display: grid;
  grid-template-columns: minmax(96px, 1fr) minmax(118px, 1fr);
  gap: 16px;
  align-items: center;
}

.heat-card__stats div+div {
  padding-left: 16px;
  border-left: 1px solid #d8e8ed;
}

.heat-card__stats span {
  display: block;
  margin-bottom: 4px;
  font-weight: 700;
}

.heat-card__stats strong {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
  color: #19a56e;
  font-size: clamp(30px, 2.08vw, 40px);
  line-height: 1;
  font-weight: 900;
}

.heat-card--danger .heat-card__stats strong {
  color: #ff4d4f;
}

.heat-card--warning .heat-card__stats strong {
  color: #ff9700;
}

.heat-card__stats em {
  flex: 0 0 auto;
  color: #10203c;
  font-size: 16px;
  font-style: normal;
  font-weight: 800;
}

.trend-panel {
  min-height: 290px;
}

.trend-chart {
  height: clamp(210px, 12.4vw, 238px);
}

.warning-panel {
  min-height: 324px;
}

.warning-card {
  gap: 18px;
  padding: 17px 20px;
  border: 1px solid rgba(255, 77, 79, 0.24);
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(255, 77, 79, 0.12), rgba(255, 255, 255, 0.78));
}

.warning-card--warning {
  border-color: rgba(255, 151, 0, 0.28);
  background: linear-gradient(90deg, rgba(255, 151, 0, 0.13), rgba(255, 255, 255, 0.78));
}

.warning-card--orange {
  border-color: rgba(238, 169, 0, 0.3);
  background: linear-gradient(90deg, rgba(238, 169, 0, 0.12), rgba(255, 255, 255, 0.78));
}

.warning-card__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 999px;
  background: #ff4d4f;
  color: #fff;
  font-size: 28px;
  font-weight: 900;
}

.warning-card--warning .warning-card__icon {
  background: #ff9700;
}

.warning-card--orange .warning-card__icon {
  background: #eaa900;
}

.warning-card__top {
  justify-content: space-between;
  gap: 12px;
}

.warning-card__top strong {
  color: #10203c;
  font-size: 17px;
  font-weight: 900;
}

.warning-card--warning .warning-card__top span {
  background: #ff9700;
}

.warning-card--orange .warning-card__top span {
  background: #eaa900;
}

.warning-card p,
.timeline-item p {
  margin: 6px 0 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
}

.live-panel {
  min-height: 314px;
}

.timeline-list {
  position: relative;
  gap: 0;
}

.timeline-list:has(.timeline-item)::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 68px;
  width: 2px;
  background: #dce8f0;
  content: '';
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 168px;
  color: #7a8ba3;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0;
}

.timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 52px 28px minmax(0, 1fr);
  gap: 12px;
  min-height: 54px;
  align-items: start;
}

.timeline-item time {
  color: #33415c;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.timeline-dot {
  position: relative;
  z-index: 1;
  display: block;
  width: 28px;
  height: 28px;
  border: 7px solid #f8fcff;
  border-radius: 999px;
  background: #12b8ad;
  box-shadow: 0 0 0 1px #cfe0ec;
}

.timeline-dot--cancel {
  background: #ff9700;
}

.timeline-dot--team {
  background: #2296f3;
}

.timeline-item strong {
  color: #10203c;
  font-size: 16px;
  font-weight: 900;
}

.peak-panel {
  position: relative;
  overflow: hidden;
  padding-right: 120px;
}

.peak-panel::after {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 170px;
  height: 86px;
  background:
    linear-gradient(135deg, transparent 44%, rgba(65, 201, 195, 0.22) 45% 60%, transparent 61%),
    radial-gradient(circle at 78% 52%, rgba(65, 201, 195, 0.24), transparent 31%);
  content: '';
}

.peak-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.peak-card {
  gap: 18px;
  min-height: 66px;
  padding: 12px 24px;
  border: 1px solid #d3e6ee;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.peak-card>.el-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: 999px;
  background: #0f9f96;
  color: #fff;
}

.peak-card__body {
  flex: 1;
  min-width: 0;
}

.peak-card__body strong {
  display: block;
  margin-bottom: 8px;
  color: #10203c;
  font-size: 18px;
  font-weight: 900;
}

.peak-card__bar i {
  background: linear-gradient(90deg, #0f9f96, #17beb4);
}

.peak-card>span {
  color: #0f9f96;
  font-size: 28px;
  font-weight: 900;
}

.peak-card>span em {
  font-size: 15px;
  font-style: normal;
}

@media (max-width: 1500px) {
  .reservation-dashboard-v2 {
    padding: 22px;
  }

  .screen-header {
    grid-template-columns: 1fr;
  }

  .tech-lines {
    display: none;
  }

  .header-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .metric-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .metric-card {
    min-height: 128px;
  }

  .dashboard-grid {
    grid-template-columns:
      minmax(300px, 0.82fr) minmax(500px, 1.42fr) minmax(330px, 0.92fr);
  }

  .rank-row {
    grid-template-columns: 26px 94px minmax(0, 1fr) 42px;
    font-size: 15px;
  }

  .source-content {
    grid-template-columns: 140px minmax(0, 1fr);
  }

  .source-chart {
    width: 140px;
  }

  .heat-card__stats {
    grid-template-columns: minmax(82px, 1fr) minmax(104px, 1fr);
  }
}

@media (max-width: 1240px) {

  .screen-header,
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .brand-title h1 {
    font-size: 30px;
  }

  .metric-grid,
  .heat-grid,
  .peak-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    padding: 20px;
  }

  .source-content {
    grid-template-columns: 1fr;
  }

  .source-chart {
    width: 100%;
  }

  .peak-panel {
    padding-right: 22px;
  }

  .header-control,
  .header-control--date,
  .time-pill,
  .back-button,
  .refresh-button {
    width: 100%;
  }
}
</style>
