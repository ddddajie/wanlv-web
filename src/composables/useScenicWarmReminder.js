import { computed, onScopeDispose, unref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { agentChatApi } from '@/api/chat'
import { getNormalUserApi } from '@/api/user'
import { pinia, useUserStore } from '@/stores'

// 正式环境建议恢复为：2 * 60 * 60 * 1000
export const WARM_REMINDER_DELAY_MS = 60*60*1000

const WARM_REMINDER_SOURCE_TYPE = 'SCENIC_WARM_REMINDER'
const WARM_REMINDER_STORAGE_PREFIX = 'wanlv:scenic-warm-reminder'
const WARM_REMINDER_MESSAGE_DURATION = 5000
const profileLoadedUserIds = new Set()

function readOptionValue(value) {
  return typeof value === 'function' ? value() : unref(value)
}

function toPositiveNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatGender(gender) {
  if (Number(gender) === 1) return '男'
  if (Number(gender) === 2) return '女'
  return normalizeText(gender) || '未填写'
}

function parseInterestTags(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean)
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(normalizeText).filter(Boolean)
  } catch {
    return String(value)
      .split(/[,，、\s]+/)
      .map(normalizeText)
      .filter(Boolean)
  }

  return []
}

function shouldFetchProfile(userInfo = {}) {
  return ['nickname', 'gender', 'age', 'interestTags'].some((key) => {
    const value = userInfo[key]
    return value === undefined || value === null || value === ''
  })
}

function buildStorageKey(userId, scenicAreaId) {
  return `${WARM_REMINDER_STORAGE_PREFIX}:${userId}:${scenicAreaId}:${WARM_REMINDER_DELAY_MS}`
}

function getLastReminderSentAt(key) {
  if (typeof window === 'undefined') return Date.now()
  const sentAt = Number(window.sessionStorage.getItem(key))
  return Number.isFinite(sentAt) && sentAt > 0 ? sentAt : 0
}

function hasRecentReminder(key) {
  const sentAt = getLastReminderSentAt(key)
  return sentAt > 0 && Date.now() - sentAt < WARM_REMINDER_DELAY_MS
}

function markReminderSent(key) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(key, String(Date.now()))
}

function buildProfileText(userInfo = {}) {
  const tags = parseInterestTags(userInfo.interestTags)
  const nickname = normalizeText(userInfo.nickname || userInfo.displayName || userInfo.username) || '未填写'
  const age = userInfo.age === undefined || userInfo.age === null || userInfo.age === '' ? '未填写' : `${userInfo.age}岁`

  return [
    `昵称：${nickname}`,
    `性别：${formatGender(userInfo.gender)}`,
    `年龄：${age}`,
    `兴趣标签：${tags.length ? tags.join('、') : '未填写'}`,
  ].join('；')
}

function formatCurrentTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function buildReminderPrompt({ scenicAreaName, playHours, userProfileText, currentTime }) {
  const scenicName = scenicAreaName || '当前景区'

  return [
    `当前时间：${currentTime}。`,
    `用户已在【${scenicName}】游玩约 ${playHours} 小时。`,
    `用户画像：${userProfileText}。`,
    '请结合用户画像生成一条简短、自然、有温度的中文温馨提示。',
    '提醒内容可以包含休息、补水、防晒、安全、路线节奏或下一步游览建议。',
    '请只输出最终要展示给用户的一句话，不要解释生成过程。',
  ].join('\n')
}

async function ensureNormalUserProfile(userStore, userId) {
  const currentProfile = userStore.userInfo || {}

  if (!shouldFetchProfile(currentProfile) || profileLoadedUserIds.has(userId)) {
    return currentProfile
  }

  profileLoadedUserIds.add(userId)

  try {
    const detail = await getNormalUserApi(userId)
    userStore.patchUserInfo(detail)
  } catch (error) {
    console.error('Failed to load warm reminder user profile:', error)
  }

  return userStore.userInfo || currentProfile
}

export function useScenicWarmReminder({ scenicAreaId, scenicAreaName }) {
  const userStore = useUserStore(pinia)
  const currentScenicAreaId = computed(() => toPositiveNumber(readOptionValue(scenicAreaId)))
  const currentScenicAreaName = computed(() => normalizeText(readOptionValue(scenicAreaName)))
  const currentUserId = computed(() => toPositiveNumber(userStore.userId))

  let timerId = null
  let activeReminderKey = ''

  function clearReminderTimer() {
    if (!timerId) return
    window.clearTimeout(timerId)
    timerId = null
  }

  function canScheduleReminder() {
    return Boolean(userStore.isLoggedIn && !userStore.isAdmin && currentUserId.value && currentScenicAreaId.value)
  }

  async function sendWarmReminder(expectedKey, scenicId) {
    if (!canScheduleReminder() || currentScenicAreaId.value !== scenicId || hasRecentReminder(expectedKey)) return

    const userId = currentUserId.value
    const playHours = Math.max(1, Math.round(WARM_REMINDER_DELAY_MS / (60 * 60 * 1000)))
    const userProfile = await ensureNormalUserProfile(userStore, userId)
    const userProfileText = buildProfileText(userProfile)
    const scenicName = currentScenicAreaName.value || `景区 #${scenicId}`

    try {
      const result = await agentChatApi({
        userId,
        content: buildReminderPrompt({
          scenicAreaName: scenicName,
          playHours,
          userProfileText,
          currentTime: formatCurrentTime(),
        }),
        messageType: 'text',
        scenicAreaId: scenicId,
        scenicAreaSource: 'FRONTEND',
        scenicAreaConfirmed: 1,
        sourceType: WARM_REMINDER_SOURCE_TYPE,
        sourceId: String(scenicId),
      })
      const message = normalizeText(result?.answer) || '温馨提醒：游玩时间较久，记得适当休息、补充水分，注意安全。'

      ElMessage.info({
        message,
        duration: WARM_REMINDER_MESSAGE_DURATION,
        showClose: true,
      })
      markReminderSent(expectedKey)
    } catch (error) {
      console.error('Failed to send scenic warm reminder:', error)
    }
  }

  function scheduleNextReminder(reminderKey, scenicId) {
    // 重点：周期结束后继续安排下一轮提醒；切换景区或离开页面时会统一清理。
    timerId = window.setTimeout(async () => {
      timerId = null
      await sendWarmReminder(reminderKey, scenicId)

      if (activeReminderKey === reminderKey && canScheduleReminder() && currentScenicAreaId.value === scenicId) {
        scheduleNextReminder(reminderKey, scenicId)
      }
    }, WARM_REMINDER_DELAY_MS)
  }

  function scheduleReminder() {
    clearReminderTimer()
    activeReminderKey = ''

    if (!canScheduleReminder()) return

    const scenicId = currentScenicAreaId.value
    const reminderKey = buildStorageKey(currentUserId.value, scenicId)
    activeReminderKey = reminderKey

    // 重点：按当前景区重新计时，切换景区时旧定时器会被清理，避免串景区提醒。
    scheduleNextReminder(reminderKey, scenicId)
  }

  watch(
    () => [userStore.isLoggedIn, userStore.isAdmin, currentUserId.value, currentScenicAreaId.value],
    scheduleReminder,
    { immediate: true },
  )

  onScopeDispose(clearReminderTimer)

  return {
    activeReminderKey: computed(() => activeReminderKey),
  }
}
