<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { analyzeDailySessionsApi, analyzeSessionApi } from '@/api/chat'

const formRef = ref()
const loading = ref(false)
const resultMode = ref('')
const singleResult = ref(null)
const batchResult = ref(null)

function formatDate(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const form = reactive({
  userId: '',
  reportDate: formatDate(),
  forceReanalyze: false,
})

const rules = {
  userId: [{ validator: validateOptionalUserId, trigger: 'blur' }],
}

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

function validateOptionalUserId(rule, value, callback) {
  if (value === '' || value === null || value === undefined) {
    callback()
    return
  }

  const userId = Number(value)
  if (!Number.isInteger(userId) || userId <= 0) {
    callback(new Error('用户 ID 必须是正整数'))
    return
  }

  callback()
}

function toArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  return [value]
}

function buildPayload(extraPayload = {}) {
  return {
    ...extraPayload,
  }
}

function getBatchItemStatus(item) {
  if (item?.skipped) return { label: '已跳过', type: 'warning' }
  if (item?.success) return { label: '成功', type: 'success' }
  return { label: '失败', type: 'danger' }
}

async function handleSubmit() {
  await formRef.value?.validate()
  loading.value = true

  try {
    if (form.userId) {
      batchResult.value = null
      singleResult.value = await analyzeSessionApi(
        buildPayload({
          userId: Number(form.userId),
          reportDate: form.reportDate || undefined,
          forceReanalyze: form.forceReanalyze,
        }),
      )
      resultMode.value = 'single'
      ElMessage.success('单用户日报生成成功')
      return
    }

    singleResult.value = null
    batchResult.value = await analyzeDailySessionsApi(
      buildPayload({
        reportDate: form.reportDate || undefined,
        forceReanalyze: form.forceReanalyze,
      }),
    )
    resultMode.value = 'batch'
    ElMessage.success('全部用户日报生成成功')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="daily-report-page">
    <el-card shadow="never" class="report-card report-card--compact">
      <template #header>
        <div class="report-card__header">
          <div>
            <h3>日报管理</h3>
            <p>填写用户 ID 时只生成该用户日报；留空时按日期生成全部用户日报。</p>
          </div>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="report-form-grid">
          <el-form-item label="用户 ID" prop="userId">
            <el-input
              v-model.trim="form.userId"
              placeholder="留空则生成全部用户日报"
              clearable
            />
          </el-form-item>

          <el-form-item label="日报日期">
            <el-date-picker
              v-model="form.reportDate"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item class="report-form-grid__full" label="执行选项">
            <div class="switch-row">
              <el-switch v-model="form.forceReanalyze" />
              <span>开启后即使已有结果也会重新生成并覆盖。</span>
            </div>
          </el-form-item>
        </div>

        <div class="report-actions">
          <el-button type="primary" :loading="loading" @click="handleSubmit">
            {{ form.userId ? '生成该用户日报' : '生成全部用户日报' }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <el-card shadow="never" class="report-card">
      <template #header>
        <div class="report-card__header">
          <div>
            <h3>日报结果</h3>
            <p>生成完成后会直接在这里展示结果，无需再切换其他页面。</p>
          </div>
          <el-tag v-if="resultMode === 'single' && singleResult" :type="singleSentimentTagType" effect="plain">
            {{ singleResult.overallSentiment || '未标注情绪' }}
          </el-tag>
          <el-tag v-else-if="resultMode === 'batch' && batchResult" effect="plain">
            {{ batchResult.reportDate }}
          </el-tag>
        </div>
      </template>

      <template v-if="resultMode === 'single' && singleResult">
        <div class="summary-box">
          <div>
            <span>情绪倾向</span>
            <strong>{{ singleResult.overallSentiment || '--' }}</strong>
          </div>
          <div>
            <span>情绪分数</span>
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

      <template v-else-if="resultMode === 'batch' && batchResult">
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
        description="填写表单并执行后，日报结果会直接显示在这里。"
        :image-size="96"
      />
    </el-card>
  </div>
</template>

<style scoped>
.daily-report-page {
  display: grid;
  gap: 18px;
}

.report-card {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
}

.report-card--compact :deep(.el-card__body) {
  padding-top: 8px;
}

.report-card :deep(.el-card__header) {
  border-bottom: 0;
  padding-bottom: 0;
}

.report-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.report-card__header h3 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
}

.report-card__header p {
  margin: 8px 0 0;
  color: #64748b;
  line-height: 1.6;
}

.report-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
}

.report-form-grid__full {
  grid-column: 1 / -1;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  color: #475569;
  line-height: 1.7;
}

.report-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: 8px;
}

.summary-box {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08));
}

.summary-box span,
.summary-block span,
.metric-card span {
  color: #64748b;
  font-size: 13px;
}

.summary-box strong,
.metric-card strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 700;
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

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.metric-card--neutral {
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
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

.result-table {
  margin-top: 18px;
}

@media (max-width: 1120px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .report-form-grid,
  .summary-box {
    grid-template-columns: 1fr;
  }

  .switch-row {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 768px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
