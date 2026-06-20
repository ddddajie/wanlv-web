<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { normalLogoutApi } from '@/api/user'
import { dialog } from '@/utils/feedback'
import { pinia, useUserStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore(pinia)

const showShellHeader = computed(() => route.path !== '/dashboard')
const isDashboardRoute = computed(() => route.path === '/dashboard')

const navItems = computed(() => {
  if (!userStore.isLoggedIn) {
    return [
      { label: '数据大屏', path: '/dashboard' },
      { label: '导游地图', path: '/tourist-map' },
    ]
  }

  const items = [{ label: '控制台', path: '/dashboard' }]

  if (!userStore.isAdmin) {
    items.push({ label: '智能问答', path: '/chat' })
  }

  items.push({ label: '导游地图', path: '/tourist-map' })

  if (userStore.isSuperAdmin) {
    items.push({ label: '知识库管理', path: '/knowledge' })
    items.push({ label: '新增管理员', path: '/admin/create' })
  }

  return items
})

const roleLabel = computed(() => {
  if (userStore.isSuperAdmin) return '超级管理员'
  if (userStore.isAdmin) return '管理员'
  return '普通用户'
})

async function handleLogout() {
  try {
    await dialog.confirm('退出后需要重新登录，是否继续？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
    })

    const userType = userStore.userType
    const refreshToken = userStore.refreshToken

    try {
      if (userType === 'normal' && refreshToken) {
        await normalLogoutApi(refreshToken)
      }
    } finally {
      // 即使注销接口网络异常，也必须立即清理本地登录凭证。
      userStore.clearLogin()
      router.replace(userType === 'admin' ? '/admin/login' : '/normal/login')
    }
  } catch {
    return
  }
}

function handleLogin() {
  router.push({
    path: '/normal/login',
    query: route.fullPath === '/normal/login' ? undefined : { redirect: route.fullPath },
  })
}
</script>

<template>
  <div class="shell-layout" :class="{ 'shell-layout--dashboard': isDashboardRoute }">
    <header v-if="showShellHeader" class="shell-header">
      <RouterLink to="/dashboard" class="shell-header__brand">
        <div class="shell-header__logo">万旅</div>
        <div>
          <div class="shell-header__title">万旅文旅运营平台</div>
          <div class="shell-header__subtitle">景区预约、地图导览与智能问答的一体化工作台</div>
        </div>
      </RouterLink>

      <nav class="shell-header__nav" aria-label="主导航">
        <n-button
          v-for="item in navItems"
          :key="item.path"
          :type="route.path === item.path ? 'primary' : 'tertiary'"
          round
          @click="router.push(item.path)"
        >
          {{ item.label }}
        </n-button>
      </nav>

      <div v-if="userStore.isLoggedIn" class="shell-header__user">
        <div class="shell-header__meta">
          <span class="shell-header__name">{{ userStore.displayName || userStore.username }}</span>
          <div class="shell-header__tags">
            <n-tag size="small" :bordered="false" type="success">{{ roleLabel }}</n-tag>
            <n-tag size="small" :bordered="false" type="info">{{ userStore.role || 'normal_user' }}</n-tag>
          </div>
        </div>
        <n-button round secondary @click="handleLogout">退出登录</n-button>
      </div>

      <div v-else class="shell-header__user">
        <n-button type="primary" round @click="handleLogin">去登录</n-button>
      </div>
    </header>

    <main class="shell-main" :class="{ 'shell-main--compact': !showShellHeader }">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shell-layout {
  min-height: 100vh;
  padding: 20px;
}

.shell-layout--dashboard {
  height: 100vh;
  padding: 0;
  overflow: hidden;
}

.shell-header {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto auto;
  gap: 18px;
  align-items: center;
  min-height: var(--wl-header-height);
  padding: 12px 16px;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: var(--wl-shadow-sm);
}

.shell-header__brand,
.shell-header__user {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.shell-header__logo {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  place-items: center;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--wl-primary-dark), var(--wl-primary));
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}

.shell-header__title {
  color: var(--wl-ink);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
}

.shell-header__subtitle {
  margin-top: 3px;
  color: var(--wl-muted);
  font-size: 12px;
}

.shell-header__nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.shell-header__user {
  justify-content: flex-end;
}

.shell-header__meta {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.shell-header__name {
  color: var(--wl-ink);
  font-weight: 750;
  text-align: right;
}

.shell-header__tags {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.shell-main {
  padding-top: 18px;
}

.shell-main--compact {
  padding-top: 0;
}

.shell-layout--dashboard .shell-main {
  height: 100%;
  min-height: 0;
}

@media (max-width: 1120px) {
  .shell-header {
    grid-template-columns: 1fr;
  }

  .shell-header__nav {
    justify-content: flex-start;
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
    padding: 12px;
  }

  .shell-layout--dashboard {
    padding: 0;
  }

  .shell-header__user {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
