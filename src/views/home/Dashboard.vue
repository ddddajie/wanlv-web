<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { pinia, useUserStore } from '@/stores'
import AdminCreate from '@/views/user/AdminCreate.vue'
import AdminUserDetail from '@/views/user/AdminUserDetail.vue'
import AdminUserList from '@/views/user/AdminUserList.vue'
import Chat from '@/views/chat/Chat-2.0.vue'
import DailyReport from '@/views/report/DailyReport.vue'
import NormalUserDetail from '@/views/user/NormalUserDetail.vue'
import NormalUserList from '@/views/user/NormalUserList.vue'
import UserProfileEdit from '@/views/user/UserProfileEdit.vue'

const MapWorkspace = defineAsyncComponent(() => import('@/views/map/MapWorkspace.vue'))
const TouristMap = defineAsyncComponent(() => import('@/views/map/TouristMap.vue'))
const ReservationDashboardScreen = defineAsyncComponent(() => import('@/views/reservation/ReservationDashboardScreen.vue'))
const ReservationWorkspace = defineAsyncComponent(() => import('@/views/reservation/ReservationWorkspace.vue'))
const UserReservationDashboardScreen = defineAsyncComponent(
  () => import('@/views/reservation/UserReservationDashboardScreen.vue'),
)

const DEFAULT_AVATAR = '/default-avatar.svg'
const MOBILE_BREAKPOINT = 1180
const PUBLIC_MENU_KEYS = ['user-reservation-dashboard-screen', 'tourist-map']

const route = useRoute()
const router = useRouter()
const userStore = useUserStore(pinia)

const getDefaultMenuKey = () => {
  const routeView = typeof route.query.view === 'string' ? route.query.view : ''
  if (!userStore.isLoggedIn && PUBLIC_MENU_KEYS.includes(routeView)) return routeView
  return userStore.isAdmin ? 'reservation-dashboard-screen' : 'user-reservation-dashboard-screen'
}

const activeMenu = ref(getDefaultMenuKey())
const avatarLoadFailed = ref(false)
const isCompactSidebar = ref(false)
const isSidebarOpen = ref(false)

const canUseAnalysis = computed(() => userStore.isSuperAdmin)
const canUseUserManagement = computed(() => userStore.isAdmin)
const isGuest = computed(() => !userStore.isLoggedIn)
const isDashboardScreenMenu = computed(() =>
  ['reservation-dashboard-screen', 'user-reservation-dashboard-screen'].includes(activeMenu.value),
)
const isDashboardScreenActive = computed(() =>
  userStore.isLoggedIn && isDashboardScreenMenu.value,
)

const roleLabel = computed(() => {
  if (userStore.isSuperAdmin) return '超级管理员'
  if (userStore.isAdmin) return '管理员'
  return '普通用户'
})

const avatarUrl = computed(() => {
  if (avatarLoadFailed.value) return DEFAULT_AVATAR
  return userStore.userInfo?.avatarUrl || DEFAULT_AVATAR
})

// 普通用户固定展示昵称，管理员按后台返回的 displayName 展示。
const sidebarDisplayName = computed(() => {
  if (userStore.isAdmin) return userStore.displayName || userStore.username || '未登录用户'
  return userStore.userInfo?.nickname || userStore.username || '未登录用户'
})
// 首页默认进入数据页面，管理员和普通用户使用各自的数据大屏。
const defaultMenuKey = computed(() =>
  userStore.isAdmin ? 'reservation-dashboard-screen' : 'user-reservation-dashboard-screen',
)

const menuItems = computed(() => {
  if (isGuest.value) {
    return [
      { key: 'user-reservation-dashboard-screen', label: '数据大屏' },
      { key: 'tourist-map', label: '导游地图' },
    ]
  }

  if (!userStore.isAdmin) {
    return [
      { key: 'user-reservation-dashboard-screen', label: '数据大屏' },
      { key: 'tourist-map', label: '导游地图' },
      { key: 'reservation-workspace', label: '景点预约' },
      { key: 'chat-page', label: '智能问答' },
    ]
  }

  const items = [
    { key: 'reservation-dashboard-screen', label: '数据大屏' },
  ]

  if (canUseAnalysis.value) {
    items.push({ key: 'daily-report', label: '日报管理' })
  }

  items.push({ key: 'tourist-map', label: '导游地图' })

  if (canUseUserManagement.value) {
    items.push(
      {
        key: 'scenic-management',
        label: '景区管理',
        children: [
          { key: 'map-workspace', label: '地图业务控制台' },
          { key: 'reservation-workspace', label: '预约管理' },
        ],
      },
      {
        key: 'user-management',
        label: '用户管理',
        children: [
          ...(canUseAnalysis.value ? [{ key: 'admin-create-page', label: '新增管理员' }] : []),
          { key: 'user-admin-detail', label: '管理员详情查询' },
          { key: 'user-normal-detail', label: '普通用户详情查询' },
          { key: 'user-admin-list', label: '管理员分页列表' },
          { key: 'user-normal-list', label: '普通用户分页列表' },
        ],
      },
    )
  }

  return items
})

const extraViewItems = computed(() => (isGuest.value ? [] : [{ key: 'profile-edit', label: '修改信息' }]))

const flatMenuItems = computed(() =>
  [...menuItems.value, ...extraViewItems.value].flatMap((item) => (item.children?.length ? item.children : [item])),
)

const currentMenuLabel = computed(() => {
  return flatMenuItems.value.find((item) => item.key === activeMenu.value)?.label || '数据大屏'
})

watch(
  menuItems,
  (items) => {
    const availableKeys = [...items, ...extraViewItems.value].flatMap((item) =>
      item.children?.length ? item.children : [item],
    )
    if (!availableKeys.some((item) => item.key === activeMenu.value)) {
      const defaultItem = availableKeys.find((item) => item.key === defaultMenuKey.value)
      activeMenu.value = defaultItem?.key || availableKeys[0]?.key || defaultMenuKey.value
    }
  },
  { immediate: true },
)

watch(
  () => route.query.view,
  (view) => {
    if (typeof view === 'string' && flatMenuItems.value.some((item) => item.key === view)) {
      activeMenu.value = view
    }
  },
)

watch(
  () => userStore.userInfo?.avatarUrl,
  () => {
    avatarLoadFailed.value = false
  },
)

watch(isCompactSidebar, (compact) => {
  if (!compact) {
    isSidebarOpen.value = false
  }
})

function handleMenuSelect(key) {
  activeMenu.value = key
  if (isCompactSidebar.value) {
    isSidebarOpen.value = false
  }
}

function handleActionNavigate(actionKey) {
  if (flatMenuItems.value.some((item) => item.key === actionKey)) {
    activeMenu.value = actionKey
    if (isCompactSidebar.value) {
      isSidebarOpen.value = false
    }
  }
}

function handleAvatarError() {
  avatarLoadFailed.value = true
}

function handleProfileEdit() {
  if (isGuest.value) {
    handleLogin()
    return
  }

  activeMenu.value = 'profile-edit'
  if (isCompactSidebar.value) {
    isSidebarOpen.value = false
  }
}

function handleLogin() {
  router.push({
    path: '/normal/login',
    query: { redirect: route.fullPath },
  })
}

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

function syncCompactSidebar() {
  if (typeof window === 'undefined') return
  isCompactSidebar.value = window.innerWidth <= MOBILE_BREAKPOINT
}

function toggleSidebar() {
  if (!isCompactSidebar.value) return
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

onMounted(() => {
  syncCompactSidebar()
  window.addEventListener('resize', syncCompactSidebar)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncCompactSidebar)
})
</script>

<template>
  <div class="dashboard-workspace">
    <section class="dashboard-workspace__frame glass-card" :class="{
      'dashboard-workspace__frame--compact': isCompactSidebar,
      'dashboard-workspace__frame--screen': isDashboardScreenActive,
    }">
      <aside v-if="!isDashboardScreenActive" class="dashboard-sidebar" :class="{
        'dashboard-sidebar--compact': isCompactSidebar,
        'dashboard-sidebar--open': isCompactSidebar && isSidebarOpen,
      }">
        <div class="dashboard-user">
          <div v-if="!isGuest" class="dashboard-user__top">
            <div class="dashboard-user__avatar">
              <img :src="avatarUrl" alt="用户头像" @error="handleAvatarError" />
            </div>

            <div class="dashboard-user__meta">
              <strong>{{ sidebarDisplayName }}</strong>
              <span>{{ userStore.username || '-' }}</span>
            </div>
          </div>

          <div v-if="!isGuest" class="dashboard-user__identity">
            <span>身份信息</span>
            <strong>{{ roleLabel }}</strong>
          </div>

          <div v-if="!isGuest" class="dashboard-user__actions">
            <el-button class="dashboard-user__action" round @click="handleProfileEdit">
              修改信息
            </el-button>
            <el-button class="dashboard-user__logout" round @click="handleLogout">
              退出登录
            </el-button>
          </div>

          <div v-else class="dashboard-guest">
            <strong>游客模式</strong>
            <span>可查看数据大屏和导游地图</span>
            <el-button type="primary" round @click="handleLogin">去登录</el-button>
          </div>
        </div>

        <div class="dashboard-sidebar__brand">
          <p class="dashboard-sidebar__eyebrow">Wanlv Console</p>
          <h1 class="dashboard-sidebar__title">菜单栏</h1>
        </div>

        <el-menu :default-active="activeMenu" class="dashboard-menu" @select="handleMenuSelect">
          <template v-for="item in menuItems" :key="item.key">
            <el-sub-menu v-if="item.children?.length" :index="item.key">
              <template #title>
                <span class="dashboard-menu__label">{{ item.label }}</span>
              </template>

              <el-menu-item v-for="child in item.children" :key="child.key" :index="child.key"
                class="dashboard-menu__item dashboard-menu__item--child">
                <span class="dashboard-menu__label">{{ child.label }}</span>
              </el-menu-item>
            </el-sub-menu>

            <el-menu-item v-else :index="item.key" class="dashboard-menu__item">
              <span class="dashboard-menu__label">{{ item.label }}</span>
            </el-menu-item>
          </template>
        </el-menu>
      </aside>

      <transition name="dashboard-sidebar-mask">
        <button v-if="!isDashboardScreenActive && isCompactSidebar && isSidebarOpen" type="button"
          class="dashboard-sidebar__mask" aria-label="关闭菜单" @click="closeSidebar" />
      </transition>

      <div class="dashboard-content">
        <header v-if="!isDashboardScreenActive" class="dashboard-content__header">
          <div class="dashboard-content__header-main">
            <button v-if="isCompactSidebar" type="button" class="dashboard-content__menu-toggle"
              :aria-expanded="isSidebarOpen" :aria-label="isSidebarOpen ? '关闭菜单' : '打开菜单'" @click="toggleSidebar">
              <span />
              <span />
              <span />
            </button>

            <div>
              <p class="dashboard-content__eyebrow">当前模块</p>
              <h2 class="dashboard-content__title">{{ currentMenuLabel }}</h2>
            </div>
          </div>
        </header>

        <div class="dashboard-content__body" :class="{
          'dashboard-content__body--map': activeMenu === 'tourist-map',
          'dashboard-content__body--screen': isDashboardScreenMenu,
        }">
          <UserProfileEdit v-if="activeMenu === 'profile-edit'" />

          <Chat v-else-if="activeMenu === 'chat-page'" embedded @navigate="handleActionNavigate" />

          <TouristMap v-else-if="activeMenu === 'tourist-map'" />

          <ReservationWorkspace v-else-if="activeMenu === 'reservation-workspace'" />

          <ReservationDashboardScreen v-else-if="activeMenu === 'reservation-dashboard-screen'"
            @navigate="handleActionNavigate" />

          <UserReservationDashboardScreen v-else-if="activeMenu === 'user-reservation-dashboard-screen'"
            @navigate="handleActionNavigate" />

          <DailyReport v-else-if="activeMenu === 'daily-report'" />

          <AdminCreate v-else-if="activeMenu === 'admin-create-page'" embedded @navigate="handleActionNavigate" />

          <MapWorkspace v-else-if="activeMenu === 'map-workspace'" />

          <AdminUserDetail v-else-if="activeMenu === 'user-admin-detail'" />

          <NormalUserDetail v-else-if="activeMenu === 'user-normal-detail'" />

          <AdminUserList v-else-if="activeMenu === 'user-admin-list'" />

          <NormalUserList v-else-if="activeMenu === 'user-normal-list'" />

        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard-workspace {
  height: 100vh;
  overflow: hidden;
}

.dashboard-workspace__frame {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 24px;
  position: relative;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
}

.dashboard-workspace__frame--screen {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.dashboard-sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 22px;
  border-radius: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 118, 110, 0.94));
  color: #f8fafc;
  overflow: hidden;
}

.dashboard-user {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.dashboard-user__top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-user__avatar {
  width: 56px;
  height: 56px;
  overflow: hidden;
  flex: 0 0 56px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.dashboard-user__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dashboard-user__meta {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.dashboard-user__meta strong {
  color: #ffffff;
  font-size: 16px;
  line-height: 1.3;
  word-break: break-word;
}

.dashboard-user__meta span {
  color: rgba(226, 232, 240, 0.82);
  font-size: 13px;
  word-break: break-word;
}

.dashboard-user__identity {
  display: grid;
  gap: 4px;
}

.dashboard-user__identity span {
  color: rgba(226, 232, 240, 0.72);
  font-size: 12px;
}

.dashboard-user__identity strong {
  color: #ffffff;
  font-size: 14px;
}

.dashboard-user__actions {
  display: grid;
  gap: 10px;
}

.dashboard-user__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.dashboard-guest {
  display: grid;
  gap: 10px;
}

.dashboard-guest strong {
  color: #ffffff;
  font-size: 18px;
}

.dashboard-guest span {
  color: rgba(226, 232, 240, 0.78);
  font-size: 13px;
  line-height: 1.5;
}

.dashboard-user__action,
.dashboard-user__logout {
  width: 100%;
}

.dashboard-sidebar__brand {
  padding-bottom: 8px;
}

.dashboard-sidebar__eyebrow {
  margin: 0 0 8px;
  color: rgba(226, 232, 240, 0.84);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.dashboard-sidebar__title {
  margin: 0;
  font-size: 32px;
  line-height: 1.1;
}

.dashboard-menu {
  flex: 1;
  min-height: 0;
  padding-right: 6px;
  border-right: 0;
  background: transparent;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(226, 232, 240, 0.58) rgba(255, 255, 255, 0.08);
}

.dashboard-menu::-webkit-scrollbar {
  width: 8px;
}

.dashboard-menu::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.dashboard-menu::-webkit-scrollbar-thumb {
  min-height: 56px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.82), rgba(148, 163, 184, 0.62)) border-box;
  background-clip: padding-box;
}

.dashboard-menu::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(203, 213, 225, 0.78)) border-box;
  background-clip: padding-box;
}

.dashboard-menu :deep(.el-menu-item),
.dashboard-menu :deep(.el-sub-menu__title) {
  min-height: 52px;
  margin-bottom: 8px;
  border-radius: 16px;
  color: rgba(248, 250, 252, 0.88);
}

.dashboard-menu :deep(.el-menu-item:hover),
.dashboard-menu :deep(.el-sub-menu__title:hover) {
  background: rgba(255, 255, 255, 0.1);
}

.dashboard-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.22), rgba(255, 255, 255, 0.16));
  color: #ffffff;
}

.dashboard-menu :deep(.el-sub-menu .el-menu) {
  background: transparent;
}

.dashboard-menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title) {
  background: rgba(255, 255, 255, 0.08);
}

.dashboard-menu__item--child {
  margin-left: 8px;
}

.dashboard-menu__label {
  font-size: 15px;
  font-weight: 700;
}

.dashboard-sidebar__mask {
  position: absolute;
  inset: 0;
  z-index: 15;
  border: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
  cursor: pointer;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 20px;
  overflow: hidden;
}

.dashboard-workspace__frame--screen .dashboard-content {
  gap: 0;
}

.dashboard-content__header {
  flex: 0 0 auto;
  padding: 8px 6px 0;
}

.dashboard-content__header-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.dashboard-content__menu-toggle {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  cursor: pointer;
}

.dashboard-content__menu-toggle span {
  display: block;
  width: 18px;
  height: 2px;
  margin: 0 auto;
  border-radius: 999px;
  background: #0f172a;
}

.dashboard-content__eyebrow {
  margin: 0 0 8px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.dashboard-content__title {
  margin: 0;
  color: #0f172a;
  font-size: 28px;
}

.dashboard-content__body {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 20px;
  overflow: auto;
  padding: 0 6px 6px;
}

.dashboard-content__body--map {
  overflow: hidden;
}

.dashboard-content__body--screen {
  /* 数据大屏组件内部已经负责滚动，外层隐藏滚动避免出现双重滚动条。 */
  overflow: hidden;
  padding: 0;
}

.permission-card {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
}

.permission-card :deep(.el-card__header) {
  border-bottom: 0;
  padding-bottom: 0;
}

.permission-card__header {
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.permission-card__tips {
  margin-top: 20px;
}

.dashboard-sidebar-mask-enter-active,
.dashboard-sidebar-mask-leave-active {
  transition: opacity 0.24s ease;
}

.dashboard-sidebar-mask-enter-from,
.dashboard-sidebar-mask-leave-to {
  opacity: 0;
}

@media (max-width: 1180px) {
  .dashboard-workspace__frame {
    grid-template-columns: 1fr;
  }

  .dashboard-workspace__frame--compact {
    gap: 16px;
  }

  .dashboard-sidebar--compact {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 20;
    width: min(320px, calc(100vw - 48px));
    max-width: calc(100vw - 48px);
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);
    transform: translateX(calc(-100% - 24px));
    transition: transform 0.28s ease;
  }

  .dashboard-sidebar--compact.dashboard-sidebar--open {
    transform: translateX(0);
  }
}

@media (max-width: 768px) {
  .dashboard-workspace {
    height: 100vh;
  }

  .dashboard-workspace__frame {
    padding: 0;
  }

  .dashboard-sidebar {
    padding: 18px;
  }

  .dashboard-sidebar--compact {
    top: 0;
    left: 0;
    bottom: 0;
    width: min(320px, calc(100vw - 32px));
    max-width: calc(100vw - 32px);
    transform: translateX(calc(-100% - 16px));
  }

  .dashboard-content__header {
    padding-top: 0;
  }
}
</style>
