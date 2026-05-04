<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pinia, useUserStore } from '@/stores'
import { pageScenicAreasApi } from '@/api/map'
import {
  cancelReservationOrderApi,
  createReservationOrderApi,
  createReservationRuleApi,
  createReservationSlotApi,
  generateReservationSlotsApi,
  listReservationEnabledSpotsApi,
  listReservationSlotsApi,
  pageMyReservationOrdersApi,
  pageReservationOrdersApi,
  pageReservationRulesApi,
  pageReservationSlotsApi,
  updateReservationRuleApi,
  updateReservationRuleStatusApi,
  updateReservationSlotApi,
} from '@/api/reservation'

const userStore = useUserStore(pinia)

const activeTab = ref(userStore.isAdmin ? 'rules' : 'reserve')
const scenicOptions = ref([])
const enabledSpots = ref([])
const ruleQuerySpots = ref([])
const ruleFormSpots = ref([])
const generateSpots = ref([])
const slotQuerySpots = ref([])
const slotFormSpots = ref([])
const adminOrderSpots = ref([])
const editingRuleSpotName = ref('')
const editingSlotSpotName = ref('')
const slotResult = ref(null)
const selectedSlot = ref(null)
const myOrders = ref({ total: 0, records: [] })
const rulePage = ref({ total: 0, records: [] })
const slotPage = ref({ total: 0, records: [] })
const orderPage = ref({ total: 0, records: [] })
const editingRuleId = ref(null)
const editingSlotId = ref(null)
const reserveFormVisible = ref(false)
const ruleFormVisible = ref(false)
const slotFormVisible = ref(false)

const loading = reactive({
  scenic: false,
  spots: false,
  ruleQuerySpots: false,
  ruleFormSpots: false,
  generateSpots: false,
  slotQuerySpots: false,
  slotFormSpots: false,
  adminOrderSpots: false,
  slots: false,
  myOrders: false,
  rules: false,
  adminSlots: false,
  adminOrders: false,
})

const submitting = reactive({
  order: false,
  cancel: false,
  rule: false,
  ruleStatus: false,
  generateSlots: false,
  slot: false,
})

const reserveQuery = reactive({
  scenicAreaId: '',
  keyword: '',
  spotId: '',
  visitDate: todayText(),
})

const orderForm = reactive({
  visitorCount: 1,
  contactName: '',
  contactPhone: '',
  remark: '',
})

const myOrderQuery = reactive({
  status: '',
  pageNum: 1,
  pageSize: 10,
})

const ruleQuery = reactive({
  scenicAreaId: '',
  spotId: '',
  status: '',
  pageNum: 1,
  pageSize: 10,
})

const ruleForm = reactive({
  scenicAreaId: '',
  spotId: '',
  startTime: '09:00:00',
  endTime: '11:00:00',
  totalCapacity: 100,
  weekDays: '1,2,3,4,5,6,7',
  advanceDays: 7,
  status: 1,
  remark: '',
})

const generateForm = reactive({
  scenicAreaId: '',
  spotId: '',
  days: 7,
})

const slotQuery = reactive({
  scenicAreaId: '',
  spotId: '',
  visitDate: '',
  startDate: '',
  endDate: '',
  status: '',
  pageNum: 1,
  pageSize: 10,
})

const slotForm = reactive({
  scenicAreaId: '',
  spotId: '',
  visitDate: todayText(),
  startTime: '09:00:00',
  endTime: '11:00:00',
  totalCapacity: 100,
  status: 1,
  remark: '',
})

const adminOrderQuery = reactive({
  scenicAreaId: '',
  spotId: '',
  userId: '',
  visitDate: '',
  status: '',
  sourceType: '',
  reservationNo: '',
  pageNum: 1,
  pageSize: 10,
})

const canReserve = computed(() => !userStore.isAdmin)
const canManage = computed(() => userStore.isAdmin)
const selectedSpot = computed(() =>
  enabledSpots.value.find((item) => Number(item.spotId || item.id) === Number(reserveQuery.spotId)),
)
const availableSlots = computed(() => slotResult.value?.slots || [])
const reserveSpotRows = computed(() => {
  if (!reserveQuery.spotId) return enabledSpots.value
  return enabledSpots.value.filter((item) => Number(getSpotValue(item)) === Number(reserveQuery.spotId))
})
const ruleFormSpotOptions = computed(() => {
  if (!ruleForm.spotId) return ruleFormSpots.value
  const hasSelected = ruleFormSpots.value.some((item) => Number(getSpotValue(item)) === Number(ruleForm.spotId))
  if (hasSelected) return ruleFormSpots.value
  return [
    {
      spotId: ruleForm.spotId,
      spotName: editingRuleSpotName.value || `景点 ${ruleForm.spotId}`,
    },
    ...ruleFormSpots.value,
  ]
})
const slotFormSpotOptions = computed(() => {
  if (!slotForm.spotId) return slotFormSpots.value
  const hasSelected = slotFormSpots.value.some((item) => Number(getSpotValue(item)) === Number(slotForm.spotId))
  if (hasSelected) return slotFormSpots.value
  return [
    {
      spotId: slotForm.spotId,
      spotName: editingSlotSpotName.value || `景点 ${slotForm.spotId}`,
    },
    ...slotFormSpots.value,
  ]
})

const statusOptions = [
  { label: '待确认', value: 'PENDING' },
  { label: '已预约', value: 'CONFIRMED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已过期', value: 'EXPIRED' },
]

const sourceOptions = [
  { label: '前端', value: 'FRONTEND' },
  { label: 'Agent', value: 'AGENT' },
  { label: '后台', value: 'ADMIN' },
]

function todayText() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizePageResult(result) {
  return {
    total: Number(result?.total || 0),
    records: Array.isArray(result?.records) ? result.records : [],
  }
}

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

function formatTimeRange(row) {
  return `${String(row?.startTime || '').slice(0, 5)}-${String(row?.endTime || '').slice(0, 5)}`
}

function getSpotValue(spot) {
  return spot?.spotId || spot?.id
}

function formatStatusText(status) {
  return statusOptions.find((item) => item.value === status)?.label || status || '-'
}

function formatSourceText(source) {
  return sourceOptions.find((item) => item.value === source)?.label || source || '-'
}

function statusTagType(status) {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'PENDING') return 'warning'
  if (status === 'CANCELLED') return 'info'
  if (status === 'COMPLETED') return 'primary'
  return 'danger'
}

function statusText(value) {
  return Number(value) === 1 ? '启用' : '停用'
}

function resetOrderForm() {
  Object.assign(orderForm, {
    visitorCount: 1,
    contactName: userStore.displayName || '',
    contactPhone: userStore.userInfo?.phone || '',
    remark: '',
  })
}

async function fetchScenicOptions() {
  loading.scenic = true
  try {
    const page = normalizePageResult(await pageScenicAreasApi({ pageNum: 1, pageSize: 200, status: 1 }))
    scenicOptions.value = page.records
  } finally {
    loading.scenic = false
  }
}

async function fetchEnabledSpots() {
  if (!reserveQuery.scenicAreaId) {
    reserveQuery.spotId = ''
    enabledSpots.value = []
    return
  }

  loading.spots = true
  try {
    enabledSpots.value = await listReservationEnabledSpotsApi(
      cleanParams({
        scenicAreaId: reserveQuery.scenicAreaId,
      }),
    )
  } finally {
    loading.spots = false
  }
}

async function fetchRuleQuerySpots() {
  if (!ruleQuery.scenicAreaId) {
    ruleQuery.spotId = ''
    ruleQuerySpots.value = []
    return
  }

  loading.ruleQuerySpots = true
  const scenicAreaId = ruleQuery.scenicAreaId
  try {
    const spots = await listReservationEnabledSpotsApi({ scenicAreaId })
    if (Number(ruleQuery.scenicAreaId) !== Number(scenicAreaId)) return
    ruleQuerySpots.value = spots
    if (ruleQuery.spotId && !spots.some((item) => Number(getSpotValue(item)) === Number(ruleQuery.spotId))) {
      ruleQuery.spotId = ''
    }
  } finally {
    loading.ruleQuerySpots = false
  }
}

async function fetchRuleFormSpots({ keepMissing = false } = {}) {
  if (!ruleForm.scenicAreaId) {
    ruleForm.spotId = ''
    ruleFormSpots.value = []
    editingRuleSpotName.value = ''
    return
  }

  loading.ruleFormSpots = true
  const scenicAreaId = ruleForm.scenicAreaId
  try {
    const spots = await listReservationEnabledSpotsApi({ scenicAreaId })
    if (Number(ruleForm.scenicAreaId) !== Number(scenicAreaId)) return
    ruleFormSpots.value = spots
    if (
      !keepMissing &&
      ruleForm.spotId &&
      !spots.some((item) => Number(getSpotValue(item)) === Number(ruleForm.spotId))
    ) {
      ruleForm.spotId = ''
      editingRuleSpotName.value = ''
    }
  } finally {
    loading.ruleFormSpots = false
  }
}

function handleRuleQueryScenicChange() {
  ruleQuery.spotId = ''
  fetchRuleQuerySpots()
}

function handleRuleFormScenicChange() {
  ruleForm.spotId = ''
  editingRuleSpotName.value = ''
  fetchRuleFormSpots()
}

async function fetchGenerateSpots() {
  if (!generateForm.scenicAreaId) {
    generateForm.spotId = ''
    generateSpots.value = []
    return
  }

  loading.generateSpots = true
  const scenicAreaId = generateForm.scenicAreaId
  try {
    const spots = await listReservationEnabledSpotsApi({ scenicAreaId })
    if (Number(generateForm.scenicAreaId) !== Number(scenicAreaId)) return
    generateSpots.value = spots
    if (generateForm.spotId && !spots.some((item) => Number(getSpotValue(item)) === Number(generateForm.spotId))) {
      generateForm.spotId = ''
    }
  } finally {
    loading.generateSpots = false
  }
}

async function fetchSlotQuerySpots() {
  if (!slotQuery.scenicAreaId) {
    slotQuery.spotId = ''
    slotQuerySpots.value = []
    return
  }

  loading.slotQuerySpots = true
  const scenicAreaId = slotQuery.scenicAreaId
  try {
    const spots = await listReservationEnabledSpotsApi({ scenicAreaId })
    if (Number(slotQuery.scenicAreaId) !== Number(scenicAreaId)) return
    slotQuerySpots.value = spots
    if (slotQuery.spotId && !spots.some((item) => Number(getSpotValue(item)) === Number(slotQuery.spotId))) {
      slotQuery.spotId = ''
    }
  } finally {
    loading.slotQuerySpots = false
  }
}

async function fetchSlotFormSpots({ keepMissing = false } = {}) {
  if (!slotForm.scenicAreaId) {
    slotForm.spotId = ''
    slotFormSpots.value = []
    editingSlotSpotName.value = ''
    return
  }

  loading.slotFormSpots = true
  const scenicAreaId = slotForm.scenicAreaId
  try {
    const spots = await listReservationEnabledSpotsApi({ scenicAreaId })
    if (Number(slotForm.scenicAreaId) !== Number(scenicAreaId)) return
    slotFormSpots.value = spots
    if (
      !keepMissing &&
      slotForm.spotId &&
      !spots.some((item) => Number(getSpotValue(item)) === Number(slotForm.spotId))
    ) {
      slotForm.spotId = ''
      editingSlotSpotName.value = ''
    }
  } finally {
    loading.slotFormSpots = false
  }
}

function handleGenerateScenicChange() {
  generateForm.spotId = ''
  fetchGenerateSpots()
}

function handleSlotQueryScenicChange() {
  slotQuery.spotId = ''
  fetchSlotQuerySpots()
}

function handleSlotFormScenicChange() {
  slotForm.spotId = ''
  editingSlotSpotName.value = ''
  fetchSlotFormSpots()
}

async function fetchAdminOrderSpots() {
  if (!adminOrderQuery.scenicAreaId) {
    adminOrderQuery.spotId = ''
    adminOrderSpots.value = []
    return
  }

  loading.adminOrderSpots = true
  const scenicAreaId = adminOrderQuery.scenicAreaId
  try {
    const spots = await listReservationEnabledSpotsApi({ scenicAreaId })
    if (Number(adminOrderQuery.scenicAreaId) !== Number(scenicAreaId)) return
    adminOrderSpots.value = spots
    if (adminOrderQuery.spotId && !spots.some((item) => Number(getSpotValue(item)) === Number(adminOrderQuery.spotId))) {
      adminOrderQuery.spotId = ''
    }
  } finally {
    loading.adminOrderSpots = false
  }
}

function handleAdminOrderScenicChange() {
  adminOrderQuery.spotId = ''
  fetchAdminOrderSpots()
}

async function fetchReservationSlots() {
  if (!reserveQuery.spotId || !reserveQuery.visitDate) {
    ElMessage.warning('请先选择景点和预约日期')
    return
  }

  loading.slots = true
  selectedSlot.value = null
  try {
    slotResult.value = await listReservationSlotsApi({
      spotId: Number(reserveQuery.spotId),
      visitDate: reserveQuery.visitDate,
    })
  } finally {
    loading.slots = false
  }
}

function chooseSlot(slot) {
  if (!slot.available) {
    ElMessage.warning('当前时段不可预约')
    return
  }
  selectedSlot.value = slot
}

function openReserveForm(row) {
  if (row) reserveQuery.spotId = getSpotValue(row)
  if (!reserveQuery.scenicAreaId || !reserveQuery.spotId) {
    ElMessage.warning('请先选择景区和景点')
    return
  }

  slotResult.value = null
  selectedSlot.value = null
  resetOrderForm()
  reserveFormVisible.value = true
}

async function submitOrder() {
  if (!selectedSlot.value?.slotId && !selectedSlot.value?.id) {
    ElMessage.warning('请先选择可预约时段')
    return
  }
  if (!Number(userStore.userId)) {
    ElMessage.warning('当前用户信息缺少 userId，请重新登录后再试')
    return
  }

  submitting.order = true
  try {
    const order = await createReservationOrderApi({
      userId: Number(userStore.userId),
      slotId: Number(selectedSlot.value.slotId || selectedSlot.value.id),
      visitorCount: Number(orderForm.visitorCount),
      contactName: orderForm.contactName || undefined,
      contactPhone: orderForm.contactPhone || undefined,
      sourceType: 'FRONTEND',
      clientRequestId: createClientRequestId(),
      remark: orderForm.remark || undefined,
    })
    ElMessage.success(`预约成功：${order.reservationNo}`)
    selectedSlot.value = null
    reserveFormVisible.value = false
    resetOrderForm()
    await Promise.all([fetchReservationSlots(), fetchMyOrders()])
  } finally {
    submitting.order = false
  }
}

function createClientRequestId() {
  if (window.crypto?.randomUUID) return `frontend-${window.crypto.randomUUID()}`
  return `frontend-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function fetchMyOrders() {
  if (!Number(userStore.userId)) return

  loading.myOrders = true
  try {
    myOrders.value = normalizePageResult(
      await pageMyReservationOrdersApi(
        cleanParams({
          userId: Number(userStore.userId),
          status: myOrderQuery.status,
          pageNum: myOrderQuery.pageNum,
          pageSize: myOrderQuery.pageSize,
        }),
      ),
    )
  } finally {
    loading.myOrders = false
  }
}

async function cancelOrder(row) {
  let cancelReason = ''
  try {
    const result = await ElMessageBox.prompt('请输入取消原因', '取消预约', {
      confirmButtonText: '确认取消',
      cancelButtonText: '再想想',
      inputPlaceholder: '例如：行程有变',
    })
    cancelReason = result.value || ''
  } catch {
    return
  }

  submitting.cancel = true
  try {
    await cancelReservationOrderApi(row.reservationNo, {
      userId: Number(userStore.userId),
      cancelReason,
    })
    ElMessage.success('预约已取消')
    await fetchMyOrders()
  } finally {
    submitting.cancel = false
  }
}

function canCancel(row) {
  return ['PENDING', 'CONFIRMED'].includes(row.status)
}

async function fetchRules() {
  loading.rules = true
  try {
    rulePage.value = normalizePageResult(await pageReservationRulesApi(cleanParams(ruleQuery)))
  } finally {
    loading.rules = false
  }
}

function resetRuleForm() {
  editingRuleId.value = null
  editingRuleSpotName.value = ''
  Object.assign(ruleForm, {
    scenicAreaId: ruleQuery.scenicAreaId || '',
    spotId: ruleQuery.spotId || '',
    startTime: '09:00:00',
    endTime: '11:00:00',
    totalCapacity: 100,
    weekDays: '1,2,3,4,5,6,7',
    advanceDays: 7,
    status: 1,
    remark: '',
  })
  fetchRuleFormSpots()
}

function openCreateRuleForm() {
  resetRuleForm()
  ruleFormVisible.value = true
}

function editRule(row) {
  editingRuleId.value = row.id
  editingRuleSpotName.value = row.spotName || ''
  Object.assign(ruleForm, {
    scenicAreaId: row.scenicAreaId || '',
    spotId: row.spotId || '',
    startTime: row.startTime || '09:00:00',
    endTime: row.endTime || '11:00:00',
    totalCapacity: row.totalCapacity || 100,
    weekDays: row.weekDays || '1,2,3,4,5,6,7',
    advanceDays: row.advanceDays ?? 7,
    status: Number(row.status ?? 1),
    remark: row.remark || '',
  })
  ruleFormVisible.value = true
  fetchRuleFormSpots({ keepMissing: true })
}

async function submitRule() {
  if (!ruleForm.scenicAreaId || !ruleForm.spotId) {
    ElMessage.warning('请填写景区和景点')
    return
  }

  submitting.rule = true
  try {
    const payload = {
      scenicAreaId: Number(ruleForm.scenicAreaId),
      spotId: Number(ruleForm.spotId),
      startTime: ruleForm.startTime,
      endTime: ruleForm.endTime,
      totalCapacity: Number(ruleForm.totalCapacity),
      weekDays: ruleForm.weekDays,
      advanceDays: Number(ruleForm.advanceDays),
      status: Number(ruleForm.status),
      remark: ruleForm.remark || undefined,
      createBy: Number(userStore.userId) || undefined,
      updateBy: Number(userStore.userId) || undefined,
    }
    if (editingRuleId.value) {
      await updateReservationRuleApi(editingRuleId.value, payload)
      ElMessage.success('预约规则已更新')
    } else {
      await createReservationRuleApi(payload)
      ElMessage.success('预约规则已创建')
    }
    ruleFormVisible.value = false
    resetRuleForm()
    await fetchRules()
  } finally {
    submitting.rule = false
  }
}

async function toggleRuleStatus(row) {
  submitting.ruleStatus = true
  try {
    await updateReservationRuleStatusApi(row.id, {
      status: Number(row.status) === 1 ? 0 : 1,
      updateBy: Number(userStore.userId) || undefined,
    })
    ElMessage.success('规则状态已更新')
    await fetchRules()
  } finally {
    submitting.ruleStatus = false
  }
}

async function generateSlots() {
  if (!generateForm.scenicAreaId && !generateForm.spotId) {
    ElMessage.warning('请选择景区或景点')
    return
  }

  submitting.generateSlots = true
  try {
    const result = await generateReservationSlotsApi(
      cleanParams({
        scenicAreaId: generateForm.scenicAreaId ? Number(generateForm.scenicAreaId) : undefined,
        spotId: generateForm.spotId ? Number(generateForm.spotId) : undefined,
        days: Number(generateForm.days),
      }),
    )
    ElMessage.success(`生成 ${result?.generatedCount || 0} 条，跳过 ${result?.skipCount || 0} 条`)
    await fetchAdminSlots()
  } finally {
    submitting.generateSlots = false
  }
}

async function fetchAdminSlots() {
  loading.adminSlots = true
  try {
    slotPage.value = normalizePageResult(await pageReservationSlotsApi(cleanParams(slotQuery)))
  } finally {
    loading.adminSlots = false
  }
}

function resetSlotForm() {
  editingSlotId.value = null
  editingSlotSpotName.value = ''
  Object.assign(slotForm, {
    scenicAreaId: slotQuery.scenicAreaId || '',
    spotId: slotQuery.spotId || '',
    visitDate: slotQuery.visitDate || todayText(),
    startTime: '09:00:00',
    endTime: '11:00:00',
    totalCapacity: 100,
    status: 1,
    remark: '',
  })
  fetchSlotFormSpots()
}

function openCreateSlotForm() {
  resetSlotForm()
  slotFormVisible.value = true
}

function editSlot(row) {
  editingSlotId.value = row.id
  editingSlotSpotName.value = row.spotName || ''
  Object.assign(slotForm, {
    scenicAreaId: row.scenicAreaId || '',
    spotId: row.spotId || '',
    visitDate: row.visitDate || todayText(),
    startTime: row.startTime || '09:00:00',
    endTime: row.endTime || '11:00:00',
    totalCapacity: row.totalCapacity || 100,
    status: Number(row.status ?? 1),
    remark: row.remark || '',
  })
  slotFormVisible.value = true
  fetchSlotFormSpots({ keepMissing: true })
}

async function submitSlot() {
  if (!slotForm.scenicAreaId || !slotForm.spotId) {
    ElMessage.warning('请填写景区和景点')
    return
  }

  submitting.slot = true
  try {
    const payload = {
      scenicAreaId: Number(slotForm.scenicAreaId),
      spotId: Number(slotForm.spotId),
      visitDate: slotForm.visitDate,
      startTime: slotForm.startTime,
      endTime: slotForm.endTime,
      totalCapacity: Number(slotForm.totalCapacity),
      status: Number(slotForm.status),
      remark: slotForm.remark || undefined,
      createBy: Number(userStore.userId) || undefined,
      updateBy: Number(userStore.userId) || undefined,
    }
    if (editingSlotId.value) {
      await updateReservationSlotApi(editingSlotId.value, payload)
      ElMessage.success('预约时段已更新')
    } else {
      await createReservationSlotApi(payload)
      ElMessage.success('预约时段已创建')
    }
    slotFormVisible.value = false
    resetSlotForm()
    await fetchAdminSlots()
  } finally {
    submitting.slot = false
  }
}

async function fetchAdminOrders() {
  loading.adminOrders = true
  try {
    orderPage.value = normalizePageResult(await pageReservationOrdersApi(cleanParams(adminOrderQuery)))
  } finally {
    loading.adminOrders = false
  }
}

watch(
  () => reserveQuery.scenicAreaId,
  () => {
    reserveQuery.spotId = ''
    slotResult.value = null
    selectedSlot.value = null
    reserveFormVisible.value = false
    fetchEnabledSpots()
  },
)

watch(
  () => reserveQuery.spotId,
  () => {
    slotResult.value = null
    selectedSlot.value = null
  },
)

watch(
  () => userStore.isAdmin,
  (isAdmin) => {
    activeTab.value = isAdmin ? 'rules' : 'reserve'
  },
)

onMounted(async () => {
  resetOrderForm()
  await Promise.all([fetchScenicOptions(), canReserve.value ? fetchEnabledSpots() : fetchRules()])
  if (canReserve.value) fetchMyOrders()
  if (canManage.value) {
    fetchAdminSlots()
    fetchAdminOrders()
  }
})
</script>

<template>
  <section class="reservation-workspace">
    <el-tabs v-model="activeTab" class="reservation-tabs">
      <el-tab-pane v-if="canReserve" label="预约景点" name="reserve">
        <div class="panel">
          <div class="toolbar">
            <el-select v-model="reserveQuery.scenicAreaId" clearable placeholder="选择景区"
              :loading="loading.scenic">
              <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
            </el-select>
            <el-select v-model="reserveQuery.spotId" clearable placeholder="选择景点"
              :disabled="!reserveQuery.scenicAreaId" :loading="loading.spots">
              <el-option v-for="item in enabledSpots" :key="getSpotValue(item)" :label="item.spotName"
                :value="getSpotValue(item)" />
            </el-select>
            <el-button type="primary" :loading="loading.spots" @click="fetchEnabledSpots">查询景点</el-button>
          </div>

          <el-table :data="reserveSpotRows" v-loading="loading.spots" stripe>
            <el-table-column prop="spotName" label="景点" min-width="160" />
            <el-table-column prop="shortIntro" label="简介" min-width="220" show-overflow-tooltip />
            <el-table-column prop="reservationNotice" label="预约须知" min-width="180" show-overflow-tooltip />
            <el-table-column label="可提前预约天数" min-width="110">
              <template #default="{ row }">{{ row.advanceReservationDays ?? '-' }} 天</template>
            </el-table-column>
            <el-table-column label="最少提前" min-width="110">
              <template #default="{ row }">{{ row.minAdvanceMinutes ?? '-' }} 分钟</template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openReserveForm(row)">预约</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-dialog v-model="reserveFormVisible" class="rule-dialog" title="提交景点预约" width="760px" top="8vh"
          destroy-on-close>
          <div class="toolbar">
            <el-select v-model="reserveQuery.spotId" placeholder="选择预约景点">
              <el-option v-for="item in enabledSpots" :key="item.spotId || item.id" :label="item.spotName"
                :value="item.spotId || item.id" />
            </el-select>
            <el-date-picker v-model="reserveQuery.visitDate" type="date" value-format="YYYY-MM-DD" placeholder="预约日期" />
            <el-button type="primary" :loading="loading.slots" @click="fetchReservationSlots">查询时段</el-button>
          </div>

          <el-alert v-if="selectedSpot?.reservationNotice" class="notice" type="info" :closable="false"
            :title="selectedSpot.reservationNotice" show-icon />

          <div v-loading="loading.slots" class="slot-grid">
            <button v-for="slot in availableSlots" :key="slot.slotId || slot.id" type="button" class="slot-card" :class="{
              'is-active': Number(selectedSlot?.slotId || selectedSlot?.id) === Number(slot.slotId || slot.id),
              'is-disabled': !slot.available,
            }" @click="chooseSlot(slot)">
              <strong>{{ formatTimeRange(slot) }}</strong>
              <span>剩余 {{ slot.remainingCount }} / {{ slot.totalCapacity }}</span>
              <small>{{ slot.available ? '可预约' : '不可预约' }}</small>
            </button>
            <el-empty v-if="slotResult && !availableSlots.length" description="当前日期暂无可预约时段" :image-size="88" />
          </div>

          <el-form class="reserve-form-grid" :model="orderForm" label-position="top">
            <el-form-item label="预约人数" class="rule-span-2">
              <el-input-number v-model="orderForm.visitorCount" :min="1" :max="selectedSlot?.remainingCount || 999" />
            </el-form-item>
            <el-form-item label="联系人" class="rule-span-2">
              <el-input v-model="orderForm.contactName" clearable />
            </el-form-item>
            <el-form-item label="联系电话" class="rule-span-2">
              <el-input v-model="orderForm.contactPhone" clearable />
            </el-form-item>
            <el-form-item label="备注" class="rule-span-6">
              <el-input v-model="orderForm.remark" type="textarea" :rows="2" />
            </el-form-item>
          </el-form>
          <template #footer>
            <div class="submit-row">
              <el-button @click="reserveFormVisible = false">取消</el-button>
              <el-button type="primary" :loading="submitting.order" @click="submitOrder">提交预约</el-button>
            </div>
          </template>
        </el-dialog>
      </el-tab-pane>

      <el-tab-pane v-if="canReserve" label="我的预约" name="my-orders">
        <div class="panel">
          <div class="toolbar">
            <el-select v-model="myOrderQuery.status" clearable placeholder="全部状态">
              <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-button type="primary" :loading="loading.myOrders" @click="fetchMyOrders">查询</el-button>
          </div>
          <el-table :data="myOrders.records" v-loading="loading.myOrders" stripe>
            <el-table-column prop="reservationNo" label="预约编号" min-width="180" />
            <el-table-column prop="spotName" label="景点" min-width="150" />
            <el-table-column prop="visitDate" label="日期" min-width="120" />
            <el-table-column label="时段" min-width="120">
              <template #default="{ row }">{{ formatTimeRange(row) }}</template>
            </el-table-column>
            <el-table-column prop="visitorCount" label="人数" min-width="80" />
            <el-table-column label="状态" min-width="100">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" effect="plain">{{ formatStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button link type="danger" :disabled="!canCancel(row)" @click="cancelOrder(row)">取消</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination v-model:current-page="myOrderQuery.pageNum" v-model:page-size="myOrderQuery.pageSize"
            class="pager" layout="total, prev, pager, next, sizes" :total="myOrders.total"
            @current-change="fetchMyOrders" @size-change="fetchMyOrders" />
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="canManage" label="预约规则" name="rules">
        <div class="panel">
          <div class="toolbar">
            <el-select v-model="ruleQuery.scenicAreaId" clearable filterable placeholder="景区"
              @change="handleRuleQueryScenicChange">
              <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
            </el-select>
            <el-select v-model="ruleQuery.spotId" clearable filterable placeholder="景点"
              :disabled="!ruleQuery.scenicAreaId" :loading="loading.ruleQuerySpots">
              <el-option v-for="item in ruleQuerySpots" :key="getSpotValue(item)" :label="item.spotName"
                :value="getSpotValue(item)" />
            </el-select>
            <el-select v-model="ruleQuery.status" clearable placeholder="状态">
              <el-option label="启用" :value="1" />
              <el-option label="停用" :value="0" />
            </el-select>
            <el-button type="primary" :loading="loading.rules" @click="fetchRules">查询</el-button>
            <el-button @click="openCreateRuleForm">新建规则</el-button>
          </div>
          <el-table :data="rulePage.records" v-loading="loading.rules" stripe>
            <el-table-column prop="spotName" label="景点" min-width="150" />
            <el-table-column label="时段" min-width="130">
              <template #default="{ row }">{{ formatTimeRange(row) }}</template>
            </el-table-column>
            <el-table-column prop="totalCapacity" label="容量" min-width="90" />
            <el-table-column prop="weekDays" label="星期" min-width="140" />
            <el-table-column prop="advanceDays" label="提前天数" min-width="100" />
            <el-table-column label="状态" min-width="90">
              <template #default="{ row }">
                <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'" effect="plain">{{ statusText(row.status)
                  }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="editRule(row)">编辑</el-button>
                <el-button link :type="Number(row.status) === 1 ? 'warning' : 'success'" @click="toggleRuleStatus(row)">
                  {{ Number(row.status) === 1 ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-dialog v-model="ruleFormVisible" class="rule-dialog" :title="editingRuleId ? '编辑预约规则' : '新建预约规则'"
          width="760px" top="8vh" destroy-on-close>
          <el-form class="rule-form-grid" :model="ruleForm" label-position="top">
            <el-form-item label="景区" class="rule-span-3">
              <el-select v-model="ruleForm.scenicAreaId" filterable placeholder="选择景区"
                @change="handleRuleFormScenicChange">
                <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="景点" class="rule-span-3">
              <el-select v-model="ruleForm.spotId" filterable placeholder="选择支持预约的景点" :disabled="!ruleForm.scenicAreaId"
                :loading="loading.ruleFormSpots">
                <el-option v-for="item in ruleFormSpotOptions" :key="getSpotValue(item)" :label="item.spotName"
                  :value="getSpotValue(item)" />
              </el-select>
            </el-form-item>
            <el-form-item label="开始时间" class="rule-span-2"><el-input v-model="ruleForm.startTime"
                placeholder="09:00:00" /></el-form-item>
            <el-form-item label="结束时间" class="rule-span-2"><el-input v-model="ruleForm.endTime"
                placeholder="11:00:00" /></el-form-item>
            <el-form-item label="开放星期" class="rule-span-2"><el-input v-model="ruleForm.weekDays"
                placeholder="1,2,3,4,5,6,7" /></el-form-item>
            <el-form-item label="总容量" class="rule-span-2"><el-input-number v-model="ruleForm.totalCapacity"
                :min="1" /></el-form-item>
            <el-form-item label="提前天数" class="rule-span-2"><el-input-number v-model="ruleForm.advanceDays"
                :min="0" /></el-form-item>
            <el-form-item label="状态" class="rule-span-2"><el-switch v-model="ruleForm.status" :active-value="1"
                :inactive-value="0" /></el-form-item>
            <el-form-item label="备注" class="rule-span-6"><el-input v-model="ruleForm.remark" type="textarea"
                :rows="2" /></el-form-item>
          </el-form>
          <template #footer>
            <div class="submit-row">
              <el-button @click="ruleFormVisible = false">取消</el-button>
              <el-button @click="resetRuleForm">重置</el-button>
              <el-button type="primary" :loading="submitting.rule" @click="submitRule">保存规则</el-button>
            </div>
          </template>
        </el-dialog>
      </el-tab-pane>

      <el-tab-pane v-if="canManage" label="预约时段" name="slots">
        <div class="panel">
          <h3>批量生成时段</h3>
          <div class="toolbar">
            <el-select v-model="generateForm.scenicAreaId" clearable filterable placeholder="按景区生成"
              @change="handleGenerateScenicChange">
              <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
            </el-select>
            <el-select v-model="generateForm.spotId" clearable filterable placeholder="景点"
              :disabled="!generateForm.scenicAreaId" :loading="loading.generateSpots">
              <el-option v-for="item in generateSpots" :key="getSpotValue(item)" :label="item.spotName"
                :value="getSpotValue(item)" />
            </el-select>
            <el-input-number v-model="generateForm.days" :min="1" :max="60" />
            <el-button type="primary" :loading="submitting.generateSlots" @click="generateSlots">生成时段</el-button>
          </div>
        </div>

        <div class="panel">
          <div class="toolbar">
            <el-select v-model="slotQuery.scenicAreaId" clearable filterable placeholder="景区"
              @change="handleSlotQueryScenicChange">
              <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
            </el-select>
            <el-select v-model="slotQuery.spotId" clearable filterable placeholder="景点"
              :disabled="!slotQuery.scenicAreaId" :loading="loading.slotQuerySpots">
              <el-option v-for="item in slotQuerySpots" :key="getSpotValue(item)" :label="item.spotName"
                :value="getSpotValue(item)" />
            </el-select>
            <el-date-picker v-model="slotQuery.visitDate" type="date" value-format="YYYY-MM-DD" placeholder="指定日期" />
            <el-select v-model="slotQuery.status" clearable placeholder="状态">
              <el-option label="启用" :value="1" />
              <el-option label="停用" :value="0" />
            </el-select>
            <el-button type="primary" :loading="loading.adminSlots" @click="fetchAdminSlots">查询</el-button>
            <el-button @click="openCreateSlotForm">新增临时时段</el-button>
          </div>
          <el-table :data="slotPage.records" v-loading="loading.adminSlots" stripe>
            <el-table-column prop="spotName" label="景点" min-width="150" />
            <el-table-column prop="visitDate" label="日期" min-width="120" />
            <el-table-column label="时段" min-width="130">
              <template #default="{ row }">{{ formatTimeRange(row) }}</template>
            </el-table-column>
            <el-table-column prop="totalCapacity" label="容量" min-width="80" />
            <el-table-column prop="reservedCount" label="已预约" min-width="90" />
            <el-table-column prop="remainingCount" label="剩余" min-width="80" />
            <el-table-column label="状态" min-width="90">
              <template #default="{ row }">
                <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'" effect="plain">{{ statusText(row.status)
                  }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }"><el-button link type="primary"
                  @click="editSlot(row)">编辑</el-button></template>
            </el-table-column>
          </el-table>
        </div>

        <el-dialog v-model="slotFormVisible" class="rule-dialog" :title="editingSlotId ? '编辑预约时段' : '新增临时时段'"
          width="720px" top="8vh" destroy-on-close>
          <el-form class="rule-form-grid" :model="slotForm" label-position="top">
            <el-form-item label="景区" class="rule-span-3">
              <el-select v-model="slotForm.scenicAreaId" filterable placeholder="选择景区"
                @change="handleSlotFormScenicChange">
                <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="景点" class="rule-span-3">
              <el-select v-model="slotForm.spotId" filterable placeholder="选择支持预约的景点" :disabled="!slotForm.scenicAreaId"
                :loading="loading.slotFormSpots">
                <el-option v-for="item in slotFormSpotOptions" :key="getSpotValue(item)" :label="item.spotName"
                  :value="getSpotValue(item)" />
              </el-select>
            </el-form-item>
            <el-form-item label="日期" class="rule-span-2"><el-date-picker v-model="slotForm.visitDate" type="date"
                value-format="YYYY-MM-DD" /></el-form-item>
            <el-form-item label="开始时间" class="rule-span-2"><el-input v-model="slotForm.startTime" /></el-form-item>
            <el-form-item label="结束时间" class="rule-span-2"><el-input v-model="slotForm.endTime" /></el-form-item>
            <el-form-item label="总容量" class="rule-span-2"><el-input-number v-model="slotForm.totalCapacity"
                :min="1" /></el-form-item>
            <el-form-item label="状态" class="rule-span-2"><el-switch v-model="slotForm.status" :active-value="1"
                :inactive-value="0" /></el-form-item>
            <el-form-item label="备注" class="rule-span-6"><el-input v-model="slotForm.remark" type="textarea"
                :rows="2" /></el-form-item>
          </el-form>
          <template #footer>
            <div class="submit-row">
              <el-button @click="slotFormVisible = false">取消</el-button>
              <el-button @click="resetSlotForm">重置</el-button>
              <el-button type="primary" :loading="submitting.slot" @click="submitSlot">保存时段</el-button>
            </div>
          </template>
        </el-dialog>
      </el-tab-pane>

      <el-tab-pane v-if="canManage" label="预约订单" name="orders">
        <div class="panel">
          <div class="toolbar">
            <el-select v-model="adminOrderQuery.scenicAreaId" clearable filterable placeholder="景区"
              @change="handleAdminOrderScenicChange">
              <el-option v-for="item in scenicOptions" :key="item.id" :label="item.scenicName" :value="item.id" />
            </el-select>
            <el-select v-model="adminOrderQuery.spotId" clearable filterable placeholder="景点"
              :disabled="!adminOrderQuery.scenicAreaId" :loading="loading.adminOrderSpots">
              <el-option v-for="item in adminOrderSpots" :key="getSpotValue(item)" :label="item.spotName"
                :value="getSpotValue(item)" />
            </el-select>
            <el-input v-model="adminOrderQuery.userId" clearable placeholder="用户 ID" />
            <el-date-picker v-model="adminOrderQuery.visitDate" type="date" value-format="YYYY-MM-DD"
              placeholder="预约日期" />
            <el-select v-model="adminOrderQuery.status" clearable placeholder="状态">
              <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-select v-model="adminOrderQuery.sourceType" clearable placeholder="来源">
              <el-option v-for="item in sourceOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-input v-model="adminOrderQuery.reservationNo" clearable placeholder="预约编号" />
            <el-button type="primary" :loading="loading.adminOrders" @click="fetchAdminOrders">查询</el-button>
          </div>
          <el-table :data="orderPage.records" v-loading="loading.adminOrders" stripe>
            <el-table-column prop="reservationNo" label="预约编号" min-width="180" />
            <el-table-column prop="nickname" label="用户" min-width="110" />
            <el-table-column prop="spotName" label="景点" min-width="150" />
            <el-table-column prop="visitDate" label="日期" min-width="120" />
            <el-table-column label="时段" min-width="120">
              <template #default="{ row }">{{ formatTimeRange(row) }}</template>
            </el-table-column>
            <el-table-column prop="visitorCount" label="人数" min-width="80" />
            <el-table-column label="状态" min-width="100">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" effect="plain">{{ formatStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="来源" min-width="90">
              <template #default="{ row }">{{ formatSourceText(row.sourceType) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.reservation-workspace {
  display: grid;
  gap: 18px;
}

.reservation-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.reservation-head h2,
.panel h3 {
  margin: 0;
  color: #0f172a;
}

.eyebrow {
  margin: 0 0 8px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.reservation-tabs {
  min-width: 0;
}

.panel {
  display: grid;
  gap: 14px;
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.toolbar>.el-input,
.toolbar>.el-select,
.toolbar>.el-date-editor {
  flex: 0 1 180px;
  min-width: 160px;
}

.notice {
  margin-top: 2px;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  min-height: 92px;
}

.slot-card {
  display: grid;
  gap: 6px;
  min-height: 94px;
  padding: 14px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  text-align: left;
  cursor: pointer;
}

.slot-card strong {
  color: #0f172a;
  font-size: 18px;
}

.slot-card span,
.slot-card small {
  color: #64748b;
}

.slot-card.is-active {
  border-color: rgba(15, 118, 110, 0.56);
  background: rgba(240, 253, 250, 0.94);
  box-shadow: inset 4px 0 0 #0f766e;
}

.slot-card.is-disabled {
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.7;
}

.order-form,
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.reserve-form-grid,
.rule-form-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px 12px;
}

.reserve-form-grid :deep(.el-form-item),
.rule-form-grid :deep(.el-form-item) {
  margin-bottom: 8px;
}

.reserve-form-grid :deep(.el-form-item__label),
.rule-form-grid :deep(.el-form-item__label) {
  padding-bottom: 4px;
  line-height: 18px;
}

.reserve-form-grid :deep(.el-select),
.reserve-form-grid :deep(.el-input-number),
.reserve-form-grid :deep(.el-date-editor),
.rule-form-grid :deep(.el-select),
.rule-form-grid :deep(.el-input-number),
.rule-form-grid :deep(.el-date-editor) {
  width: 100%;
}

.rule-span-2 {
  grid-column: span 2;
}

.rule-span-3 {
  grid-column: span 3;
}

.rule-span-6 {
  grid-column: 1 / -1;
}

.span-2 {
  grid-column: 1 / -1;
}

.submit-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.pager {
  justify-content: flex-end;
}

:deep(.rule-dialog) {
  max-width: calc(100vw - 40px);
  border-radius: 8px;
}

:deep(.rule-dialog .el-dialog__header) {
  padding: 18px 20px 8px;
  margin-right: 0;
}

:deep(.rule-dialog .el-dialog__title) {
  font-size: 16px;
  font-weight: 600;
}

:deep(.rule-dialog .el-dialog__body) {
  padding: 8px 20px 12px;
}

:deep(.rule-dialog .el-dialog__footer) {
  padding: 8px 20px 16px;
}

@media (max-width: 920px) {
  .reservation-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar>.el-input,
  .toolbar>.el-select,
  .toolbar>.el-date-editor,
  .toolbar>.el-button {
    flex: 1 1 100%;
    width: 100%;
  }

  .order-form,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .rule-form-grid {
    grid-template-columns: 1fr;
  }

  .reserve-form-grid {
    grid-template-columns: 1fr;
  }

  .rule-span-2,
  .rule-span-3,
  .rule-span-6 {
    grid-column: 1 / -1;
  }
}
</style>
