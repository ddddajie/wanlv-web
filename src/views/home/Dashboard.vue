<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { targetBaseUrl } from '@/utils/request'
import { pinia, useUserStore } from '@/stores'

const router = useRouter()
const userStore = useUserStore(pinia)

const userSummary = computed(() => [
  {
    label: '当前身份',
    value: userStore.userType === 'admin' ? '管理员' : '普通用户',
  },
  {
    label: '当前角色',
    value: userStore.role || 'normal_user',
  },
  {
    label: '展示名称',
    value: userStore.displayName || userStore.username || '-',
  },
  {
    label: '最后登录时间',
    value: userStore.userInfo?.lastLoginTime || '首次登录或暂无记录',
  },
])

const quickActions = computed(() => {
  const actions = [
    {
      title: '查看当前登录信息',
      description: '适合联调登录返回结构、角色和状态字段。',
      actionText: '刷新首页',
      handler: () => router.replace('/dashboard'),
    },
  ]

  if (userStore.isSuperAdmin) {
    actions.push({
      title: '新增管理员',
      description: '只有超级管理员才会看到并可以进入新增管理员页面。',
      actionText: '进入新增页',
      handler: () => router.push('/admin/create'),
    })
  }

  return actions
})

const capabilityList = computed(() => {
  if (userStore.isSuperAdmin) {
    return [
      '可以登录管理员端，并进入新增管理员页面。',
      '新增管理员时会自动预填当前超级管理员账号。',
      '操作人密码不会被缓存，需要每次手动输入。',
    ]
  }

  if (userStore.isAdmin) {
    return [
      '可以登录管理员端并查看当前登录状态。',
      '不能进入新增管理员页面，前端会直接拦截。',
      '如强行访问路由，会收到“只有超级管理员才能新增管理员”的提示。',
    ]
  }

  return [
    '可以完成普通用户登录和注册联调。',
    '注册页支持兴趣标签文本输入，并自动转换为接口要求的字符串。',
    '当前后端暂无更多普通用户业务接口，首页展示以联调说明为主。',
  ]
})
</script>

<template>
  <div class="dashboard">
    <section class="dashboard__hero glass-card">
      <div>
        <p class="dashboard__eyebrow">Connected to {{ targetBaseUrl }}</p>
        <h1 class="dashboard__title">
          {{ userStore.displayName || userStore.username }}，欢迎来到万旅用户中心
        </h1>
        <p class="dashboard__desc">
          当前前端已按接口文档接入普通用户登录、普通用户注册、管理员登录和新增管理员流程，
          所有接口都按响应体中的 <code>code</code> 判断成败。
        </p>
      </div>

      <el-alert
        :title="userStore.isSuperAdmin ? '你当前是超级管理员，可直接新增管理员。' : '新增管理员入口只会对超级管理员显示。'"
        :type="userStore.isSuperAdmin ? 'success' : 'warning'"
        show-icon
        :closable="false"
      />
    </section>

    <section class="dashboard__grid">
      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card__header">
            <span>登录信息</span>
            <el-tag effect="plain">{{ userStore.username }}</el-tag>
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
            <span>快捷操作</span>
            <span class="dashboard-card__hint">按当前身份展示</span>
          </div>
        </template>

        <div class="action-list">
          <button
            v-for="item in quickActions"
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
            <span>当前可做的联调</span>
          </div>
        </template>

        <ul class="capability-list">
          <li v-for="item in capabilityList" :key="item">{{ item }}</li>
        </ul>
      </el-card>

      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card__header">
            <span>接口约定提醒</span>
          </div>
        </template>

        <div class="note-list">
          <div>接口前缀：<code>/user</code></div>
          <div>成功判断：<code>res.code === 200</code></div>
          <div>普通用户注册的 <code>interestTags</code> 需传字符串</div>
          <div>当前阶段无需依赖 token，也不发送 Authorization</div>
        </div>
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
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
  padding: 30px;
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
}

.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.dashboard-card {
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.76);
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.summary-item {
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid #e2e8f0;
}

.summary-item__label {
  color: #64748b;
  font-size: 13px;
}

.summary-item__value {
  margin-top: 10px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
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
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(240, 249, 255, 0.94));
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
}

code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
}

@media (max-width: 1024px) {
  .dashboard__hero,
  .dashboard__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard__hero {
    padding: 22px;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
