import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import AdminLayout from '@/layout/AdminLayout.vue'
import { pinia, useUserStore } from '@/stores'

const routes = [
  {
    path: '/normal/login',
    name: 'NormalLogin',
    component: () => import('@/views/auth/NormalLogin.vue'),
    meta: { title: '普通用户登录', public: true },
  },
  {
    path: '/normal/register',
    name: 'NormalRegister',
    component: () => import('@/views/auth/NormalRegister.vue'),
    meta: { title: '普通用户注册', public: true },
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('@/views/auth/AdminLogin.vue'),
    meta: { title: '管理员登录', public: true },
  },
  {
    path: '/',
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/home/Dashboard.vue'),
        meta: { title: '控制台', requiresAuth: true },
      },
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/chat/Chat.vue'),
        meta: { title: '智能问答', requiresAuth: true },
      },
      {
        path: 'admin/create',
        name: 'AdminCreate',
        component: () => import('@/views/admin/AdminCreate.vue'),
        meta: {
          title: '新增管理员',
          requiresAuth: true,
          superAdminOnly: true,
          loginType: 'admin',
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore(pinia)
  const isPublic = to.matched.some((record) => record.meta?.public)
  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth)
  const superAdminOnly = to.matched.some((record) => record.meta?.superAdminOnly)
  const loginType = to.matched.find((record) => record.meta?.loginType)?.meta?.loginType

  if (isPublic) {
    if (userStore.isLoggedIn) {
      next('/dashboard')
      return
    }

    next()
    return
  }

  if (requiresAuth && !userStore.isLoggedIn) {
    next({
      path: loginType === 'admin' ? '/admin/login' : '/normal/login',
      query: { redirect: to.fullPath },
    })
    return
  }

  if (superAdminOnly && !userStore.isSuperAdmin) {
    ElMessage.error('只有超级管理员才能新增管理员')
    next('/dashboard')
    return
  }

  next()
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} - 万旅用户中心` : '万旅用户中心'
})

export default router
