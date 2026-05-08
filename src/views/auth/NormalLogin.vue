<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AuthShell from '@/components/auth/AuthShell.vue'
import { normalLoginApi } from '@/api/user'
import { pinia, useUserStore } from '@/stores'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore(pinia)
const loading = ref(false)
const formRef = ref()
const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入普通用户账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

function enterGuestView(view) {
  router.push({
    path: '/dashboard',
    query: { view },
  })
}

async function handleSubmit() {
  await formRef.value.validate()
  loading.value = true

  try {
    const userInfo = await normalLoginApi(form)
    userStore.setLogin(userInfo)
    ElMessage.success(`欢迎回来，${userInfo.displayName || userInfo.username}`)

    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.replace(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    eyebrow="Normal User"
    title="普通用户登录"
    description="连接当前后端已完成的普通用户登录接口，登录成功后会把用户信息缓存到 Pinia 和本地存储中。"
    panel-title="欢迎回来"
    panel-description="输入普通用户账号和密码，进入万旅用户中心。"
    :highlights="[
      { title: '接口联调', description: '按响应体 code = 200 判断成功，失败直接提示后端 msg。' },
      { title: '状态持久化', description: '登录后的 userInfo 和 isLogin 会自动持久化到 localStorage。' },
      { title: '简洁直连', description: '当前后端无 token，页面不依赖 Authorization 请求头。' },
    ]"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="普通用户账号" prop="username">
        <el-input v-model.trim="form.username" placeholder="请输入账号" size="large" clearable />
      </el-form-item>

      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
          placeholder="请输入密码"
          size="large"
          show-password
          clearable
        />
      </el-form-item>

      <el-button
        type="primary"
        size="large"
        class="auth-action"
        :loading="loading"
        @click="handleSubmit"
      >
        登录
      </el-button>
    </el-form>

    <div class="auth-links">
      <router-link to="/normal/register">还没有账号？去注册</router-link>
      <router-link to="/admin/login">管理员入口</router-link>
    </div>

    <div class="guest-entry">
      <el-button plain size="large" @click="enterGuestView('user-reservation-dashboard-screen')">
        游客查看数据大屏
      </el-button>
      <el-button plain size="large" @click="enterGuestView('tourist-map')">
        游客查看导游地图
      </el-button>
    </div>
  </AuthShell>
</template>

<style scoped>
.auth-action {
  width: 100%;
  margin-top: 10px;
}

.auth-links {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
  color: #0f766e;
  font-size: 14px;
  font-weight: 600;
}

.guest-entry {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.guest-entry :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 520px) {
  .guest-entry {
    grid-template-columns: 1fr;
  }
}
</style>
