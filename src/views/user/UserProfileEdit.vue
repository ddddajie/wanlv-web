<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { updateAdminUserApi, updateNormalUserApi } from '@/api/user'
import { pinia, useUserStore } from '@/stores'
import {
  buildDisplayName,
  formatDateTime,
  parseInterestTags,
  stringifyInterestTags,
} from './userViewUtils'

const userStore = useUserStore(pinia)
const formRef = ref()
const loading = ref(false)

const isAdminUser = computed(() => userStore.isAdmin)
const userInfo = computed(() => userStore.userInfo || {})
const displayName = computed(() => buildDisplayName(userInfo.value))

const form = reactive({
  id: '',
  username: '',
  password: '',
  realName: '',
  scenicSpot: '',
  remark: '',
  nickname: '',
  phone: '',
  email: '',
  avatarUrl: '',
  gender: null,
  age: null,
  interestTagsInput: '',
})

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  phone: [
    {
      validator(rule, value, callback) {
        if (!value || /^1\d{10}$/.test(value)) {
          callback()
          return
        }

        callback(new Error('请输入正确的手机号'))
      },
      trigger: 'blur',
    },
  ],
  email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }],
  age: [
    {
      validator(rule, value, callback) {
        if (value === null || value === '' || Number(value) >= 0) {
          callback()
          return
        }

        callback(new Error('年龄不能小于 0'))
      },
      trigger: 'change',
    },
  ],
}

function syncForm(source) {
  form.id = source?.id ?? ''
  form.username = source?.username ?? ''
  form.password = ''
  form.realName = source?.realName ?? ''
  form.scenicSpot = source?.scenicSpot ?? ''
  form.remark = source?.remark ?? ''
  form.nickname = source?.nickname ?? ''
  form.phone = source?.phone ?? ''
  form.email = source?.email ?? ''
  form.avatarUrl = source?.avatarUrl ?? ''
  form.gender = source?.gender ?? null
  form.age = source?.age ?? null
  form.interestTagsInput = parseInterestTags(source?.interestTags).join('，')
}

function optionalText(value) {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

function buildPayload() {
  if (isAdminUser.value) {
    return {
      id: Number(form.id),
      username: optionalText(form.username),
      password: optionalText(form.password),
      realName: optionalText(form.realName),
      phone: optionalText(form.phone),
      email: optionalText(form.email),
      avatarUrl: optionalText(form.avatarUrl),
      scenicSpot: optionalText(form.scenicSpot),
      remark: optionalText(form.remark),
    }
  }

  return {
    id: Number(form.id),
    username: optionalText(form.username),
    password: optionalText(form.password),
    nickname: optionalText(form.nickname),
    phone: optionalText(form.phone),
    email: optionalText(form.email),
    avatarUrl: optionalText(form.avatarUrl),
    gender: form.gender === null || form.gender === '' ? undefined : Number(form.gender),
    age: form.age === null || form.age === '' ? undefined : Number(form.age),
    interestTags: stringifyInterestTags(form.interestTagsInput),
  }
}

async function handleSubmit() {
  await formRef.value.validate()
  loading.value = true

  try {
    const payload = buildPayload()
    const updatedUser = isAdminUser.value
      ? await updateAdminUserApi(payload)
      : await updateNormalUserApi(payload)

    userStore.patchUserInfo({
      ...updatedUser,
      displayName: buildDisplayName(updatedUser),
    })

    syncForm({
      ...userStore.userInfo,
      ...updatedUser,
    })

    ElMessage.success('个人信息已更新')
  } finally {
    loading.value = false
  }
}

function handleReset() {
  syncForm(userInfo.value)
  formRef.value?.clearValidate()
}

watch(
  () => userStore.userInfo,
  (value) => {
    syncForm(value || {})
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="user-page">
    <section class="user-page__hero glass-card">
      <div>
        <p class="user-page__eyebrow">Profile Center</p>
        <h2 class="user-page__title">修改信息</h2>
        <p class="user-page__desc">
          当前表单会根据登录身份自动切换管理员或普通用户更新接口，保存成功后左侧头像、昵称和账号信息会立即同步。
        </p>
      </div>

      <div class="user-page__summary">
        <div class="user-page__summary-item">
          <span>当前用户</span>
          <strong>{{ displayName || userStore.username || '-' }}</strong>
        </div>
        <div class="user-page__summary-item">
          <span>账号类型</span>
          <strong>{{ isAdminUser ? '管理员' : '普通用户' }}</strong>
        </div>
        <div class="user-page__summary-item">
          <span>最近登录</span>
          <strong>{{ formatDateTime(userInfo.lastLoginTime) }}</strong>
        </div>
      </div>
    </section>

    <el-card shadow="never" class="user-page__card">
      <template #header>
        <div class="user-page__card-head">
          <span>{{ isAdminUser ? '管理员资料' : '普通用户资料' }}</span>
          <el-tag effect="plain" :type="isAdminUser ? 'warning' : 'success'">
            {{ isAdminUser ? 'admin update' : 'normal update' }}
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
        <div class="user-page__grid">
          <el-form-item label="用户 ID">
            <el-input :model-value="String(form.id || '')" disabled size="large" />
          </el-form-item>

          <el-form-item label="账号" prop="username">
            <el-input v-model.trim="form.username" size="large" clearable />
          </el-form-item>

          <el-form-item label="新密码">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              size="large"
              placeholder="不修改可留空"
              clearable
            />
          </el-form-item>

          <el-form-item v-if="isAdminUser" label="真实姓名">
            <el-input v-model.trim="form.realName" size="large" clearable />
          </el-form-item>

          <el-form-item v-else label="昵称">
            <el-input v-model.trim="form.nickname" size="large" clearable />
          </el-form-item>

          <el-form-item label="手机号" prop="phone">
            <el-input v-model.trim="form.phone" size="large" clearable />
          </el-form-item>

          <el-form-item label="邮箱" prop="email">
            <el-input v-model.trim="form.email" size="large" clearable />
          </el-form-item>

          <el-form-item v-if="isAdminUser" label="所属景区">
            <el-input v-model.trim="form.scenicSpot" size="large" clearable />
          </el-form-item>

          <el-form-item v-else label="性别">
            <el-select v-model="form.gender" placeholder="请选择性别" size="large" clearable>
              <el-option :value="1" label="男" />
              <el-option :value="2" label="女" />
            </el-select>
          </el-form-item>

          <el-form-item v-if="!isAdminUser" label="年龄" prop="age">
            <el-input-number v-model="form.age" :min="0" :max="150" class="user-page__number" />
          </el-form-item>

          <el-form-item label="头像地址" class="user-page__full">
            <el-input
              v-model.trim="form.avatarUrl"
              size="large"
              placeholder="https://example.com/avatar.png"
              clearable
            />
          </el-form-item>

          <el-form-item v-if="isAdminUser" label="备注" class="user-page__full">
            <el-input v-model="form.remark" type="textarea" :rows="4" />
          </el-form-item>

          <el-form-item v-else label="兴趣标签" class="user-page__full">
            <el-input
              v-model="form.interestTagsInput"
              type="textarea"
              :rows="4"
              placeholder="多个标签请用中文逗号或英文逗号分隔"
            />
          </el-form-item>
        </div>

        <div class="user-page__actions">
          <el-button type="primary" size="large" :loading="loading" @click="handleSubmit">
            保存修改
          </el-button>
          <el-button size="large" @click="handleReset">重置为当前资料</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.user-page {
  display: grid;
  gap: 20px;
}

.user-page__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
  gap: 24px;
  padding: 28px;
}

.user-page__eyebrow {
  margin: 0 0 10px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.user-page__title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(28px, 4vw, 38px);
}

.user-page__desc {
  margin: 14px 0 0;
  color: #475569;
  line-height: 1.8;
}

.user-page__summary {
  display: grid;
  gap: 12px;
}

.user-page__summary-item {
  padding: 18px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.9);
}

.user-page__summary-item span {
  display: block;
  color: #64748b;
  font-size: 13px;
}

.user-page__summary-item strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 16px;
  line-height: 1.6;
  word-break: break-word;
}

.user-page__card {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
}

.user-page__card :deep(.el-card__header) {
  border-bottom: 0;
}

.user-page__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.user-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.user-page__full {
  grid-column: 1 / -1;
}

.user-page__number {
  width: 100%;
}

.user-page__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 14px;
}

@media (max-width: 1080px) {
  .user-page__hero,
  .user-page__grid {
    grid-template-columns: 1fr;
  }
}
</style>
