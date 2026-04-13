<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { pinia, useUserStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore(pinia)

const navItems = computed(() => {
  const items = [{ label: '控制台', path: '/dashboard' }]

  if (userStore.isSuperAdmin) {
    items.push({ label: '新增管理员', path: '/admin/create' })
  }

  return items
})

async function handleLogout() {
  try {
    await ElMessageBox.confirm('退出后需要重新登录，是否继续？', '退出登录', {
      type: 'warning',
      confirmButtonText: '退出',
      cancelButtonText: '取消',
    })

    userStore.clearLogin()
    router.replace('/normal/login')
  } catch {
    return
  }
}
</script>

<template>
  <div class="shell-layout">
    <header class="shell-header">
      <div class="shell-header__brand">
        <div class="shell-header__logo">WL</div>
        <div>
          <div class="shell-header__title">万旅用户中心</div>
          <div class="shell-header__subtitle">按当前后端接口完成的联调工作台</div>
        </div>
      </div>

      <nav class="shell-header__nav">
        <el-button
          v-for="item in navItems"
          :key="item.path"
          :type="route.path === item.path ? 'primary' : 'default'"
          round
          @click="router.push(item.path)"
        >
          {{ item.label }}
        </el-button>
      </nav>

      <div class="shell-header__user">
        <div class="shell-header__meta">
          <span class="shell-header__name">
            {{ userStore.displayName || userStore.username }}
          </span>
          <div class="shell-header__tags">
            <el-tag effect="plain" type="success">
              {{ userStore.userType === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
            <el-tag effect="plain" :type="userStore.isSuperAdmin ? 'warning' : 'info'">
              {{ userStore.role || 'normal_user' }}
            </el-tag>
          </div>
        </div>
        <el-button round @click="handleLogout">退出登录</el-button>
      </div>
    </header>

    <main class="shell-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shell-layout {
  min-height: 100vh;
  padding: 24px;
}

.shell-header {
  display: grid;
  grid-template-columns: 1.2fr auto auto;
  gap: 20px;
  align-items: center;
  padding: 20px 24px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px);
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.08);
}

.shell-header__brand,
.shell-header__user {
  display: flex;
  align-items: center;
  gap: 14px;
}

.shell-header__logo {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  background: linear-gradient(135deg, #0f766e 0%, #f59e0b 100%);
}

.shell-header__title {
  color: #0f172a;
  font-size: 22px;
  font-weight: 800;
}

.shell-header__subtitle {
  margin-top: 4px;
  color: #475569;
  font-size: 13px;
}

.shell-header__nav {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.shell-header__user {
  justify-content: flex-end;
}

.shell-header__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shell-header__name {
  color: #0f172a;
  font-weight: 700;
  text-align: right;
}

.shell-header__tags {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.shell-main {
  padding-top: 24px;
}

@media (max-width: 1120px) {
  .shell-header {
    grid-template-columns: 1fr;
  }

  .shell-header__user {
    justify-content: space-between;
  }

  .shell-header__name,
  .shell-header__tags {
    text-align: left;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .shell-layout {
    padding: 16px;
  }

  .shell-header {
    padding: 18px;
    border-radius: 24px;
  }

  .shell-header__user {
    flex-direction: column;
    align-items: stretch;
  }

  .shell-header__meta {
    width: 100%;
  }
}
</style>
