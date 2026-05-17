<script setup>
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import {
  normalLoginApi,
  normalPhoneCodeLoginApi,
  sendNormalUserPhoneCodeApi,
} from '@/api/user'
import { pinia, useUserStore } from '@/stores'
import { message } from '@/utils/feedback'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore(pinia)
const loading = ref(false)
const sendingCode = ref(false)
const activeTab = ref('phone')
const phoneFormRef = ref()
const passwordFormRef = ref()
const countdown = ref(0)
const devCode = ref('')
let countdownTimer = null

const phoneForm = reactive({
  phone: '',
  code: '',
})

const passwordForm = reactive({
  username: '',
  password: '',
})

const phonePattern = /^1[3-9]\d{9}$/

const phoneRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: phonePattern, message: '手机号格式不正确', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
}

const passwordRules = {
  username: [{ required: true, message: '请输入普通用户账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

function enterGuestView(view) {
  router.push({
    path: '/dashboard',
    query: { view },
  })
}

function getLoginRedirect() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  if (!redirect) return '/dashboard?view=user-index'

  const redirectUrl = new URL(redirect, window.location.origin)
  const redirectView = redirectUrl.searchParams.get('view')
  if (redirectUrl.pathname === '/dashboard' && (!redirectView || redirectView === 'user-reservation-dashboard-screen')) {
    return '/dashboard?view=user-index'
  }

  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
}

function startCountdown(seconds) {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
  }

  countdown.value = Number(seconds) || 300
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1

    if (countdown.value <= 0 && countdownTimer) {
      window.clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function sendCode() {
  if (!phonePattern.test(phoneForm.phone)) {
    message.warning('请输入正确的手机号')
    return
  }

  sendingCode.value = true

  try {
    const result = await sendNormalUserPhoneCodeApi({ phone: phoneForm.phone })

    // 后端当前是模拟短信阶段，会返回验证码；这里自动填入方便本地联调。
    if (result?.code) {
      devCode.value = result.code
      phoneForm.code = result.code
    } else {
      devCode.value = ''
    }

    startCountdown(result?.expireSeconds)
    message.success('验证码已发送')
  } finally {
    sendingCode.value = false
  }
}

async function handlePhoneSubmit() {
  await phoneFormRef.value.validate()
  loading.value = true

  try {
    const userInfo = await normalPhoneCodeLoginApi({
      phone: phoneForm.phone,
      code: phoneForm.code,
    })

    userStore.setLogin(userInfo)
    message.success(`欢迎回来，${userInfo.displayName || userInfo.username}`)

    router.replace(getLoginRedirect())
  } finally {
    loading.value = false
  }
}

async function handlePasswordSubmit() {
  await passwordFormRef.value.validate()
  loading.value = true

  try {
    const userInfo = await normalLoginApi(passwordForm)
    userStore.setLogin(userInfo)
    message.success(`欢迎回来，${userInfo.displayName || userInfo.username}`)

    router.replace(getLoginRedirect())
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
  }
})
</script>

<template>
  <AuthShell eyebrow="Normal User" title="普通用户登录" description="普通用户默认使用手机号验证码登录；未注册手机号会由后端自动创建账号，登录成功后缓存用户信息和 JWT。"
    panel-title="欢迎回来" panel-description="输入手机号获取验证码进行登录，未注册的账号会自动注册。" :highlights="[
      { title: '验证码登录', description: '调用 /user/normal/code/send 和 /user/normal/code/login。' },
      { title: '自动注册', description: '新手机号首次验证码登录时由后端创建普通用户。' },
      { title: 'JWT 鉴权', description: '登录后的 token 会随用户信息持久化，后续请求自动携带。' },
    ]">
    <template #hero-actions>
      <div class="guest-entry">
        <n-button secondary size="large" @click="enterGuestView('user-reservation-dashboard-screen')">
          游客查看数据大屏
        </n-button>
        <n-button secondary size="large" @click="enterGuestView('tourist-map')">
          游客查看导游地图
        </n-button>
      </div>
    </template>

    <n-tabs v-model:value="activeTab" class="login-tabs" animated>
      <n-tab-pane tab="手机号验证码" name="phone">
        <n-form ref="phoneFormRef" :model="phoneForm" :rules="phoneRules" label-placement="top"
          @submit.prevent="handlePhoneSubmit">
          <n-form-item label="手机号" path="phone">
            <n-input v-model:value="phoneForm.phone" placeholder="请输入手机号" size="large" maxlength="11" clearable />
          </n-form-item>

          <n-form-item label="验证码" path="code">
            <div class="code-row">
              <n-input v-model:value="phoneForm.code" placeholder="请输入验证码" size="large" maxlength="6" clearable />
              <n-button size="large" :disabled="countdown > 0" :loading="sendingCode" @click="sendCode">
                {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
              </n-button>
            </div>
          </n-form-item>

          <n-alert v-if="devCode" class="dev-code" type="info" :show-icon="true" :closable="false">
            开发联调验证码：{{ devCode }}
          </n-alert>

          <n-button type="primary" size="large" class="auth-action" :loading="loading" @click="handlePhoneSubmit">
            登录 / 自动注册
          </n-button>
        </n-form>
      </n-tab-pane>

      <n-tab-pane tab="账号密码" name="password">
        <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-placement="top"
          @submit.prevent="handlePasswordSubmit">
          <n-form-item label="普通用户账号" path="username">
            <n-input v-model:value="passwordForm.username" placeholder="请输入账号" size="large" clearable />
          </n-form-item>

          <n-form-item label="密码" path="password">
            <n-input v-model:value="passwordForm.password" placeholder="请输入密码" size="large" type="password" show-password-on="click" clearable />
          </n-form-item>

          <n-button type="primary" size="large" class="auth-action" :loading="loading" @click="handlePasswordSubmit">
            登录
          </n-button>
        </n-form>
      </n-tab-pane>
    </n-tabs>

    <div class="auth-links">
      <router-link to="/admin/login">管理员入口</router-link>
    </div>
  </AuthShell>
</template>

<style scoped>
.login-tabs {
  margin-top: 8px;
}

.code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 126px;
  gap: 10px;
  width: 100%;
}

.dev-code {
  margin-bottom: 4px;
}

.auth-action {
  width: 100%;
  margin-top: 10px;
}

.auth-links {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
  color: var(--wl-primary);
  font-size: 14px;
  font-weight: 600;
}

.guest-entry {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: min(430px, 100%);
  position: relative;
  z-index: 1;
}

.guest-entry :deep(.n-button) {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.14);
}

@media (max-width: 520px) {
  .code-row {
    grid-template-columns: 1fr;
  }

  .guest-entry {
    grid-template-columns: 1fr;
  }
}
</style>
