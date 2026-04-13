<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AuthShell from '@/components/auth/AuthShell.vue'
import { adminLoginApi, initSuperAdminApi } from '@/api/user'
import { pinia, useUserStore } from '@/stores'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore(pinia)
const loading = ref(false)
const initLoading = ref(false)
const formRef = ref()
const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleSubmit() {
  await formRef.value.validate()
  loading.value = true

  try {
    const userInfo = await adminLoginApi(form)
    userStore.setLogin(userInfo)
    ElMessage.success(`管理员登录成功，欢迎 ${userInfo.displayName || userInfo.username}`)

    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.replace(redirect)
  } finally {
    loading.value = false
  }
}

async function handleInitAdmin() {
  initLoading.value = true

  try {
    const message = await initSuperAdminApi()
    ElMessage.success(message || '超级管理员初始化成功')
  } finally {
    initLoading.value = false
  }
}

function fillDefaultAccount() {
  form.username = 'admin'
  form.password = '123456'
}
</script>

<template>
  <AuthShell
    eyebrow="Admin Access"
    title="管理员登录"
    description="对接管理员登录接口，并在开发联调阶段提供超级管理员初始化入口。新增管理员页面只对 super_admin 开放。"
    panel-title="进入管理端"
    panel-description="管理员登录成功后会根据返回的 role 决定是否显示新增管理员入口。"
    :highlights="[
      { title: '角色区分', description: '系统会识别 super_admin 和 admin，并在首页做不同入口控制。' },
      { title: '开发辅助', description: '提供超级管理员初始化按钮，便于本地数据库尚未准备好时快速联调。' },
      { title: '权限限制', description: '新增管理员页面只有超级管理员能进入和提交。' },
    ]"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="管理员账号" prop="username">
        <el-input v-model.trim="form.username" placeholder="请输入管理员账号" size="large" clearable />
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
        登录管理端
      </el-button>
    </el-form>

    <div class="admin-tools">
      <el-button plain :loading="initLoading" @click="handleInitAdmin">
        初始化超级管理员
      </el-button>
      <el-button plain @click="fillDefaultAccount">
        填充默认 admin / 123456
      </el-button>
    </div>

    <div class="auth-links">
      <router-link to="/normal/login">切换到普通用户登录</router-link>
      <router-link to="/normal/register">普通用户注册</router-link>
    </div>
  </AuthShell>
</template>

<style scoped>
.auth-action {
  width: 100%;
  margin-top: 10px;
}

.admin-tools {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
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
</style>
