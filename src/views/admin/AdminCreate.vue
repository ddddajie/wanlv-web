<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createAdminApi } from '@/api/user'
import { pinia, useUserStore } from '@/stores'

const router = useRouter()
const userStore = useUserStore(pinia)
const loading = ref(false)
const formRef = ref()
const form = reactive({
  operatorUsername: userStore.username || '',
  operatorPassword: '',
  username: '',
  password: '',
  realName: '',
  phone: '',
  email: '',
  avatarUrl: '',
  scenicSpot: '',
  remark: '',
})

const canCreateAdmin = computed(() => userStore.isSuperAdmin)

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

const rules = {
  operatorUsername: [{ required: true, message: '请输入操作人账号', trigger: 'blur' }],
  operatorPassword: [{ required: true, message: '请输入操作人密码', trigger: 'blur' }],
  username: [{ required: true, message: '请输入新管理员账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入新管理员密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 位', trigger: 'blur' },
  ],
  phone: [{ validator: validatePhone, trigger: 'blur' }],
  email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }],
}

function buildPayload() {
  return {
    operatorUsername: form.operatorUsername,
    operatorPassword: form.operatorPassword,
    username: form.username,
    password: form.password,
    realName: form.realName || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    avatarUrl: form.avatarUrl || undefined,
    scenicSpot: form.scenicSpot || undefined,
    remark: form.remark || undefined,
  }
}

async function handleSubmit() {
  if (!canCreateAdmin.value) {
    ElMessage.error('只有超级管理员才能新增管理员')
    return
  }

  await formRef.value.validate()
  loading.value = true

  try {
    const userInfo = await createAdminApi(buildPayload())
    ElMessage.success(`管理员 ${userInfo.displayName || userInfo.username} 创建成功`)
    form.operatorPassword = ''
    form.username = ''
    form.password = ''
    form.realName = ''
    form.phone = ''
    form.email = ''
    form.avatarUrl = ''
    form.scenicSpot = ''
    form.remark = ''
    router.replace('/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-create">
    <section class="admin-create__hero glass-card">
      <div>
        <p class="admin-create__eyebrow">Super Admin Only</p>
        <h1 class="admin-create__title">新增管理员</h1>
        <p class="admin-create__desc">
          这个页面严格按照后端接口要求提交操作人账号和密码。当前前端不会缓存
          <code>operatorPassword</code>，避免明文长期保留。
        </p>
      </div>

      <el-alert
        title="只有超级管理员可以新增管理员，普通管理员即使访问路由也会被拦截。"
        type="warning"
        :closable="false"
        show-icon
      />
    </section>

    <el-card shadow="never" class="admin-create__card">
      <template #header>
        <div class="admin-create__card-head">
          <span>管理员创建表单</span>
          <el-tag :type="canCreateAdmin ? 'success' : 'danger'" effect="plain">
            {{ canCreateAdmin ? '可提交' : '无权限' }}
          </el-tag>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <div class="form-grid">
          <el-form-item label="操作人账号" prop="operatorUsername">
            <el-input
              v-model.trim="form.operatorUsername"
              :disabled="canCreateAdmin && Boolean(userStore.username)"
              placeholder="请输入超级管理员账号"
              size="large"
              clearable
            />
          </el-form-item>

          <el-form-item label="操作人密码" prop="operatorPassword">
            <el-input
              v-model="form.operatorPassword"
              placeholder="请输入当前超级管理员密码"
              size="large"
              show-password
              clearable
            />
          </el-form-item>

          <el-form-item label="新管理员账号" prop="username">
            <el-input v-model.trim="form.username" placeholder="请输入新管理员账号" size="large" clearable />
          </el-form-item>

          <el-form-item label="新管理员密码" prop="password">
            <el-input
              v-model="form.password"
              placeholder="请输入新管理员密码"
              size="large"
              show-password
              clearable
            />
          </el-form-item>

          <el-form-item label="真实姓名">
            <el-input v-model.trim="form.realName" placeholder="不填则后端默认普通管理员" size="large" clearable />
          </el-form-item>

          <el-form-item label="所属景区">
            <el-input v-model.trim="form.scenicSpot" placeholder="例如：西湖景区" size="large" clearable />
          </el-form-item>

          <el-form-item label="手机号" prop="phone">
            <el-input v-model.trim="form.phone" placeholder="11 位手机号" size="large" clearable />
          </el-form-item>

          <el-form-item label="邮箱" prop="email">
            <el-input v-model.trim="form.email" placeholder="请输入邮箱" size="large" clearable />
          </el-form-item>

          <el-form-item label="头像地址" class="form-grid__full">
            <el-input
              v-model.trim="form.avatarUrl"
              placeholder="https://example.com/avatar.png"
              size="large"
              clearable
            />
          </el-form-item>

          <el-form-item label="备注" class="form-grid__full">
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="4"
              placeholder="例如：负责票务、讲解或活动运营"
            />
          </el-form-item>
        </div>

        <div class="admin-create__actions">
          <el-button type="primary" size="large" :loading="loading" @click="handleSubmit">
            提交新增
          </el-button>
          <el-button size="large" @click="router.push('/dashboard')">返回控制台</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.admin-create {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.admin-create__hero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
  padding: 30px;
}

.admin-create__eyebrow {
  margin: 0 0 12px;
  color: #b45309;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-create__title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(28px, 4vw, 40px);
}

.admin-create__desc {
  max-width: 760px;
  margin: 14px 0 0;
  color: #475569;
}

.admin-create__card {
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
}

.admin-create__card :deep(.el-card__header) {
  border-bottom: 0;
}

.admin-create__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}

.form-grid__full {
  grid-column: 1 / -1;
}

.admin-create__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
}

code {
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
}

@media (max-width: 1024px) {
  .admin-create__hero,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
