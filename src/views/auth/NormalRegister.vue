<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AuthShell from '@/components/auth/AuthShell.vue'
import { normalRegisterApi } from '@/api/user'
import { pinia, useUserStore } from '@/stores'

const router = useRouter()
const userStore = useUserStore(pinia)
const loading = ref(false)
const formRef = ref()
const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  phone: '',
  email: '',
  avatarUrl: '',
  gender: '',
  age: null,
  interestTagsText: '',
})

function validatePhone(rule, value, callback) {
  if (!value) {
    callback()
    return
  }

  if (!/^1\d{10}$/.test(value)) {
    callback(new Error('请输入正确的手机号'))
    return
  }

  callback()
}

function validateConfirmPassword(rule, value, callback) {
  if (!value) {
    callback(new Error('请再次输入密码'))
    return
  }

  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
    return
  }

  callback()
}

const rules = {
  username: [{ required: true, message: '请输入普通用户账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 位', trigger: 'blur' },
  ],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
  phone: [{ validator: validatePhone, trigger: 'blur' }],
  email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }],
}

function buildRegisterPayload() {
  const tags = form.interestTagsText
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    username: form.username,
    password: form.password,
    nickname: form.nickname || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    avatarUrl: form.avatarUrl || undefined,
    gender: form.gender === '' ? undefined : Number(form.gender),
    age: form.age === null ? undefined : Number(form.age),
    interestTags: tags.length ? JSON.stringify(tags) : undefined,
  }
}

async function handleSubmit() {
  await formRef.value.validate()
  loading.value = true

  try {
    const userInfo = await normalRegisterApi(buildRegisterPayload())
    userStore.setLogin(userInfo)
    ElMessage.success(`注册成功，欢迎你 ${userInfo.displayName || userInfo.username}`)
    router.replace('/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell eyebrow="Create Account" title="普通用户注册"
    description="注册成功后会直接按照“注册即登录”处理，把后端返回的 UserLoginVO 缓存下来，方便立即进入首页联调。" panel-title="创建你的用户账号"
    panel-description="必填项只有账号和密码，其他信息会按接口文档作为可选字段提交。" :highlights="[
      { title: '表单校验', description: '前端先校验手机号、邮箱和确认密码，减少无效请求。' },
      { title: '兴趣标签', description: '页面使用逗号分隔输入，提交时自动转成后端要求的 JSON 字符串。' },
      { title: '注册即登录', description: '成功后直接缓存当前用户信息并进入控制台。' },
    ]">
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">
      <div class="form-grid">
        <el-form-item label="普通用户账号" prop="username">
          <el-input v-model.trim="form.username" placeholder="请输入账号" size="large" clearable />
        </el-form-item>

        <el-form-item label="昵称">
          <el-input v-model.trim="form.nickname" placeholder="请输入昵称" size="large" clearable />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" placeholder="请输入密码" size="large" show-password clearable />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" placeholder="请再次输入密码" size="large" show-password clearable />
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model.trim="form.phone" placeholder="11 位手机号" size="large" clearable />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model.trim="form.email" placeholder="请输入邮箱" size="large" clearable />
        </el-form-item>

        <el-form-item label="头像地址">
          <el-input v-model.trim="form.avatarUrl" placeholder="https://example.com/avatar.png" size="large" clearable
            disabled="true" />
        </el-form-item>

        <el-form-item label="年龄">
          <el-input-number v-model="form.age" :min="0" :max="150" controls-position="right" />
        </el-form-item>

        <el-form-item label="性别">
          <el-select v-model="form.gender" placeholder="请选择" size="large" clearable>
            <el-option label="保密" value="0" />
            <el-option label="男" value="1" />
            <el-option label="女" value="2" />
          </el-select>
        </el-form-item>

        <el-form-item label="兴趣标签" class="form-grid__full">
          <el-input v-model="form.interestTagsText" placeholder="例如：摄影，徒步，美食" type="textarea" :rows="3" />
        </el-form-item>
      </div>

      <el-button type="primary" size="large" class="auth-action" :loading="loading" @click="handleSubmit">
        注册并进入系统
      </el-button>
    </el-form>

    <div class="auth-links">
      <router-link to="/normal/login">已有普通用户账号？去登录</router-link>
      <router-link to="/admin/login">管理员入口</router-link>
    </div>
  </AuthShell>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}

.form-grid__full {
  grid-column: 1 / -1;
}

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

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
