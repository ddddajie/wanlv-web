<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getNormalUserApi } from '@/api/user'
import { formatDateTime, formatGender, formatStatus, parseInterestTags } from './userViewUtils'

const loading = ref(false)
const detail = ref(null)
const form = reactive({
  id: 1,
})

async function handleSearch() {
  loading.value = true

  try {
    detail.value = await getNormalUserApi(Number(form.id))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  handleSearch()
})
</script>

<template>
  <div class="detail-page">
    <el-card shadow="never" class="detail-page__card">
      <template #header>
        <div class="detail-page__card-head">
          <span>普通用户信息</span>
          <el-tag v-if="detail" :type="Number(detail.status) === 1 ? 'success' : 'danger'" effect="plain">
            {{ formatStatus(detail.status) }}
          </el-tag>
        </div>
      </template>

      <div class="detail-page__toolbar">
        <el-input-number v-model="form.id" :min="1" class="detail-page__number" />
        <el-button type="primary" :loading="loading" @click="handleSearch">查询详情</el-button>
      </div>

      <el-empty v-if="!detail && !loading" description="请输入普通用户 ID 后查询" :image-size="90" />

      <el-skeleton v-else-if="loading" :rows="8" animated />

      <div v-else class="detail-page__content">
        <div class="detail-page__avatar">
          <img :src="detail.avatarUrl || '/default-avatar.svg'" alt="普通用户头像" />
        </div>

        <el-descriptions :column="2" border class="detail-page__descriptions">
          <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="账号">{{ detail.username || '-' }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ detail.nickname || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ formatStatus(detail.status) }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detail.phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ detail.email || '-' }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ formatGender(detail.gender) }}</el-descriptions-item>
          <el-descriptions-item label="年龄">{{ detail.age ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="最近登录">{{ formatDateTime(detail.lastLoginTime) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(detail.createTime) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDateTime(detail.updateTime) }}</el-descriptions-item>
          <el-descriptions-item label="兴趣标签">
            <div class="detail-page__tags">
              <el-tag
                v-for="tag in parseInterestTags(detail.interestTags)"
                :key="tag"
                effect="plain"
                type="info"
              >
                {{ tag }}
              </el-tag>
              <span v-if="!parseInterestTags(detail.interestTags).length">-</span>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.detail-page {
  display: grid;
  gap: 20px;
}

.detail-page__card {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
}

.detail-page__card :deep(.el-card__header) {
  border-bottom: 0;
}

.detail-page__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.detail-page__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.detail-page__number {
  width: 220px;
}

.detail-page__content {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.detail-page__avatar {
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 24px;
  background: rgba(226, 232, 240, 0.7);
}

.detail-page__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-page__descriptions :deep(.el-descriptions__label) {
  width: 120px;
}

.detail-page__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 980px) {
  .detail-page__content {
    grid-template-columns: 1fr;
  }

  .detail-page__number {
    width: 100%;
  }

  .detail-page__toolbar {
    align-items: stretch;
  }
}
</style>
