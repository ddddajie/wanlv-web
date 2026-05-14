<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pinia, useUserStore } from '@/stores'
import { dialog } from '@/utils/feedback'
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

const menuOptions = computed(() =>
  menuItems.value.map((item) => ({
    label: item.label,
    key: item.key,
    children: item.children?.map((child) => ({
      label: child.label,
      key: child.key,
    })),
  })),
)

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
    await dialog.confirm('退出后需要重新登录，是否继续？', '退出登录', {
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
      <aside v-if="!isDashboardScreenActive" class="dashboard-sidebar border-r border-slate-300 bg-slate-50" :class="{
        'dashboard-sidebar--compact': isCompactSidebar,
        'dashboard-sidebar--open': isCompactSidebar && isSidebarOpen,
      }">
        <div class="dashboard-user rounded-md bg-white">
          <div v-if="!isGuest" class="dashboard-user__top">
            <n-avatar class="dashboard-user__avatar" round :size="36">
              <img :src="avatarUrl" alt="用户头像" @error="handleAvatarError" />
            </n-avatar>

            <div class="dashboard-user__meta">
              <strong>{{ sidebarDisplayName }}</strong>
              <span>{{ userStore.username || '-' }}</span>
            </div>
          </div>

          <div v-if="!isGuest" class="dashboard-user__identity">
            <span>当前身份</span>
            <strong>{{ roleLabel }}</strong>
          </div>

          <div v-if="!isGuest" class="dashboard-user__actions">
            <n-button class="dashboard-user__action" size="small" quaternary @click="handleProfileEdit">
              修改信息
            </n-button>
            <n-button class="dashboard-user__logout" size="small" quaternary @click="handleLogout">
              退出登录
            </n-button>
          </div>

          <div v-else class="dashboard-guest">
            <strong>游客模式</strong>
            <span>可查看数据大屏和导游地图</span>
            <n-button type="primary" size="small" @click="handleLogin">去登录</n-button>
          </div>
        </div>

        <div class="dashboard-sidebar__brand">
          <span class="dashboard-sidebar__title">菜单栏</span>
        </div>

        <n-menu
          v-model:value="activeMenu"
          class="dashboard-menu"
          :options="menuOptions"
          :indent="12"
          :collapsed-width="64"
          @update:value="handleMenuSelect"
        />
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
  grid-template-columns: 208px minmax(0, 1fr);
  gap: 0;
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
  gap: 12px;
  min-height: 0;
  padding: 16px 12px;
  border-radius: 0;
  background: #f8fafc;
  color: #0f172a;
  box-shadow: 8px 0 20px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.dashboard-user {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e2e8f0;
}

.dashboard-user__top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard-user__avatar {
  flex: 0 0 36px;
  background: #e2e8f0;
}

.dashboard-user__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dashboard-user__meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.dashboard-user__meta strong {
  color: #0f172a;
  font-size: 13px;
  line-height: 1.3;
  word-break: break-word;
}

.dashboard-user__meta span {
  color: #64748b;
  font-size: 11px;
  word-break: break-word;
}

.dashboard-user__identity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dashboard-user__identity span {
  color: #64748b;
  font-size: 11px;
}

.dashboard-user__identity strong {
  color: #0f766e;
  font-size: 11px;
  font-weight: 700;
}

.dashboard-user__actions {
  display: flex;
  gap: 6px;
}

.dashboard-guest {
  display: grid;
  gap: 10px;
}

.dashboard-guest strong {
  color: #0f172a;
  font-size: 13px;
}

.dashboard-guest span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.5;
}

.dashboard-user__action,
.dashboard-user__logout {
  flex: 1;
}

.dashboard-user__actions :deep(.n-button) {
  --n-font-size: 12px;
  --n-height: 28px;
}

.dashboard-sidebar__brand {
  padding: 4px 6px 0;
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
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.dashboard-menu {
  flex: 1;
  min-height: 0;
  padding-right: 0;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.42) transparent;
}

.dashboard-menu::-webkit-scrollbar {
  width: 8px;
}

.dashboard-menu::-webkit-scrollbar-track {
  border-radius: 999px;
  background: transparent;
}

.dashboard-menu::-webkit-scrollbar-thumb {
  min-height: 56px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.48) border-box;
  background-clip: padding-box;
}

.dashboard-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.58) border-box;
  background-clip: padding-box;
}

/* 侧边栏菜单对齐参考图：更窄、更紧凑，选中态只用淡蓝色提示。 */
.dashboard-menu :deep(.n-menu-item-content),
.dashboard-menu :deep(.n-menu-item-content-header),
.dashboard-menu :deep(.n-menu-item-content__arrow) {
  color: #0f172a;
  font-size: 13px;
  font-weight: 500;
}

.dashboard-menu :deep(.n-menu-item-content) {
  min-height: 34px;
  margin: 1px 0;
  border-radius: 4px;
  padding-right: 8px;
  font-size: 13px;
}

.dashboard-menu :deep(.n-menu-item-content::before) {
  border-radius: 4px;
}

.dashboard-menu :deep(.n-menu-item-content:hover::before) {
  background: #f1f5f9;
}

.dashboard-menu :deep(.n-menu-item-content--selected::before) {
  background: #e8f3ff;
}

.dashboard-menu :deep(.n-menu-item-content--selected .n-menu-item-content-header) {
  color: #1677ff;
  font-weight: 600;
}

.dashboard-menu :deep(.n-submenu .n-menu-item-content-header) {
  font-size: 12px;
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
  gap: 10px;
  padding-left: 14px;
  overflow: hidden;
}

.dashboard-workspace__frame--screen .dashboard-content {
  gap: 0;
  padding-left: 0;
}

.dashboard-content__header {
  flex: 0 0 auto;
  padding: 4px 6px 0;
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
  margin: 0 0 4px;
  color: #0f766e;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.dashboard-content__title {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.15;
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
    width: min(280px, calc(100vw - 48px));
    max-width: calc(100vw - 48px);
    background: #f8fafc;
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
    width: min(280px, calc(100vw - 32px));
    max-width: calc(100vw - 32px);
    transform: translateX(calc(-100% - 16px));
  }

  .dashboard-content__header {
    padding-top: 0;
  }
}
</style>
