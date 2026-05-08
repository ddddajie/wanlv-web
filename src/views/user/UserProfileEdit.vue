<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { pageScenicAreasApi } from '@/api/map'
import {
  getAdminUserApi,
  getNormalUserApi,
  updateAdminUserApi,
  updateNormalUserApi,
  verifyNormalUserRealNameApi,
} from '@/api/user'
import { pinia, useUserStore } from '@/stores'
import {
  buildDisplayName,
  normalizePageResult,
  parseInterestTags,
  stringifyInterestTags,
} from './userViewUtils'

const userStore = useUserStore(pinia)
const formRef = ref()
const realNameFormRef = ref()
const loading = ref(false)
const profileLoading = ref(false)
const realNameLoading = ref(false)
const scenicLoading = ref(false)
const scenicOptions = ref([])

const isAdminUser = computed(() => userStore.isAdmin)
const userInfo = computed(() => userStore.userInfo || {})
const scenicSelectOptions = computed(() => {
  const options = scenicOptions.value.map((item) => ({
    label: item.scenicName,
    value: item.scenicName,
  }))

  if (form.scenicSpot && !options.some((item) => item.value === form.scenicSpot)) {
    options.unshift({
      label: form.scenicSpot,
      value: form.scenicSpot,
    })
  }

  return options
})

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

const realNameForm = reactive({
  realName: '',
  idCardNo: '',
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

const realNameRules = {
  realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  idCardNo: [
    { required: true, message: '请输入身份证号', trigger: 'blur' },
    {
      validator(rule, value, callback) {
        if (/^\d{17}[\dXx]$/.test(String(value || '').trim())) {
          callback()
          return
        }

        callback(new Error('请输入正确的身份证号'))
      },
      trigger: 'blur',
    },
  ],
}

const realNameStatusMeta = computed(() => {
  const status = Number(userInfo.value.realNameStatus ?? 0)
  if (status === 1) return { label: '已实名', type: 'success' }
  if (status === 2) return { label: '实名失败', type: 'danger' }
  return { label: '未实名', type: 'warning' }
})

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
  realNameForm.realName = source?.realName ?? ''
  realNameForm.idCardNo = ''
}

function optionalText(value) {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

async function fetchCurrentUserDetail() {
  if (!userStore.userId) return

  profileLoading.value = true
  try {
    const detail = isAdminUser.value
      ? await getAdminUserApi(Number(userStore.userId))
      : await getNormalUserApi(Number(userStore.userId))

    userStore.patchUserInfo({
      ...detail,
      displayName: buildDisplayName(detail),
    })
    syncForm({
      ...userStore.userInfo,
      ...detail,
    })
  } finally {
    profileLoading.value = false
  }
}

async function fetchAllScenicAreas() {
  if (!isAdminUser.value) return

  scenicLoading.value = true
  try {
    const pageSize = 200
    let pageNum = 1
    const records = []
    let total = 0

    do {
      const page = normalizePageResult(await pageScenicAreasApi({ pageNum, pageSize }))
      records.push(...page.records)
      total = page.total
      pageNum += 1
    } while (records.length < total)

    scenicOptions.value = records
  } finally {
    scenicLoading.value = false
  }
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
    password: optionalText(form.password),
    nickname: optionalText(form.nickname),
    email: optionalText(form.email),
    avatarUrl: optionalText(form.avatarUrl),
    // 普通用户的账号、手机号、性别、年龄仅展示，不作为资料修改项提交。
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

async function handleRealNameVerify() {
  if (isAdminUser.value) return
  await realNameFormRef.value.validate()
  realNameLoading.value = true

  try {
    // 身份证号只在认证提交时传给后端，成功或失败后不写入用户资料表单。
    const verifiedUser = await verifyNormalUserRealNameApi({
      userId: Number(form.id || userStore.userId),
      realName: optionalText(realNameForm.realName),
      idCardNo: realNameForm.idCardNo.trim(),
    })

    userStore.patchUserInfo({
      ...verifiedUser,
      displayName: buildDisplayName(verifiedUser),
    })
    syncForm({
      ...userStore.userInfo,
      ...verifiedUser,
    })
    realNameFormRef.value?.clearValidate()
    ElMessage.success('实名认证已完成')
  } finally {
    realNameForm.idCardNo = ''
    realNameLoading.value = false
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

onMounted(() => {
  fetchCurrentUserDetail()
  fetchAllScenicAreas()
})
</script>

<template>
  <div class="user-page">
    <el-card v-if="!isAdminUser" shadow="never" class="user-page__card" v-loading="profileLoading">
      <template #header>
        <div class="user-page__card-head">
          <span>实名认证</span>
          <el-tag effect="plain" :type="realNameStatusMeta.type">
            {{ realNameStatusMeta.label }}
          </el-tag>
        </div>
      </template>

      <div class="real-name-summary">
        <div>
          <span>真实姓名</span>
          <strong>{{ userInfo.realName || '暂无' }}</strong>
        </div>
        <div>
          <span>证件号码</span>
          <strong>{{ userInfo.idCardMasked || '认证后展示脱敏号码' }}</strong>
        </div>
        <div>
          <span>认证时间</span>
          <strong>{{ userInfo.realNameTime ? userInfo.realNameTime.replace('T', ' ') : '暂无' }}</strong>
        </div>
      </div>

      <el-form ref="realNameFormRef" :model="realNameForm" :rules="realNameRules" label-position="top"
        @submit.prevent="handleRealNameVerify">
        <div class="user-page__grid">
          <el-form-item label="真实姓名" prop="realName">
            <el-input v-model.trim="realNameForm.realName" size="large" :disabled="userStore.isRealNameVerified"
              clearable />
          </el-form-item>
          <el-form-item label="身份证号" prop="idCardNo">
            <el-input v-model.trim="realNameForm.idCardNo" size="large" placeholder="仅用于本次认证提交" clearable
              :disabled="userStore.isRealNameVerified" />
          </el-form-item>
        </div>
        <div class="user-page__actions">
          <el-button type="primary" size="large" :loading="realNameLoading" :disabled="userStore.isRealNameVerified"
            @click="handleRealNameVerify">
            {{ userStore.isRealNameVerified ? '已完成认证' : '提交认证' }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <el-card shadow="never" class="user-page__card" v-loading="profileLoading">
      <template #header>
        <div class="user-page__card-head">
          <span>{{ isAdminUser ? '管理员资料' : '普通用户资料' }}</span>
          <el-tag effect="plain" :type="isAdminUser ? 'warning' : 'success'">
            {{ isAdminUser ? 'admin update' : 'normal update' }}
          </el-tag>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">
        <div class="user-page__grid">
          <el-form-item v-if="isAdminUser" label="账号" prop="username">
            <el-input v-model.trim="form.username" size="large" disabled />
          </el-form-item>

          <el-form-item v-else label="手机号" prop="phone">
            <el-input v-model.trim="form.phone" size="large" disabled />
          </el-form-item>

          <el-form-item label="新密码">
            <el-input v-model="form.password" type="password" show-password size="large" placeholder="不修改可留空"
              clearable />
          </el-form-item>

          <el-form-item v-if="isAdminUser" label="真实姓名">
            <el-input v-model.trim="form.realName" size="large" clearable />
          </el-form-item>

          <el-form-item v-else label="昵称">
            <el-input v-model.trim="form.nickname" size="large" clearable />
          </el-form-item>

          <el-form-item v-if="isAdminUser" label="手机号" prop="phone">
            <el-input v-model.trim="form.phone" size="large" clearable />
          </el-form-item>

          <el-form-item label="邮箱" prop="email">
            <el-input v-model.trim="form.email" size="large" clearable />
          </el-form-item>

          <el-form-item v-if="isAdminUser" label="所属景区">
            <el-select v-model="form.scenicSpot" size="large" placeholder="请选择所属景区" filterable clearable
              :loading="scenicLoading">
              <el-option v-for="item in scenicSelectOptions" :key="item.value" :label="item.label"
                :value="item.value" />
            </el-select>
          </el-form-item>

          <el-form-item v-else label="性别">
            <el-select v-model="form.gender" placeholder="请选择性别" size="large" disabled>
              <el-option :value="1" label="男" />
              <el-option :value="2" label="女" />
            </el-select>
          </el-form-item>

          <el-form-item v-if="!isAdminUser" label="年龄" prop="age">
            <el-input v-model="form.age" size="large" disabled />
          </el-form-item>

          <el-form-item label="头像地址" class="user-page__full">
            <el-input v-model.trim="form.avatarUrl" size="large" placeholder="头像地址暂不支持修改" disabled />
          </el-form-item>

          <el-form-item v-if="isAdminUser" label="备注" class="user-page__full">
            <el-input v-model="form.remark" type="textarea" :rows="4" />
          </el-form-item>

          <el-form-item v-else label="兴趣标签" class="user-page__full">
            <el-input v-model="form.interestTagsInput" type="textarea" :rows="4" placeholder="多个标签请用中文逗号或英文逗号分隔" />
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

.real-name-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.real-name-summary div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 8px;
  background: #f8fafc;
}

.real-name-summary span {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.real-name-summary strong {
  color: #0f172a;
  font-size: 15px;
  word-break: break-word;
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
  .user-page__grid,
  .real-name-summary {
    grid-template-columns: 1fr;
  }
}
</style>
