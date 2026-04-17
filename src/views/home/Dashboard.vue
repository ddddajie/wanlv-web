<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { analyzeDailySessionsApi, analyzeSessionApi } from '@/api/chat'
import { pinia, useUserStore } from '@/stores'
import { targetBaseUrl } from '@/utils/request'

const router = useRouter()
const userStore = useUserStore(pinia)

const credentialFormRef = ref()
const singleFormRef = ref()
const batchFormRef = ref()
const singleLoading = ref(false)
const batchLoading = ref(false)
const singleResult = ref(null)
const batchResult = ref(null)

const formatDate = (date = new Date()) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const credentialForm = reactive({
  operatorUsername: userStore.isSuperAdmin ? userStore.username || '' : '',
  operatorPassword: '',
})

const singleForm = reactive({
  userId: '',
  reportDate: formatDate(),
  forceReanalyze: false,
})

const batchForm = reactive({
  reportDate: formatDate(),
  forceReanalyze: false,
})

const credentialRules = {
  operatorUsername: [{ required: true, message: '请输入超级管理员账号', trigger: 'blur' }],
  operatorPassword: [{ required: true, message: '请输入超级管理员密码', trigger: 'blur' }],
}

const validatePositiveUserId = (rule, value, callback) => {
  if (value === '' || value === null || value === undefined) {
    callback(new Error('请输入要生成日报的用户 ID'))
    return
  }

  const userId = Number(value)
  if (!Number.isInteger(userId) || userId <= 0) {
    callback(new Error('用户 ID 必须是正整数'))
    return
  }

  callback()
}

const singleRules = {
  userId: [{ validator: validatePositiveUserId, trigger: 'blur' }],
}

const canUseAnalysis = computed(() => userStore.isSuperAdmin)
const isAdminUser = computed(() => userStore.isAdmin)
const isOperatorLocked = computed(() => canUseAnalysis.value && Boolean(userStore.username))

const roleLabel = computed(() => {
  if (userStore.isSuperAdmin) return '超级管理员'
  if (userStore.isAdmin) return '管理员'
  return '普通用户'
})

const heroTitle = computed(() => {
  if (userStore.isSuperAdmin) return '管理员日报中心'
  if (userStore.isAdmin) return '管理员工作台'
  return '用户控制台'
})

const heroDescription = computed(() => {
  if (userStore.isSuperAdmin) {
    return '这里集中承接新的聊天日报接口：支持按用户生成日报、按日期批量生成日报，并展示后端返回的分析结果和批量执行明细。'
  }

  if (userStore.isAdmin) {
    return '当前账号已进入管理员工作台，但聊天日报接口仅开放给 super_admin。你可以查看权限说明，真正执行日报任务需要超级管理员账号和密码。'
  }

  return '当前控制台已按角色切分能力。聊天日报属于管理员专属功能，普通用户仍然可以继续使用聊天联调能力。'
})

const heroAlert = computed(() => {
  if (userStore.isSuperAdmin) {
    return {
      title: '你当前拥有聊天日报生成权限',
      type: 'success',
      description: '提交时必须显式携带超级管理员账号和密码，前端不会缓存 operatorPassword。',
    }
  }

  if (userStore.isAdmin) {
    return {
      title: '当前账号没有日报执行权限',
      type: 'warning',
      description: '后端接口要求 sys_admin_user.role = super_admin，普通管理员即使访问页面也不能调用。',
    }
  }

  return {
    title: '管理员日报能力已从普通用户入口收口',
    type: 'info',
    description: '如果需要生成聊天日报，请由超级管理员登录后在这里统一操作。',
  }
})

const userSummary = computed(() => [
  { label: '当前身份', value: roleLabel.value },
  { label: '角色标识', value: userStore.role || 'normal_user' },
  { label: '展示名称', value: userStore.displayName || userStore.username || '-' },
  { label: '最后登录时间', value: userStore.userInfo?.lastLoginTime || '暂无记录' },
])

const actionCards = computed(() => {
  const cards = [
    {
      title: '进入智能问答',
      description: '继续联调 /agent/chat 和景区绑定能力。',
      actionText: '前往聊天页',
      handler: () => router.push('/chat'),
    },
  ]

  if (userStore.isSuperAdmin) {
    cards.push({
      title: '新增管理员',
      description: '超级管理员可以继续维护后台管理员账号。',
      actionText: '打开创建页',
      handler: () => router.push('/admin/create'),
    })
  }

  return cards
})

const capabilityList = computed(() => {
  if (userStore.isSuperAdmin) {
    return [
      '支持调用 POST /agent/session-analysis 生成单个用户的聊天日报。',
      '支持调用 POST /agent/session-analysis/daily 生成指定日期的批量日报。',
      'forceReanalyze 打开后，即使已有日报结果也会重新生成并覆盖。',
      '批量接口会返回 success、skipped、failed 明细，便于排查当天执行情况。',
    ]
  }

  if (userStore.isAdmin) {
    return [
      '可以进入管理员工作台查看当前账号状态和权限边界。',
      '不能调用聊天日报接口，因为后端只允许 super_admin 使用。',
      '如需执行日报，请联系超级管理员在当前控制台统一操作。',
    ]
  }

  return [
    '普通用户可以继续使用智能问答页进行会话联调。',
    '聊天日报不再从普通用户入口直接触发，避免与新的权限模型冲突。',
    '当前控制台保留账号概览和角色说明，便于区分可用能力。',
  ]
})

const singleSections = computed(() => {
  if (!singleResult.value) return []

  return [
    { label: '关注话题', value: toArray(singleResult.value.focusTopics) },
    { label: '兴趣标签', value: toArray(singleResult.value.interestTags) },
    { label: '服务建议', value: toArray(singleResult.value.serviceSuggestions) },
    { label: '知识缺口', value: toArray(singleResult.value.knowledgeGapPoints) },
  ]
})

const batchMetrics = computed(() => {
  if (!batchResult.value) return []

  return [
    { label: '命中会话', value: batchResult.value.totalCount ?? 0, tone: 'neutral' },
    { label: '生成成功', value: batchResult.value.successCount ?? 0, tone: 'success' },
    { label: '已跳过', value: batchResult.value.skippedCount ?? 0, tone: 'warning' },
    { label: '生成失败', value: batchResult.value.failedCount ?? 0, tone: 'danger' },
  ]
})

const batchItems = computed(() => toArray(batchResult.value?.items))

const singleSentimentTagType = computed(() => {
  const sentiment = `${singleResult.value?.overallSentiment || ''}`.toLowerCase()

  if (sentiment === 'positive') return 'success'
  if (sentiment === 'negative') return 'danger'
  if (sentiment) return 'warning'
  return 'info'
})

function toArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  return [value]
}

function getBatchItemStatus(item) {
  if (item?.skipped) return { label: '已跳过', type: 'warning' }
  if (item?.success) return { label: '成功', type: 'success' }
  return { label: '失败', type: 'danger' }
}

function ensureSuperAdmin() {
  if (canUseAnalysis.value) return true

  ElMessage.error('只有超级管理员才能使用聊天日报接口')
  return false
}

function buildOperatorPayload(extraPayload = {}) {
  return {
    operatorUsername: credentialForm.operatorUsername.trim(),
    operatorPassword: credentialForm.operatorPassword,
    ...extraPayload,
  }
}

async function validateBeforeSubmit(extraFormRef) {
  await credentialFormRef.value?.validate()
  await extraFormRef?.value?.validate()
}

async function handleSingleAnalyze() {
  if (!ensureSuperAdmin()) return

  await validateBeforeSubmit(singleFormRef)
  singleLoading.value = true

  try {
    singleResult.value = await analyzeSessionApi(
      buildOperatorPayload({
        userId: Number(singleForm.userId),
        reportDate: singleForm.reportDate || undefined,
        forceReanalyze: singleForm.forceReanalyze,
      }),
    )

    ElMessage.success('单用户聊天日报生成成功')
  } finally {
    singleLoading.value = false
  }
}

async function handleBatchAnalyze() {
  if (!ensureSuperAdmin()) return

  await validateBeforeSubmit(batchFormRef)
  batchLoading.value = true

  try {
    batchResult.value = await analyzeDailySessionsApi(
      buildOperatorPayload({
        reportDate: batchForm.reportDate || undefined,
        forceReanalyze: batchForm.forceReanalyze,
      }),
    )

    ElMessage.success('按日期批量日报任务已执行完成')
  } finally {
    batchLoading.value = false
  }
}
</script>

<template>
  <div class="dashboard">
    <section class="dashboard__hero glass-card">
      <div>
        <p class="dashboard__eyebrow">Connected to {{ targetBaseUrl }}</p>
        <h1 class="dashboard__title">
          {{ userStore.displayName || userStore.username || '欢迎使用万旅后台' }}，{{ heroTitle }}
        </h1>
        <p class="dashboard__desc">{{ heroDescription }}</p>
      </div>

      <div class="dashboard__hero-side">
        <el-alert
          :title="heroAlert.title"
          :description="heroAlert.description"
          :type="heroAlert.type"
          :closable="false"
          show-icon
        />
        <div class="dashboard__hero-badges">
          <el-tag effect="dark" type="primary">{{ roleLabel }}</el-tag>
          <el-tag effect="plain" :type="canUseAnalysis ? 'success' : 'info'">
            {{ canUseAnalysis ? '可执行日报' : '只读或普通能力' }}
          </el-tag>
        </div>
      </div>
    </section>

    <section class="dashboard__grid">
      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card__header">
            <span>登录信息</span>
            <el-tag effect="plain">{{ userStore.username || '-' }}</el-tag>
          </div>
        </template>

        <div class="summary-grid">
          <div v-for="item in userSummary" :key="item.label" class="summary-item">
            <div class="summary-item__label">{{ item.label }}</div>
            <div class="summary-item__value">{{ item.value }}</div>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card__header">
            <span>快捷入口</span>
            <span class="dashboard-card__hint">按当前角色展示</span>
          </div>
        </template>

        <div class="action-list">
          <button
            v-for="item in actionCards"
            :key="item.title"
            type="button"
            class="action-card"
            @click="item.handler"
          >
            <span class="action-card__title">{{ item.title }}</span>
            <span class="action-card__desc">{{ item.description }}</span>
            <span class="action-card__link">{{ item.actionText }}</span>
          </button>
        </div>
      </el-card>

      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card__header">
            <span>当前可用能力</span>
          </div>
        </template>

        <ul class="capability-list">
          <li v-for="item in capabilityList" :key="item">{{ item }}</li>
        </ul>
      </el-card>

      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card__header">
            <span>接口规则提醒</span>
          </div>
        </template>

        <div class="note-list">
          <div>管理员日报接口前缀：<code>/agent</code></div>
          <div>成功判断方式：<code>res.code === 200</code>，请求工具会直接返回 <code>data</code></div>
          <div>两个日报接口都必须显式提交 <code>operatorUsername</code> 和 <code>operatorPassword</code></div>
          <div>单用户接口额外要求 <code>userId</code>；批量接口按 <code>reportDate</code> 处理当天全部会话</div>
        </div>
      </el-card>
    </section>

    <section v-if="isAdminUser" class="dashboard__admin-panel">
      <el-card shadow="never" class="dashboard-card dashboard-card--full">
        <template #header>
          <div class="dashboard-card__header">
            <span>超级管理员鉴权</span>
            <el-tag :type="canUseAnalysis ? 'success' : 'warning'" effect="plain">
              {{ canUseAnalysis ? '可提交' : '当前账号无权限' }}
            </el-tag>
          </div>
        </template>

        <el-form
          ref="credentialFormRef"
          :model="credentialForm"
          :rules="credentialRules"
          label-position="top"
        >
          <div class="form-grid">
            <el-form-item label="操作人账号" prop="operatorUsername">
              <el-input
                v-model.trim="credentialForm.operatorUsername"
                :disabled="isOperatorLocked"
                placeholder="请输入超级管理员账号"
                size="large"
                clearable
              />
            </el-form-item>

            <el-form-item label="操作人密码" prop="operatorPassword">
              <el-input
                v-model="credentialForm.operatorPassword"
                placeholder="请输入当前超级管理员密码"
                size="large"
                show-password
                clearable
              />
            </el-form-item>
          </div>
        </el-form>
      </el-card>

      <template v-if="canUseAnalysis">
        <section class="dashboard__grid">
          <el-card shadow="never" class="dashboard-card">
            <template #header>
              <div class="dashboard-card__header">
                <span>单用户日报</span>
                <span class="dashboard-card__hint">POST /agent/session-analysis</span>
              </div>
            </template>

            <el-form
              ref="singleFormRef"
              :model="singleForm"
              :rules="singleRules"
              label-position="top"
              @submit.prevent="handleSingleAnalyze"
            >
              <div class="form-grid">
                <el-form-item label="用户 ID" prop="userId">
                  <el-input
                    v-model.trim="singleForm.userId"
                    placeholder="例如 10001"
                    size="large"
                    clearable
                  />
                </el-form-item>

                <el-form-item label="日报日期">
                  <el-date-picker
                    v-model="singleForm.reportDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    format="YYYY-MM-DD"
                    placeholder="选择日期"
                    size="large"
                    style="width: 100%"
                  />
                </el-form-item>

                <el-form-item label="强制重跑" class="form-grid__full">
                  <div class="switch-row">
                    <el-switch v-model="singleForm.forceReanalyze" />
                    <span>即使已有日报结果，也重新调用 Agent 覆盖旧数据</span>
                  </div>
                </el-form-item>
              </div>

              <div class="form-actions">
                <el-button type="primary" size="large" :loading="singleLoading" @click="handleSingleAnalyze">
                  生成单用户日报
                </el-button>
              </div>
            </el-form>
          </el-card>

          <el-card shadow="never" class="dashboard-card">
            <template #header>
              <div class="dashboard-card__header">
                <span>按日期批量日报</span>
                <span class="dashboard-card__hint">POST /agent/session-analysis/daily</span>
              </div>
            </template>

            <el-form
              ref="batchFormRef"
              :model="batchForm"
              label-position="top"
              @submit.prevent="handleBatchAnalyze"
            >
              <div class="form-grid">
                <el-form-item label="日报日期">
                  <el-date-picker
                    v-model="batchForm.reportDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    format="YYYY-MM-DD"
                    placeholder="选择日期"
                    size="large"
                    style="width: 100%"
                  />
                </el-form-item>

                <div class="batch-note">
                  <strong>批量规则</strong>
                  <span>后端会按 reportDate 查询 visitor_session，并返回 success、skipped、failed 明细。</span>
                </div>

                <el-form-item label="强制重跑" class="form-grid__full">
                  <div class="switch-row">
                    <el-switch v-model="batchForm.forceReanalyze" />
                    <span>关闭时会跳过已经 ANALYZED 且已有 summary 的会话</span>
                  </div>
                </el-form-item>
              </div>

              <div class="form-actions">
                <el-button type="primary" size="large" :loading="batchLoading" @click="handleBatchAnalyze">
                  执行批量日报
                </el-button>
              </div>
            </el-form>
          </el-card>
        </section>

        <section class="dashboard__grid">
          <el-card shadow="never" class="dashboard-card">
            <template #header>
              <div class="dashboard-card__header">
                <span>单用户日报结果</span>
                <el-tag v-if="singleResult" :type="singleSentimentTagType" effect="plain">
                  {{ singleResult.overallSentiment || '未标注情绪' }}
                </el-tag>
              </div>
            </template>

            <template v-if="singleResult">
              <div class="summary-box">
                <div>
                  <span>情绪倾向</span>
                  <strong>{{ singleResult.overallSentiment || '--' }}</strong>
                </div>
                <div>
                  <span>情绪分值</span>
                  <strong>{{ singleResult.sentimentScore ?? '--' }}</strong>
                </div>
              </div>

              <div class="summary-block">
                <span>会话总结</span>
                <p>{{ singleResult.summary || '暂无总结内容' }}</p>
              </div>

              <div v-for="section in singleSections" :key="section.label" class="summary-block">
                <span>{{ section.label }}</span>
                <div class="tag-list">
                  <em v-for="item in section.value" :key="item">{{ item }}</em>
                  <em v-if="!section.value.length">暂无数据</em>
                </div>
              </div>
            </template>

            <el-empty
              v-else
              description="提交单用户日报后，这里会展示 summary、sentiment 和四组标签结果。"
              :image-size="92"
            />
          </el-card>

          <el-card shadow="never" class="dashboard-card">
            <template #header>
              <div class="dashboard-card__header">
                <span>批量执行结果</span>
                <el-tag v-if="batchResult" effect="plain">{{ batchResult.reportDate }}</el-tag>
              </div>
            </template>

            <template v-if="batchResult">
              <div class="metric-grid">
                <div
                  v-for="item in batchMetrics"
                  :key="item.label"
                  class="metric-card"
                  :class="`metric-card--${item.tone}`"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>

              <el-table :data="batchItems" class="result-table" empty-text="当前日期没有返回执行明细">
                <el-table-column label="状态" width="110">
                  <template #default="{ row }">
                    <el-tag :type="getBatchItemStatus(row).type" effect="plain">
                      {{ getBatchItemStatus(row).label }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="sessionId" label="Session ID" min-width="110" />
                <el-table-column prop="sessionCode" label="Session Code" min-width="190" show-overflow-tooltip />
                <el-table-column prop="userId" label="用户 ID" min-width="110" />
                <el-table-column prop="message" label="执行说明" min-width="220" show-overflow-tooltip />
                <el-table-column prop="summary" label="摘要" min-width="280" show-overflow-tooltip />
              </el-table>
            </template>

            <el-empty
              v-else
              description="执行按日期批量日报后，这里会展示 totalCount、successCount、skippedCount、failedCount 和明细列表。"
              :image-size="92"
            />
          </el-card>
        </section>
      </template>

      <el-card v-else shadow="never" class="dashboard-card dashboard-card--full">
        <template #header>
          <div class="dashboard-card__header">
            <span>日报权限说明</span>
          </div>
        </template>

        <el-empty
          description="当前账号不是 super_admin，聊天日报接口不可调用。请切换为超级管理员后再提交 operatorUsername、operatorPassword、reportDate 等参数。"
          :image-size="96"
        />
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 24px;
  padding: 30px;
}

.dashboard__hero-side {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
}

.dashboard__hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.dashboard__eyebrow {
  margin: 0 0 12px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dashboard__title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.1;
}

.dashboard__desc {
  max-width: 760px;
  margin: 16px 0 0;
  color: #475569;
  font-size: 15px;
  line-height: 1.8;
}

.dashboard__grid,
.dashboard__admin-panel {
  display: grid;
  gap: 20px;
}

.dashboard__grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-card {
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
}

.dashboard-card--full {
  width: 100%;
}

.dashboard-card :deep(.el-card__header) {
  padding-bottom: 0;
  border-bottom: 0;
}

.dashboard-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.dashboard-card__hint {
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.summary-grid,
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.summary-item,
.metric-card {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.summary-item__label,
.metric-card span,
.summary-block span {
  color: #64748b;
  font-size: 13px;
}

.summary-item__value,
.metric-card strong,
.summary-box strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.metric-card--success {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.98));
}

.metric-card--warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(255, 255, 255, 0.98));
}

.metric-card--danger {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(255, 255, 255, 0.98));
}

.action-list {
  display: grid;
  gap: 14px;
}

.action-card {
  width: 100%;
  text-align: left;
  border: 1px solid #d9e3f0;
  border-radius: 22px;
  padding: 18px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(240, 249, 255, 0.96));
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.08);
}

.action-card__title {
  display: block;
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}

.action-card__desc {
  display: block;
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.action-card__link {
  display: inline-flex;
  margin-top: 14px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 700;
}

.capability-list {
  margin: 0;
  padding-left: 18px;
  color: #334155;
  line-height: 1.9;
}

.note-list {
  display: grid;
  gap: 12px;
  color: #334155;
  line-height: 1.8;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.form-grid__full {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  color: #475569;
  line-height: 1.7;
}

.batch-note {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-height: 112px;
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(15, 118, 110, 0.08));
  color: #334155;
}

.batch-note strong {
  color: #0f172a;
  font-size: 15px;
}

.summary-box {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 16px;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08));
}

.summary-box span {
  display: block;
  color: #64748b;
  font-size: 13px;
}

.summary-block {
  margin-top: 16px;
}

.summary-block p {
  margin: 10px 0 0;
  color: #334155;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.tag-list em {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  font-style: normal;
}

.result-table {
  margin-top: 18px;
}

code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
}

@media (max-width: 1120px) {
  .dashboard__hero,
  .dashboard__grid,
  .summary-grid,
  .metric-grid,
  .form-grid,
  .summary-box {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard__hero {
    padding: 22px;
  }

  .switch-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
