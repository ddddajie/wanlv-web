<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { pinia, useUserStore } from '@/stores'
import { targetBaseUrl } from '@/utils/request'
import AdminCreate from '@/views/user/AdminCreate.vue'
import AdminUserDetail from '@/views/user/AdminUserDetail.vue'
import AdminUserList from '@/views/user/AdminUserList.vue'
import Chat from '@/views/chat/Chat-2.0.vue'
import DashboardOverview from '@/views/overview/DashboardOverview.vue'
import DailyReport from '@/views/report/DailyReport.vue'
import NormalUserDetail from '@/views/user/NormalUserDetail.vue'
import NormalUserList from '@/views/user/NormalUserList.vue'
import UserProfileEdit from '@/views/user/UserProfileEdit.vue'

const MapWorkspace = defineAsyncComponent(() => import('@/views/map/MapWorkspace.vue'))
const TouristMap = defineAsyncComponent(() => import('@/views/map/TouristMap.vue'))
const ReservationWorkspace = defineAsyncComponent(() => import('@/views/reservation/ReservationWorkspace.vue'))

const DEFAULT_AVATAR = '/default-avatar.svg'
const MOBILE_BREAKPOINT = 1180

const router = useRouter()
const userStore = useUserStore(pinia)

const activeMenu = ref('overview')
const avatarLoadFailed = ref(false)
const isCompactSidebar = ref(false)
const isSidebarOpen = ref(false)

const canUseAnalysis = computed(() => userStore.isSuperAdmin)
const canUseUserManagement = computed(() => userStore.isAdmin)
const canUseChat = computed(() => !userStore.isAdmin)
const isAdminUser = computed(() => userStore.isAdmin)

const roleLabel = computed(() => {
  if (userStore.isSuperAdmin) return '超级管理员'
  if (userStore.isAdmin) return '管理员'
  return '普通用户'
})

const avatarUrl = computed(() => {
  if (avatarLoadFailed.value) return DEFAULT_AVATAR
  return userStore.userInfo?.avatarUrl || DEFAULT_AVATAR
})

const heroTitle = computed(() => {
  if (userStore.isSuperAdmin) return '统一工作台'
  if (userStore.isAdmin) return '管理工作台'
  return '用户工作台'
})

const heroDescription = computed(() => {
  if (userStore.isSuperAdmin) {
    return '这里集成了概览、个人信息、聊天、日报、新增管理员和用户管理能力，便于你在一个控制台中完成主要业务操作。'
  }

  if (userStore.isAdmin) {
    return '当前账号可以在同一工作台中切换聊天、个人信息和用户管理模块，查询管理员与普通用户数据。'
  }

  return '普通用户可以在这里维护个人资料、查看概览信息，并继续使用聊天功能。'
})

const heroAlert = computed(() => {
  if (userStore.isSuperAdmin) {
    return {
      title: '当前账号拥有完整后台权限',
      type: 'success',
      description: '你可以直接使用聊天、日报管理、新增管理员和用户管理等全部能力。',
    }
  }

  if (userStore.isAdmin) {
    return {
      title: '当前账号为管理员模式',
      type: 'warning',
      description: '你可以维护个人信息并查询用户数据，超管专属能力会自动按权限隐藏。',
    }
  }

  return {
    title: '当前账号为普通用户模式',
    type: 'info',
    description: '当前工作台已保留概览、个人信息和聊天功能，管理能力不会对普通用户开放。',
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
      title: '维护个人信息',
      description: '在工作台内直接修改头像、昵称、联系方式等资料。',
      actionText: '打开修改信息',
      actionKey: 'profile-edit',
    },
    {
      title: '景区导游地图',
      description: '面向游客端展示景区、景点、路线和地图说明，手机端优先适配。',
      actionText: '打开导游地图',
      actionKey: 'tourist-map',
    },
  ]

  if (canUseChat.value) {
    cards.splice(1, 0, {
      title: '进入智能问答',
      description: '在工作台内直接打开聊天页面。',
      actionText: '打开聊天',
      actionKey: 'chat-page',
    })
  }

  if (canUseUserManagement.value) {
    cards.push({
      title: '查看用户管理',
      description: '支持管理员详情、普通用户详情和两类分页列表查询。',
      actionText: '打开用户管理',
      actionKey: 'user-admin-list',
    })

    cards.push({
      title: '景区地图联调',
      description: '进入景区、景点、路线和地图初始化的一体化业务控制台。',
      actionText: '打开景区管理',
      actionKey: 'map-workspace',
    })
  }

  if (canUseAnalysis.value) {
    cards.push({
      title: '打开日报管理',
      description: '在同一页面里完成日报生成和结果查看。',
      actionText: '打开日报管理',
      actionKey: 'daily-report',
    })
  }

  if (userStore.isSuperAdmin) {
    cards.push({
      title: '新增管理员',
      description: '在工作台内直接打开管理员创建页面。',
      actionText: '打开新增管理员',
      actionKey: 'admin-create-page',
    })
  }

  return cards
})

const capabilityList = computed(() => {
  if (userStore.isSuperAdmin) {
    return [
      '左侧菜单支持切换概览、修改信息、聊天、日报、新增管理员和用户管理。',
      '用户管理下提供管理员详情、普通用户详情、管理员分页和普通用户分页查询。',
      '左上角用户区域可以直接进入修改信息，不需要跳转新页面。',
    ]
  }

  if (userStore.isAdmin) {
    return [
      '可以维护当前账号资料，并实时同步头像和昵称。',
      '可以查询管理员与普通用户详情，并查看分页列表。',
      '可以进入景区地图业务控制台，联调景区、景点、路线、空间要素和交互日志。',
      '超管专属能力会根据权限自动隐藏。',
    ]
  }

  return [
    '可以修改当前账号资料。',
    '可以继续使用聊天功能。',
    '用户管理和超管能力不会对普通用户开放。',
  ]
})

const apiNotes = computed(() => [
  `当前服务地址：${targetBaseUrl}`,
  '聊天接口：/agent/chat',
  '用户管理接口前缀：/user',
])

const menuItems = computed(() => {
  const items = [
    { key: 'overview', label: '概览' },
  ]

  if (canUseChat.value) {
    items.push({ key: 'chat-page', label: '智能问答' })
  }

  if (canUseAnalysis.value) {
    items.push({ key: 'daily-report', label: '日报管理' })
    items.push({ key: 'admin-create-page', label: '新增管理员' })
  }

  if (canUseUserManagement.value) {
    items.push({
      key: 'scenic-management',
      label: '景区管理',
      children: [{ key: 'map-workspace', label: '地图业务控制台' }],
    })

    items.push({
      key: 'user-management',
      label: '用户管理',
      children: [
        { key: 'user-admin-detail', label: '管理员详情查询' },
        { key: 'user-normal-detail', label: '普通用户详情查询' },
        { key: 'user-admin-list', label: '管理员分页列表' },
        { key: 'user-normal-list', label: '普通用户分页列表' },
      ],
    })
  } else {
    items.push({ key: 'permission', label: '权限说明' })
  }

  items.splice(2, 0, { key: 'tourist-map', label: '导游地图' })
  items.splice(3, 0, { key: 'reservation-workspace', label: userStore.isAdmin ? '预约管理' : '景点预约' })

  return items
})

const extraViewItems = [{ key: 'profile-edit', label: '修改信息' }]

const flatMenuItems = computed(() =>
  [...menuItems.value, ...extraViewItems].flatMap((item) => (item.children?.length ? item.children : [item])),
)

const currentMenuLabel = computed(() => {
  return flatMenuItems.value.find((item) => item.key === activeMenu.value)?.label || '概览'
})

watch(
  menuItems,
  (items) => {
    const availableKeys = [...items, ...extraViewItems].flatMap((item) =>
      item.children?.length ? item.children : [item],
    )
    if (!availableKeys.some((item) => item.key === activeMenu.value)) {
      activeMenu.value = availableKeys[0]?.key || 'overview'
    }
  },
  { immediate: true },
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
  activeMenu.value = 'profile-edit'
  if (isCompactSidebar.value) {
    isSidebarOpen.value = false
  }
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
    <section class="dashboard-workspace__frame glass-card"
      :class="{ 'dashboard-workspace__frame--compact': isCompactSidebar }">
      <aside class="dashboard-sidebar" :class="{
        'dashboard-sidebar--compact': isCompactSidebar,
        'dashboard-sidebar--open': isCompactSidebar && isSidebarOpen,
      }">
        <div class="dashboard-user">
          <div class="dashboard-user__top">
            <div class="dashboard-user__avatar">
              <img :src="avatarUrl" alt="用户头像" @error="handleAvatarError" />
            </div>

            <div class="dashboard-user__meta">
              <strong>{{ userStore.displayName || userStore.username || '未登录用户' }}</strong>
              <span>{{ userStore.username || '-' }}</span>
            </div>
          </div>

          <div class="dashboard-user__identity">
            <span>身份信息</span>
            <strong>{{ roleLabel }}</strong>
          </div>

          <div class="dashboard-user__actions">
            <el-button class="dashboard-user__action" round @click="handleProfileEdit">
              修改信息
            </el-button>
            <el-button class="dashboard-user__logout" round @click="handleLogout">
              退出登录
            </el-button>
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
        <button v-if="isCompactSidebar && isSidebarOpen" type="button" class="dashboard-sidebar__mask" aria-label="关闭菜单"
          @click="closeSidebar" />
      </transition>

      <div class="dashboard-content">
        <header class="dashboard-content__header">
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

        <div class="dashboard-content__body" :class="{ 'dashboard-content__body--map': activeMenu === 'tourist-map' }">
          <DashboardOverview v-if="activeMenu === 'overview'" :target-base-url="targetBaseUrl"
            :username="userStore.username" :display-name="userStore.displayName" :role-label="roleLabel"
            :hero-title="heroTitle" :hero-description="heroDescription" :hero-alert="heroAlert"
            :can-use-analysis="canUseAnalysis" :user-summary="userSummary" :action-cards="actionCards"
            :capability-list="capabilityList" :api-notes="apiNotes" @navigate="handleActionNavigate" />

          <UserProfileEdit v-else-if="activeMenu === 'profile-edit'" />

          <Chat v-else-if="activeMenu === 'chat-page'" embedded @navigate="handleActionNavigate" />

          <TouristMap v-else-if="activeMenu === 'tourist-map'" />

          <ReservationWorkspace v-else-if="activeMenu === 'reservation-workspace'" />

          <DailyReport v-else-if="activeMenu === 'daily-report'" />

          <AdminCreate v-else-if="activeMenu === 'admin-create-page'" embedded @navigate="handleActionNavigate" />

          <MapWorkspace v-else-if="activeMenu === 'map-workspace'" />

          <AdminUserDetail v-else-if="activeMenu === 'user-admin-detail'" />

          <NormalUserDetail v-else-if="activeMenu === 'user-normal-detail'" />

          <AdminUserList v-else-if="activeMenu === 'user-admin-list'" />

          <NormalUserList v-else-if="activeMenu === 'user-normal-list'" />

          <el-card v-else shadow="never" class="permission-card">
            <template #header>
              <div class="permission-card__header">
                <span>权限说明</span>
              </div>
            </template>

            <el-empty description="当前账号不是管理员，因此用户管理、日报管理和新增管理员等能力不会开放。你仍然可以继续使用概览、修改信息和聊天功能。" :image-size="96" />

            <div v-if="isAdminUser" class="permission-card__tips">
              <el-alert title="管理员账号已具备用户管理能力" description="如果菜单没有显示，请重新登录或刷新当前页面同步权限状态。" type="info" :closable="false"
                show-icon />
            </div>
          </el-card>
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

.dashboard-sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 22px;
  border-radius: 24px;
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
