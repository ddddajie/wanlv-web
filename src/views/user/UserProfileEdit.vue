<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { pageScenicAreasApi } from '@/api/map'
import {
  getAdminUserApi,
  getNormalUserApi,
  updateAdminUserApi,
  updateNormalUserApi,
  verifyNormalUserRealNameApi,
} from '@/api/user'
import { pinia, useUserStore } from '@/stores'
import { message as feedbackMessage } from '@/utils/feedback'
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
      validator(rule, value) {
        if (!value || /^1\d{10}$/.test(value)) return true
        return new Error('请输入正确的手机号')
      },
      trigger: 'blur',
    },
  ],
  email: [
    {
      validator(rule, value) {
        if (!value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true
        return new Error('请输入正确的邮箱地址')
      },
      trigger: 'blur',
    },
  ],
  age: [
    {
      validator(rule, value) {
        if (value === null || value === '' || Number(value) >= 0) return true
        return new Error('年龄不能小于 0')
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
      validator(rule, value) {
        if (/^\d{17}[\dXx]$/.test(String(value || '').trim())) return true
        return new Error('请输入正确的身份证号')
      },
      trigger: 'blur',
    },
  ],
}

const realNameStatusMeta = computed(() => {
  const status = Number(userInfo.value.realNameStatus ?? 0)
  if (status === 1) return { label: '已实名', type: 'success' }
  if (status === 2) return { label: '实名失败', type: 'error' }
  return { label: '未实名', type: 'warning' }
})

const profileTagType = computed(() => (isAdminUser.value ? 'warning' : 'success'))
const profileTagText = computed(() => (isAdminUser.value ? '管理员资料维护' : '普通用户资料维护'))

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

    feedbackMessage.success('个人信息已更新')
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
    realNameFormRef.value?.restoreValidation()
    feedbackMessage.success('实名认证已完成')
  } finally {
    realNameForm.idCardNo = ''
    realNameLoading.value = false
  }
}

function handleReset() {
  syncForm(userInfo.value)
  formRef.value?.restoreValidation()
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
  <div class="grid gap-5">
    <n-spin :show="profileLoading">
      <n-card
        v-if="!isAdminUser"
        :bordered="false"
        class="profile-card"
        content-class="!p-5 md:!p-6"
        header-class="!px-5 !pt-5 !pb-0 md:!px-6 md:!pt-6"
      >
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="m-0 text-lg font-semibold text-slate-950">实名认证</h2>
              <p class="m-0 mt-1 text-sm leading-6 text-slate-500">完善实名信息后，可提升账号可信度。</p>
            </div>
            <n-tag :type="realNameStatusMeta.type" round>
              {{ realNameStatusMeta.label }}
            </n-tag>
          </div>
        </template>

        <div class="mb-5 grid gap-3 md:grid-cols-3">
          <div class="rounded-lg bg-slate-50 p-4">
            <span class="block text-sm font-medium text-slate-500">真实姓名</span>
            <strong class="mt-2 block break-words text-base text-slate-950">
              {{ userInfo.realName || '暂无' }}
            </strong>
          </div>
          <div class="rounded-lg bg-slate-50 p-4">
            <span class="block text-sm font-medium text-slate-500">证件号码</span>
            <strong class="mt-2 block break-words text-base text-slate-950">
              {{ userInfo.idCardMasked || '认证后展示脱敏号码' }}
            </strong>
          </div>
          <div class="rounded-lg bg-slate-50 p-4">
            <span class="block text-sm font-medium text-slate-500">认证时间</span>
            <strong class="mt-2 block break-words text-base text-slate-950">
              {{ userInfo.realNameTime ? userInfo.realNameTime.replace('T', ' ') : '暂无' }}
            </strong>
          </div>
        </div>

        <n-form
          ref="realNameFormRef"
          :model="realNameForm"
          :rules="realNameRules"
          label-placement="top"
          @submit.prevent="handleRealNameVerify"
        >
          <div class="grid gap-x-4 md:grid-cols-2">
            <n-form-item label="真实姓名" path="realName">
              <n-input
                v-model:value="realNameForm.realName"
                :disabled="userStore.isRealNameVerified"
                clearable
                placeholder="请输入真实姓名"
                size="large"
              />
            </n-form-item>
            <n-form-item label="身份证号" path="idCardNo">
              <n-input
                v-model:value="realNameForm.idCardNo"
                :disabled="userStore.isRealNameVerified"
                clearable
                placeholder="仅用于本次认证提交"
                size="large"
              />
            </n-form-item>
          </div>
          <div class="flex flex-wrap gap-3 pt-1">
            <n-button
              type="primary"
              size="large"
              :loading="realNameLoading"
              :disabled="userStore.isRealNameVerified"
              @click="handleRealNameVerify"
            >
              {{ userStore.isRealNameVerified ? '已完成认证' : '提交认证' }}
            </n-button>
          </div>
        </n-form>
      </n-card>
    </n-spin>

    <n-spin :show="profileLoading">
      <n-card
        :bordered="false"
        class="profile-card"
        content-class="!p-5 md:!p-6"
        header-class="!px-5 !pt-5 !pb-0 md:!px-6 md:!pt-6"
      >
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="m-0 text-lg font-semibold text-slate-950">
                {{ isAdminUser ? '管理员资料' : '普通用户资料' }}
              </h2>
              <p class="m-0 mt-1 text-sm leading-6 text-slate-500">
                {{ isAdminUser ? '维护管理员基础信息与所属景区。' : '维护昵称、邮箱与兴趣标签。' }}
              </p>
            </div>
            <n-tag :type="profileTagType" round>
              {{ profileTagText }}
            </n-tag>
          </div>
        </template>

        <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" @submit.prevent="handleSubmit">
          <div class="grid gap-x-4 md:grid-cols-2">
            <n-form-item v-if="isAdminUser" label="账号" path="username">
              <n-input v-model:value="form.username" disabled size="large" />
            </n-form-item>

            <n-form-item v-else label="手机号" path="phone">
              <n-input v-model:value="form.phone" disabled size="large" />
            </n-form-item>

            <n-form-item label="新密码" path="password">
              <n-input
                v-model:value="form.password"
                clearable
                placeholder="不修改可留空"
                show-password-on="click"
                size="large"
                type="password"
              />
            </n-form-item>

            <n-form-item v-if="isAdminUser" label="真实姓名" path="realName">
              <n-input v-model:value="form.realName" clearable placeholder="请输入真实姓名" size="large" />
            </n-form-item>

            <n-form-item v-else label="昵称" path="nickname">
              <n-input v-model:value="form.nickname" clearable placeholder="请输入昵称" size="large" />
            </n-form-item>

            <n-form-item v-if="isAdminUser" label="手机号" path="phone">
              <n-input v-model:value="form.phone" clearable placeholder="请输入手机号" size="large" />
            </n-form-item>

            <n-form-item label="邮箱" path="email">
              <n-input v-model:value="form.email" clearable placeholder="请输入邮箱" size="large" />
            </n-form-item>

            <n-form-item v-if="isAdminUser" label="所属景区" path="scenicSpot">
              <n-select
                v-model:value="form.scenicSpot"
                clearable
                filterable
                :loading="scenicLoading"
                :options="scenicSelectOptions"
                placeholder="请选择所属景区"
                size="large"
              />
            </n-form-item>

            <n-form-item v-else label="性别" path="gender">
              <n-select
                v-model:value="form.gender"
                disabled
                :options="[
                  { value: 1, label: '男' },
                  { value: 2, label: '女' },
                ]"
                placeholder="请选择性别"
                size="large"
              />
            </n-form-item>

            <n-form-item v-if="!isAdminUser" label="年龄" path="age">
              <n-input v-model:value="form.age" disabled size="large" />
            </n-form-item>

            <n-form-item label="头像地址" path="avatarUrl" class="md:col-span-2">
              <n-input
                v-model:value="form.avatarUrl"
                disabled
                placeholder="头像地址暂不支持修改"
                size="large"
              />
            </n-form-item>

            <n-form-item v-if="isAdminUser" label="备注" path="remark" class="md:col-span-2">
              <n-input v-model:value="form.remark" type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" />
            </n-form-item>

            <n-form-item v-else label="兴趣标签" path="interestTagsInput" class="md:col-span-2">
              <n-input
                v-model:value="form.interestTagsInput"
                type="textarea"
                placeholder="多个标签请用中文逗号或英文逗号分隔"
                :autosize="{ minRows: 4, maxRows: 6 }"
              />
            </n-form-item>
          </div>

          <div class="flex flex-wrap gap-3 pt-2">
            <n-button type="primary" size="large" :loading="loading" @click="handleSubmit">
              保存修改
            </n-button>
            <n-button size="large" @click="handleReset">重置为当前资料</n-button>
          </div>
        </n-form>
      </n-card>
    </n-spin>
  </div>
</template>

<style scoped>
.profile-card {
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.profile-card :deep(.n-card-header) {
  border-bottom: 0;
}
</style>
