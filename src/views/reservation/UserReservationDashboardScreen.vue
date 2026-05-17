<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { pageScenicAreasApi } from '@/api/map'
import { listReservationEnabledSpotsApi, listReservationSlotsApi } from '@/api/reservation'

const message = useMessage()

const scenicOptions = ref([])
const spotRows = ref([])
const selectedScenicAreaId = ref(null)
const selectedDate = ref(formatDate())
const activeFilter = ref('all')
const currentTime = ref(new Date())
const headerToolbarReady = ref(false)
const showDateModal = ref(false)
const loading = reactive({
  scenic: false,
  dashboard: false,
})

let clockTimer = null

const scenicSelectOptions = computed(() =>
  scenicOptions.value.map((item) => ({
    label: item.scenicName,
    value: item.id,
  })),
)

const futureDates = computed(() => {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return {
      value: formatDate(date),
      title: index === 0 ? '今天' : index === 1 ? '明天' : `${date.getMonth() + 1}/${date.getDate()}`,
      week: weekText(date),
      date: formatDisplayDate(date),
    }
  })
})

const selectedDateInfo = computed(() => futureDates.value.find((item) => item.value === selectedDate.value) || futureDates.value[0])
const selectedScenicName = computed(() => {
  return scenicOptions.value.find((item) => Number(item.id) === Number(selectedScenicAreaId.value))?.scenicName || '全部景区'
})

const allSlots = computed(() => spotRows.value.flatMap((spot) => spot.slots))
const totalRemaining = computed(() => sum(allSlots.value, 'remainingCount'))

const spotCards = computed(() =>
  spotRows.value.map((spot) => {
    const capacity = sum(spot.slots, 'totalCapacity')
    const remaining = sum(spot.slots, 'remainingCount')
    const reserved = Math.max(capacity - remaining, 0)
    const heat = capacity ? Math.round((reserved / capacity) * 100) : 0
    const availableSlots = spot.slots.filter((slot) => slot.available && toNumber(slot.remainingCount) > 0)
    const bestSlot = [...availableSlots].sort((a, b) => toNumber(b.remainingCount) - toNumber(a.remainingCount))[0]
    const displaySlot = bestSlot || getFirstTimeSlot(spot.slots)
    const status = getSpotStatus(heat, availableSlots.length, capacity)

    return {
      ...spot,
      capacity,
      remaining,
      heat,
      status,
      statusText: statusText(status),
      area: spot.scenicAreaName || selectedScenicName.value,
      bestTime: displaySlot ? formatTimeRange(displaySlot) : '暂无开放时段',
      advice: statusAdvice(status),
      desc: spot.remark || '查看当前预约余量、开放时段与游览建议。',
    }
  }),
)

const filteredSpotCards = computed(() => {
  if (activeFilter.value === 'all') return spotCards.value
  return spotCards.value.filter((item) => item.status === activeFilter.value)
})

const stats = computed(() => {
  return {
    total: spotCards.value.length,
    available: spotCards.value.filter((item) => item.status === 'available').length,
    warning: spotCards.value.filter((item) => item.status === 'warning').length,
    full: spotCards.value.filter((item) => item.status === 'full').length,
    closed: spotCards.value.filter((item) => item.status === 'closed').length,
    totalRemain: totalRemaining.value,
  }
})

const filterOptions = [
  { key: 'all', label: '全部景点' },
  { key: 'available', label: '可预约' },
  { key: 'full', label: '不可预约' },
  { key: 'closed', label: '未开放' },
]

const timeText = computed(() => {
  return [currentTime.value.getHours(), currentTime.value.getMinutes(), currentTime.value.getSeconds()]
    .map((item) => String(item).padStart(2, '0'))
    .join(':')
})

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
  } catch {
    spotRows.value = []
    message.warning('预约状态暂时无法获取，请稍后再试')
  } finally {
    loading.dashboard = false
  }
}

function chooseDate(date) {
  selectedDate.value = date
  showDateModal.value = false
}

function refreshDashboard() {
  currentTime.value = new Date()
  fetchDashboard()
}

function formatDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}号`
}

function weekText(date) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
}

function getFirstTimeSlot(slots = []) {
  return [...slots]
    .filter((slot) => slot?.startTime && slot?.endTime)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))[0]
}

function formatTimeRange(row) {
  return `${String(row?.startTime || '').slice(0, 5)} - ${String(row?.endTime || '').slice(0, 5)}`
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function sum(rows, field) {
  return rows.reduce((total, item) => total + toNumber(item?.[field]), 0)
}

function getSpotStatus(heat, availableCount, capacity) {
  if (!capacity) return 'closed'
  if (!availableCount) return 'full'
  if (heat >= 80) return 'warning'
  return 'available'
}

function statusText(status) {
  if (status === 'available') return '可预约'
  if (status === 'warning') return '即将约满'
  if (status === 'full') return '不可预约'
  return '未开放'
}

function statusAdvice(status) {
  if (status === 'available') return '当前余量充足，适合预约。'
  if (status === 'warning') return '剩余名额较少，建议尽快预约。'
  if (status === 'full') return '不可预约，建议切换日期或选择其他景点。'
  return '暂未开放预约，请关注后续放票。'
}

function statusStyle(status) {
  const map = {
    available: {
      tagType: 'success',
      text: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      dot: 'bg-emerald-500',
      progress: 'success',
    },
    warning: {
      tagType: 'warning',
      text: 'text-orange-700',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      dot: 'bg-orange-500',
      progress: 'warning',
    },
    full: {
      tagType: 'error',
      text: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-100',
      dot: 'bg-red-500',
      progress: 'error',
    },
    closed: {
      tagType: 'default',
      text: 'text-slate-500',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      dot: 'bg-slate-400',
      progress: 'default',
    },
  }
  return map[status] || map.closed
}

function remainText(item) {
  if (item.status === 'closed') return '暂无名额'
  return `${item.remaining} / ${item.capacity} 人`
}

onMounted(async () => {
  headerToolbarReady.value = Boolean(document.querySelector('#dashboard-user-reservation-toolbar'))
  clockTimer = window.setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
  await fetchScenicOptions()
  await fetchDashboard()
})

onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
})

watch([selectedScenicAreaId, selectedDate], () => {
  fetchDashboard()
})
</script>

<template>
  <Teleport v-if="headerToolbarReady" to="#dashboard-user-reservation-toolbar">
    <div class="dashboard-toolbar-control">
      <n-select v-model:value="selectedScenicAreaId" :options="scenicSelectOptions" :loading="loading.scenic"
        class="dashboard-scenic-select" placeholder="选择景区" />
    </div>
  </Teleport>

  <n-spin class="dashboard-screen-spin" :show="loading.scenic || loading.dashboard">
    <section class="appointment-status-screen">
      <main class="appointment-status-screen__inner">
        <section class="dashboard-summary-card shadow-card">
          <div class="dashboard-summary-grid">
            <div class="p-4 sm:p-5 lg:p-6">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div
                    class="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm">
                    <span class="status-dot bg-teal-600"></span>
                    今日预约概况
                  </div>
                  <h2 class="dashboard-summary-title">
                    <span>{{ selectedScenicName }} · {{ selectedDateInfo?.date }}</span>
                    <n-button size="small" round type="primary" secondary @click="showDateModal = true">
                      切换日期
                    </n-button>
                  </h2>
                  <p class="mt-2 max-w-2xl text-xs leading-5 text-slate-600">
                    当前共 {{ stats.total }} 个景点，{{ stats.available }} 个可预约，{{ stats.warning }} 个即将约满，
                    {{ stats.full + stats.closed }} 个暂不可约。建议优先选择余量充足的景点，避开高峰时段。
                  </p>
                </div>

                <div class="dashboard-summary-remain rounded-2xl bg-white/86 p-3 shadow-sm backdrop-blur">
                  <div class="text-xs text-slate-500">当前可预约余量</div>
                  <div class="mt-1 flex items-end gap-1">
                    <span class="text-3xl font-black text-teal-700">{{ stats.totalRemain }}</span>
                    <span class="mb-1 text-xs text-slate-500">人</span>
                  </div>
                  <div class="mt-2 text-xs font-semibold text-slate-500">{{ timeText }}</div>
                </div>
              </div>
            </div>

            <div class="dashboard-stat-grid">
              <div class="dashboard-stat-card rounded-2xl bg-emerald-50 p-3">
                <div class="text-xs font-medium text-emerald-700">可预约</div>
                <div class="mt-1 text-xl font-black text-emerald-700">{{ stats.available }}</div>
              </div>
              <div class="dashboard-stat-card rounded-2xl bg-orange-50 p-3">
                <div class="text-xs font-medium text-orange-700">即将约满</div>
                <div class="mt-1 text-xl font-black text-orange-700">{{ stats.warning }}</div>
              </div>
              <div class="dashboard-stat-card rounded-2xl bg-red-50 p-3">
                <div class="text-xs font-medium text-red-700">名额已满</div>
                <div class="mt-1 text-xl font-black text-red-700">{{ stats.full }}</div>
              </div>
              <div class="dashboard-stat-card rounded-2xl bg-slate-100 p-3">
                <div class="text-xs font-medium text-slate-600">未开放</div>
                <div class="mt-1 text-xl font-black text-slate-700">{{ stats.closed }}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="dashboard-spot-section">
          <div class="dashboard-spot-section__header">
            <div>
              <h3 class="text-sm font-bold text-slate-900 sm:text-base">景点预约状态</h3>
              <p class="mt-1 text-xs text-slate-500">重点查看是否可预约、剩余名额、当前热度与操作建议</p>
            </div>

            <div class="dashboard-filter-scroll hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <button v-for="filter in filterOptions" :key="filter.key" type="button"
                class="shrink-0 rounded-full border px-3 py-1.5 text-xs transition" :class="activeFilter === filter.key
                  ? 'border-teal-600 bg-teal-600 text-white shadow-md shadow-teal-200/70'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700'
                  " @click="activeFilter = filter.key">
                {{ filter.label }}
              </button>
            </div>
          </div>

          <div v-if="filteredSpotCards.length" class="dashboard-spot-grid">
            <article v-for="item in filteredSpotCards" :key="item.spotId"
              class="dashboard-spot-card group rounded-[20px] border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-xl"
              :class="statusStyle(item.status).border">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="status-dot" :class="statusStyle(item.status).dot"></span>
                    <span class="text-xs font-medium text-slate-500">{{ item.area }}</span>
                  </div>
                  <h4 class="mt-1.5 truncate text-lg font-black text-slate-950">{{ item.spotName }}</h4>
                  <p class="dashboard-spot-desc mt-1 text-xs leading-5 text-slate-500">{{ item.desc }}</p>
                </div>

                <n-tag :type="statusStyle(item.status).tagType" round :bordered="false">
                  {{ item.statusText }}
                </n-tag>
              </div>

              <div class="dashboard-spot-metrics mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="dashboard-spot-metric rounded-2xl p-3" :class="statusStyle(item.status).bg">
                  <div class="text-xs text-slate-500">剩余名额</div>
                  <div class="mt-1 text-xl font-black" :class="statusStyle(item.status).text">
                    {{ remainText(item) }}
                  </div>
                </div>
                <div class="dashboard-spot-metric rounded-2xl bg-slate-50 p-3">
                  <div class="text-xs text-slate-500">开放时段</div>
                  <div class="mt-2 text-xs font-bold text-slate-800">{{ item.bestTime }}</div>
                </div>
              </div>

              <div class="dashboard-spot-heat mt-4">
                <div class="mb-2 flex items-center justify-between text-xs">
                  <span class="font-semibold text-slate-700">预约热度</span>
                  <span class="font-black" :class="statusStyle(item.status).text">{{ item.heat }}%</span>
                </div>
                <n-progress type="line" :percentage="item.heat" :status="statusStyle(item.status).progress" :height="7"
                  :border-radius="999" :show-indicator="false" />
              </div>

              <div class="dashboard-spot-advice mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div class="flex gap-2">
                  <div
                    class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-teal-700 shadow-sm">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3.75 13.78 9l5.47.03-4.4 3.26 1.66 5.22L12 14.37l-4.51 3.14 1.66-5.22-4.4-3.26L10.22 9 12 3.75Z"
                        fill="currentColor" />
                    </svg>
                  </div>
                  <div>
                    <div class="text-xs font-bold text-slate-700">游览建议</div>
                    <p class="dashboard-spot-advice-text mt-1 text-xs leading-5 text-slate-600">{{ item.advice }}</p>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="dashboard-spot-empty shadow-card">
            <n-empty description="当前筛选条件下暂无景点" />
          </div>
        </section>
      </main>
    </section>
  </n-spin>

  <n-modal v-model:show="showDateModal" preset="card" class="dashboard-date-modal" title="选择日期"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }">
    <div class="dashboard-date-dialog-grid">
      <button v-for="date in futureDates" :key="date.value" type="button" class="dashboard-date-option" :class="{
        'dashboard-date-option--active': selectedDate === date.value,
      }" @click="chooseDate(date.value)">
        <strong>{{ date.date }}</strong>
        <span>{{ date.title }} · {{ date.week }}</span>
      </button>
    </div>
  </n-modal>
</template>

<style scoped>
.appointment-status-screen {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: #1f2937;
  background:
    radial-gradient(circle at 18% 12%, rgba(0, 168, 142, 0.12), transparent 28%),
    linear-gradient(180deg, #f2fffc 0%, #f8fafc 42%, #ffffff 100%);
}

.dashboard-screen-spin {
  height: 100%;
  min-height: 0;
}

.dashboard-toolbar-control {
  display: flex;
  width: clamp(260px, 28vw, 460px);
  min-width: 0;
}

.dashboard-scenic-select {
  width: 100%;
  min-width: 0;
}

.appointment-status-screen__inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: min(100%, 1680px);
  margin: 0 auto;
  padding: 16px;
}

.dashboard-summary-card {
  flex: 0 0 auto;
  margin-top: 0;
  overflow: hidden;
  border: 1px solid #ccfbf1;
  border-radius: 26px;
  background: #fff;
}

.dashboard-summary-grid {
  display: grid;
  gap: 0;
}

.dashboard-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  border-top: 1px solid #f0fdfa;
  padding: 16px;
}

.dashboard-summary-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  color: #020617;
  font-size: 21px;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: 0;
}

.dashboard-date-dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.dashboard-date-option {
  min-height: 64px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  color: #0f172a;
  text-align: center;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.dashboard-date-option strong,
.dashboard-date-option span {
  display: block;
}

.dashboard-date-option strong {
  font-size: 16px;
  font-weight: 900;
}

.dashboard-date-option span {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.dashboard-date-option--active {
  border-color: #0d9488;
  background: #0d9488;
  color: #fff;
  box-shadow: 0 14px 30px rgba(13, 148, 136, 0.22);
}

.dashboard-date-option--active span {
  color: rgba(255, 255, 255, 0.82);
}

.dashboard-spot-grid {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  align-items: start;
  min-height: 0;
  gap: 14px;
  margin-top: 14px;
  padding: 2px 4px 16px 2px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dashboard-spot-section {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  margin-top: 18px;
}

.dashboard-spot-card {
  min-height: 276px;
  overflow: visible;
}

.dashboard-spot-section__header {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 12px;
}

.dashboard-spot-empty {
  margin-top: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: #fff;
  padding: 40px;
}

.dashboard-spot-grid::-webkit-scrollbar {
  width: 8px;
}

.dashboard-spot-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.22);
}

.dashboard-spot-grid::-webkit-scrollbar-track {
  background: transparent;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.shadow-card {
  box-shadow: 0 12px 30px rgba(15, 118, 110, 0.08);
}

:deep(.n-spin-content) {
  height: 100%;
  min-height: 0;
}

:deep(.n-spin-container) {
  height: 100%;
  min-height: 0;
}

:deep(.n-base-selection) {
  border-radius: 12px;
}

:global(.dashboard-date-modal.n-card) {
  max-width: calc(100vw - 32px);
}

:global(.dashboard-date-modal.n-card > .n-card-header) {
  padding: 18px 20px 10px;
}

:global(.dashboard-date-modal.n-card > .n-card__content) {
  padding: 14px 20px 20px;
}

@media (min-width: 640px) {
  .appointment-status-screen__inner {
    padding: 20px;
  }

  .dashboard-date-dialog-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .dashboard-spot-section__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

@media (min-width: 1024px) {
  .appointment-status-screen__inner {
    padding: 24px 28px;
  }

  .dashboard-summary-card {
    margin-top: 0;
  }

  .dashboard-spot-section {
    min-height: 360px;
  }

  .dashboard-summary-grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  }

  .dashboard-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-top: 0;
    border-left: 1px solid #f0fdfa;
    padding: 20px;
  }
}

@media (min-width: 1440px) {
  .appointment-status-screen__inner {
    padding: 28px 36px;
  }

  .dashboard-summary-grid {
    grid-template-columns: minmax(0, 1.35fr) minmax(420px, 0.65fr);
  }

  .dashboard-spot-grid {
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  }

  .dashboard-spot-card {
    min-height: 292px;
  }
}

@media (max-width: 768px) {
  .dashboard-toolbar-control {
    width: 100%;
  }

  .appointment-status-screen {
    overflow-x: hidden;
    overflow-y: auto;
    background:
      radial-gradient(circle at 18% 8%, rgba(0, 168, 142, 0.1), transparent 24%),
      linear-gradient(180deg, #f7fffd 0%, #ffffff 52%, #ffffff 100%);
  }

  .appointment-status-screen__inner {
    width: 100%;
    height: auto;
    min-height: 100%;
    overflow-x: hidden;
    padding: 12px 14px 16px;
  }

  .dashboard-summary-card {
    border-radius: 20px;
    box-shadow: 0 10px 24px rgba(15, 118, 110, 0.07);
  }

  .dashboard-summary-card :deep(.n-button) {
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
  }

  .dashboard-summary-title {
    gap: 8px;
    margin-top: 10px;
    font-size: 18px;
  }

  .dashboard-summary-remain {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 0;
    margin-top: 4px;
    border: 1px solid #eef2f7;
    border-radius: 14px;
    padding: 10px 12px;
  }

  .dashboard-summary-remain .text-3xl {
    font-size: 24px;
    line-height: 1;
  }

  .dashboard-summary-remain .mt-2 {
    margin-top: 0;
  }

  .dashboard-stat-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 10px 14px 14px;
  }

  .dashboard-stat-card {
    min-width: 0;
    border-radius: 14px;
    padding: 9px 8px;
  }

  .dashboard-stat-card .text-xs {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  .dashboard-stat-card .text-xl {
    margin-top: 2px;
    font-size: 17px;
    line-height: 1.15;
  }

  .dashboard-spot-section {
    margin-top: 16px;
  }

  .dashboard-spot-section__header {
    gap: 10px;
  }

  .dashboard-spot-section__header p {
    display: none;
  }

  .dashboard-filter-scroll {
    gap: 7px;
    width: 100%;
    max-width: 100%;
    margin-right: 0;
    margin-left: 0;
    padding-right: 0;
    padding-left: 0;
    padding-bottom: 2px;
  }

  .dashboard-spot-grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-height: none;
    margin-top: 10px;
    padding: 1px 0 14px;
    overflow: visible;
  }

  .dashboard-spot-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 246px;
    border-radius: 16px;
    padding: 12px;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
  }

  .dashboard-spot-card :deep(.n-tag) {
    --n-height: 24px;
    flex: 0 0 auto;
    font-size: 11px;
  }

  .dashboard-spot-card h4 {
    margin-top: 4px;
    font-size: 16px;
    line-height: 1.2;
  }

  .dashboard-spot-desc {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    line-height: 18px;
  }

  .dashboard-spot-metrics {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.95fr);
    grid-auto-rows: 1fr;
    gap: 8px;
    margin-top: 10px;
  }

  .dashboard-spot-metric {
    display: flex;
    min-width: 0;
    min-height: 58px;
    flex-direction: column;
    justify-content: center;
    border-radius: 13px;
    padding: 9px 10px;
  }

  .dashboard-spot-metric .text-xl {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    line-height: 1.25;
  }

  .dashboard-spot-metric .text-xs {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  .dashboard-spot-heat {
    margin-top: 10px;
  }

  .dashboard-spot-heat .mb-2 {
    margin-bottom: 5px;
  }

  .dashboard-spot-advice {
    min-height: 52px;
    margin-top: 10px;
    border-radius: 13px;
    padding: 8px 10px;
  }

  .dashboard-spot-advice .h-5 {
    display: none;
  }

  .dashboard-spot-advice-text {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    line-height: 18px;
  }

  .dashboard-summary-title {
    font-size: 18px;
  }
}
</style>
