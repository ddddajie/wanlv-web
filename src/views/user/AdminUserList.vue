<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteAdminUserApi, pageAdminUsersApi, updateAdminUserApi } from '@/api/user'
import { formatDateTime, formatStatus, normalizePageResult } from './userViewUtils'

const loading = ref(false)
const deletingId = ref(null)
const statusChangingId = ref(null)
const pageData = ref({
  total: 0,
  records: [],
})
const query = reactive({
  pageNum: 1,
  pageSize: 10,
})

async function fetchList() {
  loading.value = true

  try {
    const result = await pageAdminUsersApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    })
    pageData.value = normalizePageResult(result)
  } finally {
    loading.value = false
  }
}

function handleCurrentChange(pageNum) {
  query.pageNum = pageNum
  fetchList()
}

function handleSizeChange(pageSize) {
  query.pageSize = pageSize
  query.pageNum = 1
  fetchList()
}

async function handleDelete(row) {
  if (!row?.id) return
  if (row.role === 'super_admin') {
    ElMessage.warning('超级管理员不能删除')
    return
  }

  try {
    await ElMessageBox.confirm(`确定删除管理员“${row.realName || row.username || row.id}”吗？删除后账号会被禁用并从列表中移除。`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      draggable: true,
    })
  } catch {
    return
  }

  deletingId.value = row.id
  try {
    await deleteAdminUserApi(row.id)
    ElMessage.success(`管理员 ${row.realName || row.username || row.id} 已删除`)
    if (pageData.value.records.length === 1 && query.pageNum > 1) {
      query.pageNum -= 1
    }
    await fetchList()
  } finally {
    deletingId.value = null
  }
}

async function handleStatusChange(row) {
  if (!row?.id) return
  const nextStatus = Number(row.status) === 1 ? 0 : 1
  statusChangingId.value = row.id
  try {
    await updateAdminUserApi({
      id: row.id,
      status: nextStatus,
    })
    ElMessage.success(`管理员 ${row.realName || row.username || row.id} 已${nextStatus === 1 ? '启用' : '停用'}`)
    await fetchList()
  } finally {
    statusChangingId.value = null
  }
}

onMounted(() => {
  fetchList()
})
</script>

<template>
  <div class="list-page">
    <el-card shadow="never" class="list-page__card">
      <template #header>
        <div class="list-page__card-head">
          <span>管理员列表</span>
        </div>
      </template>

      <el-table :data="pageData.records" v-loading="loading" stripe class="list-page__table">
        <el-table-column prop="id" label="ID" min-width="76" />
        <el-table-column prop="username" label="账号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="realName" label="真实姓名" min-width="120" show-overflow-tooltip />
        <el-table-column prop="role" label="角色" min-width="120" show-overflow-tooltip />
        <el-table-column prop="scenicSpot" label="所属景区" min-width="140" show-overflow-tooltip />
        <el-table-column prop="phone" label="手机号" min-width="140" />
        <el-table-column prop="email" label="邮箱" min-width="190" show-overflow-tooltip />
        <el-table-column label="状态" min-width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="Number(row.status) === 1 ? 'success' : 'danger'" effect="plain">
              {{ formatStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近登录" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.lastLoginTime) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button link :type="Number(row.status) === 1 ? 'warning' : 'success'"
              :loading="statusChangingId === row.id" @click="handleStatusChange(row)">
              {{ Number(row.status) === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" :disabled="row.role === 'super_admin'" :loading="deletingId === row.id"
              @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="list-page__footer">
        <el-pagination background layout="total, sizes, prev, pager, next" :current-page="query.pageNum"
          :page-size="query.pageSize" :page-sizes="[10, 20, 50]" :total="pageData.total"
          @current-change="handleCurrentChange" @size-change="handleSizeChange" />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.list-page {
  display: grid;
  gap: 20px;
}

.list-page__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.7fr);
  gap: 20px;
  padding: 28px;
}

.list-page__eyebrow {
  margin: 0 0 10px;
  color: #b45309;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.list-page__title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(28px, 4vw, 38px);
}

.list-page__desc {
  margin: 14px 0 0;
  color: #475569;
  line-height: 1.8;
}

.list-page__summary {
  display: grid;
  gap: 12px;
  align-content: center;
}

.list-page__summary-item {
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.92);
}

.list-page__summary-item span {
  display: block;
  color: #64748b;
  font-size: 13px;
}

.list-page__summary-item strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 20px;
}

.list-page__card {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
}

.list-page__card :deep(.el-card__header) {
  border-bottom: 0;
}

.list-page__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.list-page__table {
  width: 100%;
}

.list-page__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
}

@media (max-width: 1080px) {
  .list-page__hero {
    grid-template-columns: 1fr;
  }

  .list-page__footer {
    justify-content: center;
  }
}
</style>
