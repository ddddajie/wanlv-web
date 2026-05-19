<script setup>
import { onMounted, ref } from 'vue'
import { listUserDigitalProfilesApi } from '@/api/user'
import { formatDateTime, normalizePageResult } from './userViewUtils'

const loading = ref(false)
const pageData = ref({
  total: 0,
  records: [],
})
const query = ref({
  pageNum: 1,
  pageSize: 10,
})
const tagDialogVisible = ref(false)
const selectedProfile = ref(null)

function normalizeTagList(value) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return String(value)
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

function formatScore(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '-'
  const score = Number(value)
  if (!Number.isFinite(score)) return '-'

  return `${score}${suffix}`
}

function getSentimentTagType(value) {
  const sentiment = String(value || '').toLowerCase()
  if (sentiment === 'positive') return 'success'
  if (sentiment === 'negative') return 'danger'
  if (sentiment === 'neutral') return 'info'
  return 'warning'
}

function formatSentiment(value) {
  const sentiment = String(value || '').toLowerCase()
  if (sentiment === 'positive') return '积极'
  if (sentiment === 'neutral') return '中性'
  if (sentiment === 'negative') return '消极'
  return value || '-'
}

function openTagDialog(row) {
  selectedProfile.value = row
  tagDialogVisible.value = true
}

async function fetchProfiles() {
  loading.value = true

  try {
    // 后端已按 update_time desc, id desc 排序，前端保持返回顺序直接展示。
    const result = await listUserDigitalProfilesApi({
      pageNum: query.value.pageNum,
      pageSize: query.value.pageSize,
    })
    pageData.value = normalizePageResult(result)
  } finally {
    loading.value = false
  }
}

function handleCurrentChange(pageNum) {
  query.value.pageNum = pageNum
  fetchProfiles()
}

function handleSizeChange(pageSize) {
  query.value.pageSize = pageSize
  query.value.pageNum = 1
  fetchProfiles()
}

onMounted(() => {
  fetchProfiles()
})
</script>

<template>
  <div class="profile-page">
    <el-card shadow="never" class="profile-page__card">
      <template #header>
        <div class="profile-page__card-head">
          <span>用户数字画像</span>
          <el-button type="primary" :loading="loading" @click="fetchProfiles">刷新</el-button>
        </div>
      </template>

      <el-table :data="pageData.records" v-loading="loading" stripe class="profile-page__table" row-key="id">
        <el-table-column prop="userId" label="用户 ID" min-width="100" />
        <el-table-column prop="profileName" label="画像名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="travelStyle" label="旅行风格" min-width="110" show-overflow-tooltip />
        <el-table-column prop="activityLevel" label="活跃等级" min-width="100" show-overflow-tooltip />
        <el-table-column label="情绪倾向" min-width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="getSentimentTagType(row.sentimentTendency)" effect="plain">
              {{ formatSentiment(row.sentimentTendency) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="情绪均分" min-width="100">
          <template #default="{ row }">
            {{ formatScore(row.sentimentScoreAvg) }}
          </template>
        </el-table-column>
        <el-table-column label="画像分" min-width="90">
          <template #default="{ row }">
            {{ formatScore(row.profileScore) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastAnalyzedDate" label="最近分析日期" min-width="130" />
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.updateTime) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openTagDialog(row)">查看标签</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="profile-page__footer">
        <el-pagination background layout="total, sizes, prev, pager, next" :current-page="query.pageNum"
          :page-size="query.pageSize" :page-sizes="[10, 20, 50]" :total="pageData.total"
          @current-change="handleCurrentChange" @size-change="handleSizeChange" />
      </div>
    </el-card>

    <el-dialog v-model="tagDialogVisible" :title="selectedProfile?.profileName || '用户画像标签'" width="720px">
      <div class="profile-page__tag-dialog">
        <section class="profile-page__tag-group">
          <h4>兴趣标签</h4>
          <div class="profile-page__tags">
            <el-tag v-for="tag in normalizeTagList(selectedProfile?.interestTags)" :key="`dialog-interest-${tag}`"
              effect="plain" type="info">
              {{ tag }}
            </el-tag>
            <span v-if="!normalizeTagList(selectedProfile?.interestTags).length">暂无</span>
          </div>
        </section>

        <section class="profile-page__tag-group">
          <h4>关注主题</h4>
          <div class="profile-page__tags">
            <el-tag v-for="tag in normalizeTagList(selectedProfile?.focusTopics)" :key="`dialog-topic-${tag}`"
              effect="plain">
              {{ tag }}
            </el-tag>
            <span v-if="!normalizeTagList(selectedProfile?.focusTopics).length">暂无</span>
          </div>
        </section>

        <section class="profile-page__tag-group">
          <h4>服务需求</h4>
          <div class="profile-page__tags">
            <el-tag v-for="tag in normalizeTagList(selectedProfile?.serviceNeeds)" :key="`dialog-need-${tag}`"
              effect="plain" type="success">
              {{ tag }}
            </el-tag>
            <span v-if="!normalizeTagList(selectedProfile?.serviceNeeds).length">暂无</span>
          </div>
        </section>

        <section class="profile-page__tag-group">
          <h4>知识缺口</h4>
          <div class="profile-page__tags">
            <el-tag v-for="tag in normalizeTagList(selectedProfile?.knowledgeGaps)" :key="`dialog-gap-${tag}`"
              effect="plain" type="warning">
              {{ tag }}
            </el-tag>
            <span v-if="!normalizeTagList(selectedProfile?.knowledgeGaps).length">暂无</span>
          </div>
        </section>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.profile-page {
  display: grid;
  gap: 20px;
}

.profile-page__card {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
}

.profile-page__card :deep(.el-card__header) {
  border-bottom: 0;
}

.profile-page__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.profile-page__table {
  width: 100%;
}

.profile-page__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.profile-page__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.profile-page__tag-dialog {
  display: grid;
  gap: 18px;
}

.profile-page__tag-group {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.profile-page__tag-group h4 {
  margin: 0;
  color: #334155;
  font-size: 14px;
}
</style>
