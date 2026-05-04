<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pinia, useUserStore } from '@/stores'
import {
  agentChatApi,
  bindSessionScenicAreaApi,
  fetchDigitalHuman,
  fetchInterruptTalk,
  sendWebRTCOffer,
} from '@/api/chat'

const props = defineProps({
  embedded: {
    type: Boolean,
    default: false,
  },
})

const route = useRoute()
const userStore = useUserStore(pinia)

const STUN_SERVER = 'stun:stun.l.google.com:19302'
const SPEECH_START_DELAY = 1200
const BASE_CHAR_INTERVAL = 185
const FINISHED_HIDE_DELAY = 900
const MOBILE_BREAKPOINT = 768
const DIGITAL_HUMAN_AVATAR_STORAGE_KEY = 'wanlv:selected-digital-human-avatar'

const digitalHumanAvatars = [
  {
    id: 'guide-female-01',
    name: '导游小婉',
    description: '适合景区讲解和游客问答',
    previewImage: '',
    apiUrl: import.meta.env.VITE_DIGITAL_HUMAN_GUIDE_API_URL || import.meta.env.VITE_DIGITAL_HUMAN_API_URL || 'http://localhost:8010',
    enabled: true,
  },
  {
    id: 'service-male-01',
    name: '客服小舟',
    description: '适合咨询服务和标准问答',
    previewImage: '',
    apiUrl: import.meta.env.VITE_DIGITAL_HUMAN_SERVICE_API_URL || import.meta.env.VITE_DIGITAL_HUMAN_API_URL || 'http://localhost:8010',
    enabled: true,
  },
]

const userInput = ref('')
const loading = ref(false)
const bindLoading = ref(false)
const connectionStatus = ref('disconnected')
const digitalHumanSessionId = ref(0)
const isVoiceRecording = ref(false)
const lastQuestion = ref('')
const messages = ref([])
const chatArea = ref(null)
const pc = ref(null)
const mediaRecorder = ref(null)
const recognition = ref(null)
const speechState = ref('idle')
const aiBubbleVisible = ref(false)
const aiBubbleText = ref('')
const aiBubbleFullText = ref('')
const isMobile = ref(false)
const avatarDrawerVisible = ref(false)
const activeMobileTab = ref('chat')
const mobileInfoDrawerVisible = ref(false)
const selectedAvatarId = ref(digitalHumanAvatars[0].id)

const chatState = reactive({
  sessionId: null,
  sessionCode: null,
  reportDate: null,
  scenicAreaId: null,
  scenicAreaConfirmed: 0,
  sessionType: null,
  detectedScenicAreaId: null,
  detectedScenicAreaName: '',
  detectionConfidence: null,
  needScenicAreaConfirm: false,
})

let speechStartTimer = null
let speechTypeTimer = null
let bubbleHideTimer = null
let activeSpeechToken = 0

const toPositiveNumber = (value) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

const currentUserId = computed(() => toPositiveNumber(userStore.userId))
const routeScenicAreaId = computed(() => toPositiveNumber(route.query.scenicAreaId))
const routeScenicAreaName = computed(() =>
  typeof route.query.scenicAreaName === 'string' ? route.query.scenicAreaName.trim() : '',
)
const statusText = computed(() => ({ connected: '已连接', connecting: '连接中...', disconnected: '未连接' }[connectionStatus.value] || '未连接'))
const statusType = computed(() => ({ connected: 'success', connecting: 'warning', disconnected: 'info' }[connectionStatus.value] || 'info'))
const bubbleStatusText = computed(() => ({ idle: '待命中', queued: '准备播报', speaking: '播报中', finished: '播报完成' }[speechState.value] || '待命中'))
const scenicAreaLabel = computed(() => chatState.detectedScenicAreaName || routeScenicAreaName.value || (chatState.scenicAreaId ? `景区 #${chatState.scenicAreaId}` : '未确认'))
const scenicConfidenceText = computed(() => typeof chatState.detectionConfidence === 'number' ? `${Math.round(chatState.detectionConfidence * 100)}%` : '--')
const hasScenicPrompt = computed(() => Boolean(chatState.needScenicAreaConfirm || chatState.detectedScenicAreaName))
const canBindDetectedScenic = computed(() => Boolean(chatState.detectedScenicAreaId && currentUserId.value))
const enabledDigitalHumanAvatars = computed(() => digitalHumanAvatars.filter((item) => item.enabled))
const selectedAvatar = computed(() =>
  enabledDigitalHumanAvatars.value.find((item) => item.id === selectedAvatarId.value) || enabledDigitalHumanAvatars.value[0],
)
const scenicStatusText = computed(() => {
  if (chatState.scenicAreaConfirmed === 1) return '已确认'
  if (hasScenicPrompt.value) return '待确认'
  return '未确认'
})
const scrollToChatBottom = async () => {
  await nextTick()
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight
  }
}

watch(() => [messages.value.length, loading.value], () => scrollToChatBottom())

const addMessage = (type, content) => {
  messages.value.push({ id: `${Date.now()}-${messages.value.length}`, type, content })
}

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const renderInlineMarkdown = (text = '') => text
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')

const renderMarkdown = (value = '') => {
  const lines = escapeHtml(value).replace(/\r\n?/g, '\n').split('\n')
  const html = []
  let listItems = []

  const flushList = () => {
    if (!listItems.length) return
    html.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`)
    listItems = []
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      return
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushList()
      const level = Math.min(heading[1].length, 4)
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      return
    }

    if (/^---+$/.test(line)) {
      flushList()
      html.push('<hr>')
      return
    }

    const list = line.match(/^[-*]\s+(.+)$/)
    if (list) {
      listItems.push(list[1])
      return
    }

    const quote = line.match(/^>\s?(.+)$/)
    if (quote) {
      flushList()
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`)
      return
    }

    flushList()
    html.push(`<p>${renderInlineMarkdown(line)}</p>`)
  })

  flushList()
  return html.join('')
}

const sanitizeReplyText = (text) => text.replace(/\*\*|\*|#|\[|\]|\(|\)/g, '').replace(/\s+\n/g, '\n').trim()

const syncChatState = (payload = {}) => {
  chatState.sessionId = payload.sessionId ?? chatState.sessionId
  chatState.sessionCode = payload.sessionCode ?? chatState.sessionCode
  chatState.reportDate = payload.reportDate ?? chatState.reportDate
  chatState.sessionType = payload.sessionType ?? chatState.sessionType
  chatState.scenicAreaId = payload.scenicAreaId ?? chatState.scenicAreaId
  chatState.scenicAreaConfirmed = payload.scenicAreaConfirmed ?? chatState.scenicAreaConfirmed
  if (payload.scenicAreaId) {
    chatState.detectedScenicAreaId = null
    chatState.detectedScenicAreaName = ''
    chatState.detectionConfidence = null
    chatState.needScenicAreaConfirm = false
    return
  }
  chatState.detectedScenicAreaId = payload.detectedScenicAreaId ?? null
  chatState.detectedScenicAreaName = payload.detectedScenicAreaName ?? ''
  chatState.detectionConfidence = payload.detectionConfidence ?? null
  chatState.needScenicAreaConfirm = Boolean(payload.needScenicAreaConfirm)
}

const clearSpeechTimers = () => {
  if (speechStartTimer) window.clearTimeout(speechStartTimer)
  if (speechTypeTimer) window.clearTimeout(speechTypeTimer)
  if (bubbleHideTimer) window.clearTimeout(bubbleHideTimer)
  speechStartTimer = null
  speechTypeTimer = null
  bubbleHideTimer = null
}

const resetSpeechBubble = () => {
  clearSpeechTimers()
  speechState.value = 'idle'
  aiBubbleVisible.value = false
  aiBubbleText.value = ''
  aiBubbleFullText.value = ''
}

const getCharDelay = (char) => {
  if (['。', '！', '？', '!', '?'].includes(char)) return BASE_CHAR_INTERVAL + 220
  if (['，', '、', '；', '：', ',', ';', ':'].includes(char)) return BASE_CHAR_INTERVAL + 100
  if (char === '\n') return BASE_CHAR_INTERVAL + 160
  if (char === ' ') return BASE_CHAR_INTERVAL - 40
  return BASE_CHAR_INTERVAL
}

const finishSpeechBubble = (token) => {
  if (activeSpeechToken !== token) return
  speechState.value = 'finished'
  aiBubbleText.value = aiBubbleFullText.value
  bubbleHideTimer = window.setTimeout(() => activeSpeechToken === token && resetSpeechBubble(), FINISHED_HIDE_DELAY)
}

const runTypewriter = (token, index = 0) => {
  if (activeSpeechToken !== token) return
  const fullText = aiBubbleFullText.value
  if (!fullText || index >= fullText.length) return finishSpeechBubble(token)
  speechState.value = 'speaking'
  aiBubbleText.value = fullText.slice(0, index + 1)
  speechTypeTimer = window.setTimeout(() => runTypewriter(token, index + 1), getCharDelay(fullText[index]))
}

const startSimulatedSpeech = (text) => {
  const token = Date.now()
  activeSpeechToken = token
  clearSpeechTimers()
  aiBubbleFullText.value = text
  aiBubbleText.value = ''
  aiBubbleVisible.value = true
  speechState.value = 'queued'
  speechStartTimer = window.setTimeout(() => runTypewriter(token, 0), SPEECH_START_DELAY)
}

const cleanupPeerConnection = () => {
  if (pc.value) pc.value.close()
  pc.value = null
}

const negotiate = async () => {
  try {
    pc.value.addTransceiver('video', { direction: 'recvonly' })
    pc.value.addTransceiver('audio', { direction: 'recvonly' })
    const offer = await pc.value.createOffer()
    await pc.value.setLocalDescription(offer)
    await new Promise((resolve) => {
      if (pc.value.iceGatheringState === 'complete') return resolve()
      const handler = () => {
        if (pc.value?.iceGatheringState === 'complete') {
          pc.value.removeEventListener('icegatheringstatechange', handler)
          resolve()
        }
      }
      pc.value.addEventListener('icegatheringstatechange', handler)
    })
    const response = await sendWebRTCOffer(
      { sdp: pc.value.localDescription.sdp, type: pc.value.localDescription.type },
      selectedAvatar.value?.apiUrl,
    )
    digitalHumanSessionId.value = response.data.sessionid
    await pc.value.setRemoteDescription(response.data)
  } catch (error) {
    ElMessage.error(`WebRTC 协商失败：${error.message}`)
    connectionStatus.value = 'disconnected'
  }
}

const start = async () => {
  try {
    pc.value = new RTCPeerConnection({ sdpSemantics: 'unified-plan', iceServers: [{ urls: [STUN_SERVER] }] })
    pc.value.addEventListener('track', (event) => {
      const targetId = event.track.kind === 'video' ? 'digital-human-video' : 'digital-human-audio'
      const element = document.getElementById(targetId)
      if (element) element.srcObject = event.streams[0]
    })
    pc.value.addEventListener('connectionstatechange', () => {
      const state = pc.value?.connectionState
      if (state === 'connected') return (connectionStatus.value = 'connected')
      if (['disconnected', 'failed', 'closed'].includes(state)) {
        connectionStatus.value = 'disconnected'
        resetSpeechBubble()
      }
    })
    await negotiate()
  } catch (error) {
    ElMessage.error(`启动连接失败：${error.message}`)
    connectionStatus.value = 'disconnected'
  }
}

const stop = async () => {
  try {
    if (digitalHumanSessionId.value) {
      await fetchInterruptTalk({ sessionid: digitalHumanSessionId.value }, selectedAvatar.value?.apiUrl)
    }
  } catch (error) {
    console.error('Failed to interrupt speech:', error)
  }
  resetSpeechBubble()
  cleanupPeerConnection()
  digitalHumanSessionId.value = 0
  connectionStatus.value = 'disconnected'
}

const interruptCurrentSpeech = async () => {
  activeSpeechToken = Date.now()
  clearSpeechTimers()
  if (!digitalHumanSessionId.value) return resetSpeechBubble()
  try {
    await fetchInterruptTalk({ sessionid: digitalHumanSessionId.value }, selectedAvatar.value?.apiUrl)
  } catch (error) {
    console.error('Failed to interrupt digital human speech:', error)
  } finally {
    resetSpeechBubble()
  }
}

const playBubbleReply = async (replyText) => {
  const cleanedReply = sanitizeReplyText(replyText)
  if (!cleanedReply) return
  if (connectionStatus.value === 'connected' && digitalHumanSessionId.value) {
    try {
      const response = await fetchDigitalHuman(
        { type: 'echo', text: cleanedReply, sessionid: digitalHumanSessionId.value },
        selectedAvatar.value?.apiUrl,
      )
      if (response.data?.code !== 0) throw new Error(response.data?.msg || '数字人播报失败')
    } catch (error) {
      ElMessage.warning(error.message || '数字人播报失败')
    }
  }
  startSimulatedSpeech(cleanedReply)
}

const sendChatMessage = async ({ presetText = '', messageType = 'text' } = {}) => {
  const message = (presetText || userInput.value).trim()
  if (!message || loading.value) return
  if (!currentUserId.value) return ElMessage.error('当前登录用户不存在，无法发起聊天。')
  await interruptCurrentSpeech()
  addMessage(messageType === 'voice' ? 'voice' : 'user', message)
  lastQuestion.value = message
  userInput.value = ''
  loading.value = true
  try {
    const result = await agentChatApi({
      userId: currentUserId.value,
      content: messageType === 'voice' ? undefined : message,
      messageType,
      voiceText: messageType === 'voice' ? message : null,
      scenicAreaId: chatState.scenicAreaId ?? routeScenicAreaId.value,
      scenicAreaSource: chatState.scenicAreaConfirmed === 1 ? 'USER_CONFIRMED' : routeScenicAreaId.value ? 'FRONTEND' : null,
      scenicAreaConfirmed: chatState.scenicAreaConfirmed === 1 || routeScenicAreaId.value ? 1 : 0,
      sourceType: routeScenicAreaId.value ? 'SCENIC_DETAIL' : 'GLOBAL_CHAT',
      sourceId: routeScenicAreaId.value ? String(routeScenicAreaId.value) : null,
    })
    syncChatState(result)
    addMessage('agent', result?.answer || '暂时没有获取到回复。')
    await playBubbleReply(result?.answer || '暂时没有获取到回复。')
  } catch (error) {
    console.error('Failed to send chat message:', error)
    addMessage('system', '这次提问没有成功送达后端，请稍后重试。')
  } finally {
    loading.value = false
  }
}

const handleConfirmScenicArea = async () => {
  if (!canBindDetectedScenic.value || bindLoading.value) return
  bindLoading.value = true
  try {
    const sessionId = await bindSessionScenicAreaApi({
      userId: currentUserId.value,
      scenicAreaId: chatState.detectedScenicAreaId,
      scenicAreaSource: 'USER_CONFIRMED',
      scenicAreaConfirmed: 1,
      sessionType: 'SCENIC_SERVICE',
    })
    chatState.sessionId = sessionId || chatState.sessionId
    chatState.scenicAreaId = chatState.detectedScenicAreaId
    chatState.scenicAreaConfirmed = 1
    chatState.sessionType = 'SCENIC_SERVICE'
    chatState.needScenicAreaConfirm = false
    addMessage('system', `已绑定景区：${chatState.detectedScenicAreaName || `景区 #${chatState.detectedScenicAreaId}`}`)
    ElMessage.success('景区已确认，后续会按景区服务模式继续对话。')
  } catch (error) {
    console.error('Failed to bind scenic area:', error)
  } finally {
    bindLoading.value = false
  }
}

const handleDismissScenicPrompt = () => {
  chatState.needScenicAreaConfirm = false
  chatState.detectedScenicAreaId = null
  chatState.detectedScenicAreaName = ''
  chatState.detectionConfidence = null
}

const handleConnectDigitalHuman = () => {
  connectionStatus.value = 'connecting'
  start()
}

const openAvatarSelector = () => {
  avatarDrawerVisible.value = true
}

const openMobileInfoDrawer = (tabName) => {
  activeMobileTab.value = tabName
  mobileInfoDrawerVisible.value = true
}

const handleAvatarSelect = async (avatar) => {
  if (!avatar || avatar.id === selectedAvatarId.value) {
    avatarDrawerVisible.value = false
    return
  }

  const previousAvatarId = selectedAvatarId.value
  const applyAvatar = async () => {
    selectedAvatarId.value = avatar.id
    localStorage.setItem(DIGITAL_HUMAN_AVATAR_STORAGE_KEY, avatar.id)
    avatarDrawerVisible.value = false
  }

  if (connectionStatus.value === 'connected') {
    try {
      await ElMessageBox.confirm('切换数字人形象需要重新连接，是否继续？', '切换形象', {
        type: 'warning',
        confirmButtonText: '重新连接',
        cancelButtonText: '取消',
      })
      await stop()
      await applyAvatar()
      handleConnectDigitalHuman()
    } catch {
      selectedAvatarId.value = previousAvatarId
    }
    return
  }

  await applyAvatar()
  ElMessage.success(`已切换为${avatar.name}`)
}

const syncScreenMode = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}

const handleVoiceRecordStart = async () => {
  if (isVoiceRecording.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    mediaRecorder.value.ondataavailable = () => { }
    mediaRecorder.value.start()
    isVoiceRecording.value = true
    recognition.value?.start()
  } catch (error) {
    console.error('Failed to access microphone:', error)
    ElMessage.error('无法访问麦克风，请检查浏览器权限设置。')
  }
}

const handleVoiceRecordStop = () => {
  if (!isVoiceRecording.value || !mediaRecorder.value) return
  mediaRecorder.value.stop()
  isVoiceRecording.value = false
  mediaRecorder.value.stream?.getTracks().forEach((track) => track.stop())
  recognition.value?.stop()
  window.setTimeout(() => userInput.value.trim() && sendChatMessage({ presetText: userInput.value.trim(), messageType: 'voice' }), 500)
}

const initSpeechRecognition = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return
  recognition.value = new SpeechRecognition()
  recognition.value.continuous = true
  recognition.value.interimResults = true
  recognition.value.lang = 'zh-CN'
  recognition.value.onresult = (event) => {
    let transcript = ''
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript
    }
    userInput.value = transcript.trim()
  }
}

const seedInitialContext = () => {
  if (!routeScenicAreaId.value) return
  chatState.scenicAreaId = routeScenicAreaId.value
  chatState.scenicAreaConfirmed = 1
  chatState.sessionType = 'SCENIC_SERVICE'
  if (routeScenicAreaName.value) chatState.detectedScenicAreaName = routeScenicAreaName.value
  addMessage('system', routeScenicAreaName.value ? `已带入景区上下文：${routeScenicAreaName.value}` : `已带入景区上下文：景区 #${routeScenicAreaId.value}`)
}

const handleBeforeUnload = () => {
  resetSpeechBubble()
  cleanupPeerConnection()
}

onMounted(() => {
  const savedAvatarId = localStorage.getItem(DIGITAL_HUMAN_AVATAR_STORAGE_KEY)
  if (enabledDigitalHumanAvatars.value.some((item) => item.id === savedAvatarId)) {
    selectedAvatarId.value = savedAvatarId
  }
  syncScreenMode()
  initSpeechRecognition()
  seedInitialContext()
  window.addEventListener('resize', syncScreenMode)
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('unload', handleBeforeUnload)
})

onUnmounted(() => {
  resetSpeechBubble()
  cleanupPeerConnection()
  if (isVoiceRecording.value && mediaRecorder.value) {
    mediaRecorder.value.stop()
    mediaRecorder.value.stream?.getTracks().forEach((track) => track.stop())
  }
  recognition.value?.stop()
  window.removeEventListener('resize', syncScreenMode)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('unload', handleBeforeUnload)
})
</script>

<template>
  <div class="page" :class="{ 'page--embedded': embedded }">
    <template v-if="!isMobile">
      <section class="hero">
        <div>
          <span class="kicker">智能客服</span>
        </div>
        <div class="chips">
          <el-tag :type="statusType" effect="dark" round>{{ statusText }}</el-tag>
          <el-tag type="primary" effect="plain" round>会话类型：{{ chatState.sessionType || 'CONSULTATION' }}</el-tag>
          <span class="chip">当前形象：{{ selectedAvatar?.name || '--' }}</span>
          <button type="button" class="chip chip--button" @click="openAvatarSelector">切换形象</button>
          <span class="chip">后端会话：{{ chatState.sessionCode || chatState.sessionId || '--' }}</span>
          <span class="chip">数字人：{{ digitalHumanSessionId || '--' }}</span>
        </div>
      </section>

      <section class="grid">
      <div class="left">
        <div class="stage">
          <transition name="bubble-fade">
            <div v-if="aiBubbleVisible" class="bubble">
              <div class="bubble-head"><span>数字人回复</span><span>{{ bubbleStatusText }}</span></div>
              <p>{{ aiBubbleText || aiBubbleFullText }}</p>
            </div>
          </transition>
          <video id="digital-human-video" autoplay playsinline></video>
          <audio id="digital-human-audio" autoplay></audio>
          <div v-if="connectionStatus !== 'connected'" class="placeholder">连接数字人后可同步播报回复，不连接也能正常文字问答。</div>
        </div>

        <div class="stats">
          <div class="card"><span>最近提问</span><strong>{{ lastQuestion || '还没有发出问题' }}</strong></div>
          <div class="card"><span>当前景区</span><strong>{{ scenicAreaLabel }}</strong></div>
          <div class="card"><span>数字人形象</span><strong>{{ selectedAvatar?.name || '--' }}</strong></div>
        </div>

        <div class="composer">
          <el-input v-model="userInput" size="large" clearable :disabled="loading" placeholder="请输入你想咨询的问题..."
            @keydown.enter.prevent="sendChatMessage()" />
          <el-button type="primary" size="large" :loading="loading" @click="sendChatMessage()">发送提问</el-button>
          <button type="button" class="voice" :class="{ recording: isVoiceRecording }"
            @mousedown="handleVoiceRecordStart" @mouseup="handleVoiceRecordStop" @mouseleave="handleVoiceRecordStop"
            @touchstart.prevent="handleVoiceRecordStart" @touchend="handleVoiceRecordStop">
            {{ isVoiceRecording ? '松开发送' : '按住说话' }}
          </button>
          <el-button v-if="connectionStatus !== 'connected'" plain type="success"
            :loading="connectionStatus === 'connecting'" @click="handleConnectDigitalHuman">{{
              connectionStatus === 'connecting' ? '连接中...' : '连接数字人' }}</el-button>
          <el-button v-else plain type="danger" @click="stop()">断开连接</el-button>
        </div>
      </div>

      <div class="right">
        <div class="panel">
          <div class="panel-head">
            <h2>聊天记录</h2><el-tag type="info" round>{{ messages.length }} 条</el-tag>
          </div>
          <div ref="chatArea" class="stream">
            <el-empty v-if="!messages.length && !loading" description="开始发送第一条消息吧" :image-size="110" />
            <div v-for="message in messages" :key="message.id" class="message" :class="message.type">
              <div class="avatar">{{ message.type === 'agent' ? 'AI' : message.type === 'system' ? 'SYS' : '我' }}</div>
              <div class="msg-body">
                <div class="role">{{ message.type === 'agent' ? '智能回复' : message.type === 'system' ? '系统提示' :
                  message.type === 'voice' ? '语音提问' : '我的提问' }}</div>
                <div v-if="message.type === 'agent'" class="markdown-body" v-html="renderMarkdown(message.content)">
                </div>
                <p v-else>{{ message.content }}</p>
              </div>
            </div>
            <div v-if="loading" class="message agent">
              <div class="avatar">AI</div>
              <div class="msg-body">
                <div class="role">智能回复</div>
                <p>后端处理中...</p>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h2>景区确认</h2>
          </div>
          <div class="state-grid">
            <div class="card"><span>景区绑定</span><strong>{{ scenicAreaLabel }}</strong></div>
            <div class="card"><span>已确认</span><strong>{{ chatState.scenicAreaConfirmed === 1 ? '是' : '否' }}</strong>
            </div>
            <div class="card"><span>识别置信度</span><strong>{{ scenicConfidenceText }}</strong></div>
            <div class="card"><span>报告日期</span><strong>{{ chatState.reportDate || '--' }}</strong></div>
          </div>
          <div v-if="hasScenicPrompt" class="prompt">
            <strong>{{ chatState.detectedScenicAreaName ? `你是在咨询“${chatState.detectedScenicAreaName}”吗？` :
              '系统建议你确认当前咨询景区。' }}</strong>
            <p>{{ canBindDetectedScenic ? '确认后会调用绑定接口，把当天会话切换为景区服务模式。' : '当前只有景区名称提示，还没有可直接绑定的景区 ID。' }}</p>
            <div class="actions">
              <el-button type="primary" :disabled="!canBindDetectedScenic" :loading="bindLoading"
                @click="handleConfirmScenicArea()">确认就是这个景区</el-button>
              <el-button plain @click="handleDismissScenicPrompt()">暂不确认</el-button>
            </div>
          </div>
          <el-empty v-else description="当前还没有绑定景区，系统会在需要时提示你确认。" :image-size="92" />
        </div>
      </div>
      </section>
    </template>

    <template v-else>
      <section class="mobile-shell">
        <nav class="mobile-info-actions" aria-label="问答辅助信息">
          <button type="button" @click="openMobileInfoDrawer('chat')">
            <span>聊天记录</span>
            <strong>{{ messages.length }} 条</strong>
          </button>
          <button type="button" @click="openMobileInfoDrawer('scenic')">
            <span>识别详情</span>
            <strong>{{ scenicStatusText }}</strong>
          </button>
        </nav>

        <section class="mobile-status-card">
          <div class="mobile-status-card__main">
            <span>智能客服</span>
            <strong>{{ selectedAvatar?.name || '默认数字人' }}</strong>
          </div>
          <button type="button" class="mobile-switch" @click="openAvatarSelector">切换</button>
          <div class="mobile-status-grid">
            <div>
              <span>连接状态</span>
              <strong>{{ statusText }}</strong>
            </div>
            <div>
              <span>景区状态</span>
              <strong>{{ scenicStatusText }}</strong>
            </div>
            <div>
              <span>最近提问</span>
              <strong>{{ lastQuestion || '还没有发出问题' }}</strong>
            </div>
          </div>
        </section>

        <section class="mobile-stage">
          <transition name="bubble-fade">
            <div v-if="aiBubbleVisible" class="mobile-bubble">
              <div class="bubble-head"><span>数字人回复</span><span>{{ bubbleStatusText }}</span></div>
              <p>{{ aiBubbleText || aiBubbleFullText }}</p>
            </div>
          </transition>
          <video id="digital-human-video" autoplay playsinline></video>
          <audio id="digital-human-audio" autoplay></audio>
          <div v-if="connectionStatus !== 'connected'" class="mobile-placeholder">连接数字人后可同步播报回复；不连接也能正常文字问答。</div>
        </section>

        <section class="mobile-composer">
          <div v-if="hasScenicPrompt" class="mobile-scenic-prompt">
            <div>
              <strong>{{ chatState.detectedScenicAreaName ? `你是在咨询“${chatState.detectedScenicAreaName}”吗？` : '系统建议你确认当前咨询景区。' }}</strong>
              <p>{{ canBindDetectedScenic ? '确认后会切换为景区服务模式。' : '当前只有景区名称提示，还没有可直接绑定的景区 ID。' }}</p>
            </div>
            <div class="mobile-scenic-prompt__actions">
              <el-button size="small" type="primary" :disabled="!canBindDetectedScenic" :loading="bindLoading"
                @click="handleConfirmScenicArea">确认</el-button>
              <el-button size="small" plain @click="handleDismissScenicPrompt">忽略</el-button>
            </div>
          </div>

          <el-input v-model="userInput" class="mobile-input" size="large" clearable :disabled="loading"
            placeholder="请输入你想咨询的问题..." @keydown.enter.prevent="sendChatMessage()" />
          <div class="mobile-actions">
            <el-button type="primary" :loading="loading" @click="sendChatMessage()">发送</el-button>
            <button type="button" class="voice mobile-voice" :class="{ recording: isVoiceRecording }"
              @mousedown="handleVoiceRecordStart" @mouseup="handleVoiceRecordStop" @mouseleave="handleVoiceRecordStop"
              @touchstart.prevent="handleVoiceRecordStart" @touchend="handleVoiceRecordStop">
              {{ isVoiceRecording ? '松开' : '按住说话' }}
            </button>
            <el-button v-if="connectionStatus !== 'connected'" plain type="success"
              :loading="connectionStatus === 'connecting'" @click="handleConnectDigitalHuman">
              {{ connectionStatus === 'connecting' ? '连接中' : '连接数字人' }}
            </el-button>
            <el-button v-else plain type="danger" @click="stop()">断开</el-button>
          </div>
        </section>

      </section>
    </template>

    <el-drawer v-model="mobileInfoDrawerVisible" title="问答详情" direction="btt" size="72%" class="mobile-info-drawer">
      <el-tabs v-model="activeMobileTab" stretch>
        <el-tab-pane label="聊天记录" name="chat">
          <div class="mobile-tab-head">
            <span>聊天记录</span>
            <el-tag type="info" round>{{ messages.length }} 条</el-tag>
          </div>
          <div ref="chatArea" class="stream mobile-stream">
            <el-empty v-if="!messages.length && !loading" description="开始发送第一条消息吧" :image-size="86" />
            <div v-for="message in messages" :key="message.id" class="message" :class="message.type">
              <div class="avatar">{{ message.type === 'agent' ? 'AI' : message.type === 'system' ? 'SYS' : '我' }}</div>
              <div class="msg-body">
                <div class="role">{{ message.type === 'agent' ? '智能回复' : message.type === 'system' ? '系统提示' :
                  message.type === 'voice' ? '语音提问' : '我的提问' }}</div>
                <div v-if="message.type === 'agent'" class="markdown-body" v-html="renderMarkdown(message.content)" />
                <p v-else>{{ message.content }}</p>
              </div>
            </div>
            <div v-if="loading" class="message agent">
              <div class="avatar">AI</div>
              <div class="msg-body">
                <div class="role">智能回复</div>
                <p>后端处理中...</p>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="识别详情" name="scenic">
          <div class="mobile-detail-grid">
            <div><span>景区绑定</span><strong>{{ scenicAreaLabel }}</strong></div>
            <div><span>是否已确认</span><strong>{{ chatState.scenicAreaConfirmed === 1 ? '是' : '否' }}</strong></div>
            <div><span>识别置信度</span><strong>{{ scenicConfidenceText }}</strong></div>
            <div><span>报告日期</span><strong>{{ chatState.reportDate || '--' }}</strong></div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <el-drawer v-model="avatarDrawerVisible" title="选择数字人形象" direction="btt" size="48%" class="avatar-drawer">
      <div class="avatar-list">
        <button v-for="avatar in enabledDigitalHumanAvatars" :key="avatar.id" type="button" class="avatar-option"
          :class="{ 'avatar-option--active': avatar.id === selectedAvatarId }" @click="handleAvatarSelect(avatar)">
          <span class="avatar-option__preview">{{ avatar.name.slice(0, 1) }}</span>
          <span class="avatar-option__content">
            <strong>{{ avatar.name }}</strong>
            <small>{{ avatar.description || '标准数字人形象' }}</small>
          </span>
          <el-tag v-if="avatar.id === selectedAvatarId" type="success" round>当前</el-tag>
        </button>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24px;
  background: linear-gradient(180deg, #edf4ff, #dfeaf8)
}

.page--embedded {
  min-height: auto;
  padding: 0;
  background: transparent
}

.hero,
.panel,
.composer,
.card {
  background: rgba(255, 255, 255, .88);
  box-shadow: 0 18px 40px rgba(15, 23, 42, .08)
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border-radius: 28px
}

.kicker {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(37, 99, 235, .08);
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase
}

.hero h1 {
  margin: 12px 0 8px;
  font-size: clamp(30px, 4vw, 44px);
  color: #0f172a
}

.hero p {
  margin: 0;
  max-width: 760px;
  color: #475569;
  line-height: 1.8
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  align-content: flex-start
}

.chip {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  font: inherit
}

.chip--button {
  cursor: pointer;
  color: #1d4ed8;
  font-weight: 700
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(340px, .95fr);
  gap: 20px;
  margin-top: 20px
}

.left,
.right {
  display: flex;
  flex-direction: column;
  gap: 20px
}

.stage {
  position: relative;
  min-height: 62vh;
  border-radius: 32px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #06111f, #101d2e);
  box-shadow: 0 28px 60px rgba(15, 23, 42, .22)
}

#digital-human-video {
  width: min(760px, 78vw);
  max-height: 88%;
  object-fit: contain
}

.placeholder {
  position: absolute;
  inset: auto 24px 24px;
  z-index: 2;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(8, 15, 28, .54);
  color: #fff;
  line-height: 1.7
}

.bubble {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 3;
  width: min(420px, calc(100% - 48px));
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 20px 44px rgba(15, 23, 42, .18)
}

.bubble-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 700
}

.bubble p,
.msg-body p,
.summary-block p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8
}

.markdown-body {
  color: inherit;
  line-height: 1.8;
  word-break: break-word
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 12px 0 8px;
  color: #0f172a;
  font-size: 17px;
  line-height: 1.5
}

.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child),
.markdown-body :deep(h4:first-child),
.markdown-body :deep(p:first-child) {
  margin-top: 0
}

.markdown-body :deep(p) {
  margin: 8px 0;
  white-space: normal
}

.markdown-body :deep(strong) {
  font-weight: 800
}

.markdown-body :deep(ul) {
  margin: 8px 0;
  padding-left: 20px
}

.markdown-body :deep(li) {
  margin: 4px 0
}

.markdown-body :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 12px;
  border-left: 3px solid #93c5fd;
  border-radius: 8px;
  background: rgba(59, 130, 246, .08);
  color: #334155
}

.markdown-body :deep(hr) {
  margin: 12px 0;
  border: 0;
  border-top: 1px solid #e2e8f0
}

.markdown-body :deep(code) {
  padding: 2px 5px;
  border-radius: 6px;
  background: #e2e8f0;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: .92em
}

.stats,
.state-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px
}

.card {
  padding: 16px 18px;
  border-radius: 22px
}

.card span,
.summary-block span,
.summary-box span {
  display: block;
  color: #64748b;
  font-size: 13px
}

.card strong,
.summary-box strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 16px;
  line-height: 1.6;
  word-break: break-word
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto auto;
  gap: 12px;
  padding: 18px;
  border-radius: 28px
}

.composer :deep(.el-input__wrapper) {
  min-height: 56px;
  border-radius: 18px
}

.composer :deep(.el-button) {
  min-height: 56px;
  border-radius: 18px
}

.voice {
  min-width: 128px;
  min-height: 56px;
  border: 0;
  border-radius: 18px;
  background: linear-gradient(135deg, #0f172a, #1e3a8a);
  color: #fff;
  font-weight: 700;
  cursor: pointer
}

.voice.recording {
  background: linear-gradient(135deg, #ef4444, #dc2626)
}

.panel {
  padding: 18px;
  border-radius: 28px
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px
}

.panel-head h2 {
  margin: 0;
  font-size: 22px;
  color: #10233e
}

.stream {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 300px;
  max-height: 420px;
  overflow-y: auto
}

.message {
  display: flex;
  gap: 12px;
  align-items: flex-start
}

.message.user,
.message.voice {
  flex-direction: row-reverse
}

.avatar {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700
}

.message.agent .avatar {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
  color: #15803d
}

.message.system .avatar {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  color: #334155
}

.msg-body {
  max-width: min(84%, 520px);
  padding: 14px 16px;
  border-radius: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0
}

.message.user .msg-body,
.message.voice .msg-body {
  background: linear-gradient(135deg, #409eff, #1d4ed8);
  border-color: transparent;
  color: #fff
}

.role {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase
}

.message.user .role,
.message.voice .role {
  color: rgba(255, 255, 255, .78)
}

.prompt {
  margin-top: 16px;
  padding: 16px;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(59, 130, 246, .08), rgba(15, 118, 110, .08))
}

.prompt p {
  margin: 8px 0 0;
  color: #475569;
  line-height: 1.7
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px
}

.summary,
.summary-box {
  padding: 16px;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(16, 185, 129, .08), rgba(59, 130, 246, .08))
}

.summary-box {
  display: flex;
  justify-content: space-between;
  gap: 18px
}

.summary-block {
  margin-top: 16px
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px
}

.tags em {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(37, 99, 235, .08);
  color: #1d4ed8;
  font-style: normal
}

.bubble-fade-enter-active,
.bubble-fade-leave-active {
  transition: opacity .28s ease, transform .28s ease
}

.bubble-fade-enter-from,
.bubble-fade-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(.96)
}

.mobile-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 28px;
  overflow: visible
}

.mobile-info-actions {
  position: sticky;
  top: 0;
  z-index: 8;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 2px 0 4px;
  background: linear-gradient(180deg, rgba(237, 244, 255, .96), rgba(237, 244, 255, .72))
}

.page--embedded .mobile-info-actions {
  background: linear-gradient(180deg, rgba(255, 255, 255, .96), rgba(255, 255, 255, .7))
}

.mobile-info-actions button {
  min-width: 0;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, .24);
  border-radius: 16px;
  background: rgba(255, 255, 255, .94);
  color: #0f172a;
  font: inherit;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .07);
  cursor: pointer
}

.mobile-info-actions span {
  color: #2563eb;
  font-size: 14px;
  font-weight: 800
}

.mobile-info-actions strong {
  min-width: 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  word-break: keep-all
}

.mobile-status-card,
.mobile-composer,
.mobile-info-panel {
  border-radius: 18px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 12px 28px rgba(15, 23, 42, .08)
}

.mobile-status-card {
  position: relative;
  padding: 14px
}

.mobile-status-card__main span,
.mobile-status-grid span,
.mobile-detail-grid span {
  display: block;
  color: #64748b;
  font-size: 12px
}

.mobile-status-card__main strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.35
}

.mobile-switch {
  position: absolute;
  top: 14px;
  right: 14px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(37, 99, 235, .1);
  color: #1d4ed8;
  font-weight: 700;
  cursor: pointer
}

.mobile-status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px
}

.mobile-status-grid div,
.mobile-detail-grid div {
  min-width: 0;
  padding: 10px;
  border-radius: 14px;
  background: #f8fafc
}

.mobile-status-grid strong,
.mobile-detail-grid strong {
  display: block;
  margin-top: 5px;
  color: #0f172a;
  font-size: 13px;
  line-height: 1.35;
  word-break: break-word
}

.mobile-stage {
  position: relative;
  min-height: clamp(220px, 44vh, 360px);
  border-radius: 22px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #07111f, #142033);
  box-shadow: 0 18px 40px rgba(15, 23, 42, .18)
}

.mobile-stage #digital-human-video {
  width: 100%;
  max-height: 100%;
  object-fit: contain
}

.mobile-placeholder {
  position: absolute;
  inset: auto 12px 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(8, 15, 28, .58);
  color: #fff;
  font-size: 13px;
  line-height: 1.55
}

.mobile-bubble {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 3;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 14px 32px rgba(15, 23, 42, .18)
}

.mobile-bubble p {
  margin: 0;
  max-height: 96px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7
}

.mobile-composer {
  padding: 12px
}

.mobile-scenic-prompt {
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(37, 99, 235, .08)
}

.mobile-scenic-prompt strong {
  color: #0f172a;
  font-size: 14px
}

.mobile-scenic-prompt p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.5
}

.mobile-scenic-prompt__actions,
.mobile-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap
}

.mobile-input :deep(.el-input__wrapper) {
  min-height: 48px;
  border-radius: 14px
}

.mobile-actions {
  margin-top: 10px
}

.mobile-actions :deep(.el-button),
.mobile-voice {
  flex: 1 1 96px;
  min-width: 0;
  min-height: 44px;
  border-radius: 14px
}

.mobile-voice {
  min-width: 0
}

.mobile-info-panel {
  flex: 0 0 auto;
  padding: 8px 12px 16px;
  overflow: visible
}

.mobile-info-panel :deep(.el-tabs__content),
.mobile-info-panel :deep(.el-tab-pane) {
  overflow: visible
}

.mobile-tab-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  color: #0f172a;
  font-weight: 800
}

.mobile-stream {
  min-height: 160px;
  max-height: none;
  overflow: visible
}

.mobile-info-drawer :deep(.el-drawer__body) {
  padding: 8px 16px 18px;
  overflow: hidden
}

.mobile-info-drawer .mobile-stream {
  max-height: calc(72vh - 142px);
  overflow-y: auto;
  padding-right: 4px
}

.mobile-info-drawer .mobile-detail-grid {
  max-height: calc(72vh - 116px);
  overflow-y: auto
}

.mobile-stream .avatar {
  width: 36px;
  height: 36px;
  flex-basis: 36px;
  border-radius: 12px
}

.mobile-stream .msg-body {
  max-width: min(82%, 320px);
  padding: 11px 12px;
  border-radius: 16px
}

.mobile-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding-top: 6px
}

.avatar-list {
  display: grid;
  gap: 10px
}

.avatar-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer
}

.avatar-option--active {
  border-color: #2563eb;
  background: rgba(37, 99, 235, .06)
}

.avatar-option__preview {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #dbeafe, #ccfbf1);
  color: #1d4ed8;
  font-weight: 800
}

.avatar-option__content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px
}

.avatar-option__content strong {
  color: #0f172a
}

.avatar-option__content small {
  color: #64748b;
  line-height: 1.45
}

@media (max-width:1180px) {
  .grid {
    grid-template-columns: 1fr
  }

  .stage {
    min-height: 52vh
  }
}

@media (max-width:900px) {
  .page {
    padding: 16px
  }

  .page--embedded {
    padding: 0
  }

  .hero {
    flex-direction: column
  }

  .chips {
    justify-content: flex-start
  }

  .stats,
  .state-grid {
    grid-template-columns: 1fr
  }

  .composer {
    grid-template-columns: 1fr
  }

  .voice,
  .composer :deep(.el-button) {
    width: 100%
  }
}

@media (max-width:640px) {
  .hero h1 {
    font-size: 28px
  }

  .bubble {
    top: 16px;
    left: 16px;
    width: min(360px, calc(100% - 32px))
  }

  .summary-box {
    flex-direction: column;
    align-items: flex-start
  }
}
</style>
