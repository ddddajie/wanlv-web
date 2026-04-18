<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
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

const emit = defineEmits(['navigate'])

const route = useRoute()
const router = useRouter()
const userStore = useUserStore(pinia)

const STUN_SERVER = 'stun:stun.l.google.com:19302'
const SPEECH_START_DELAY = 1200
const BASE_CHAR_INTERVAL = 185
const FINISHED_HIDE_DELAY = 900

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
const canAccessSummaryDashboard = computed(() => userStore.isSuperAdmin)

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
    const response = await sendWebRTCOffer({ sdp: pc.value.localDescription.sdp, type: pc.value.localDescription.type })
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
    if (digitalHumanSessionId.value) await fetchInterruptTalk({ sessionid: digitalHumanSessionId.value })
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
    await fetchInterruptTalk({ sessionid: digitalHumanSessionId.value })
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
      const response = await fetchDigitalHuman({ type: 'echo', text: cleanedReply, sessionid: digitalHumanSessionId.value })
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

const handleGenerateSummary = () => {
  if (!canAccessSummaryDashboard.value) {
    ElMessage.warning('聊天日报仅超级管理员可用，请联系超级管理员在控制台执行')
    return
  }

  if (props.embedded) {
    emit('navigate', 'daily-report')
    return
  }

  router.push('/dashboard')
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

const handleVoiceRecordStart = async () => {
  if (isVoiceRecording.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    mediaRecorder.value.ondataavailable = () => {}
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
  initSpeechRecognition()
  seedInitialContext()
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
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('unload', handleBeforeUnload)
})
</script>

<template>
  <div class="page" :class="{ 'page--embedded': embedded }">
    <section class="hero">
      <div>
        <span class="kicker">Wanlv AI Guide</span>
        <h1>数字人智能问答</h1>
        <p>聊天直连后端 `/agent/chat`，景区确认对接 `/agent/session/scenic-area/bind`，聊天日报已迁移到超级管理员控制台统一执行。</p>
      </div>
      <div class="chips">
        <el-tag :type="statusType" effect="dark" round>{{ statusText }}</el-tag>
        <el-tag type="primary" effect="plain" round>会话类型：{{ chatState.sessionType || 'CONSULTATION' }}</el-tag>
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
          <div class="card"><span>会话日期</span><strong>{{ chatState.reportDate || '--' }}</strong></div>
        </div>

        <div class="composer">
          <el-input v-model="userInput" size="large" clearable :disabled="loading" placeholder="请输入你想咨询的问题..." @keydown.enter.prevent="sendChatMessage()" />
          <el-button type="primary" size="large" :loading="loading" @click="sendChatMessage()">发送提问</el-button>
          <button type="button" class="voice" :class="{ recording: isVoiceRecording }" @mousedown="handleVoiceRecordStart" @mouseup="handleVoiceRecordStop" @mouseleave="handleVoiceRecordStop" @touchstart.prevent="handleVoiceRecordStart" @touchend="handleVoiceRecordStop">
            {{ isVoiceRecording ? '松开发送' : '按住说话' }}
          </button>
          <el-button v-if="connectionStatus !== 'connected'" plain type="success" :loading="connectionStatus === 'connecting'" @click="connectionStatus = 'connecting'; start()">{{ connectionStatus === 'connecting' ? '连接中...' : '连接数字人' }}</el-button>
          <el-button v-else plain type="danger" @click="stop()">断开连接</el-button>
          <el-button plain type="primary" @click="handleGenerateSummary()">
            {{ canAccessSummaryDashboard ? '前往日报控制台' : '日报权限说明' }}
          </el-button>
        </div>
      </div>

      <div class="right">
        <div class="panel">
          <div class="panel-head"><h2>聊天记录</h2><el-tag type="info" round>{{ messages.length }} 条</el-tag></div>
          <div ref="chatArea" class="stream">
            <el-empty v-if="!messages.length && !loading" description="开始发送第一条消息吧" :image-size="110" />
            <div v-for="message in messages" :key="message.id" class="message" :class="message.type">
              <div class="avatar">{{ message.type === 'agent' ? 'AI' : message.type === 'system' ? 'SYS' : '我' }}</div>
              <div class="msg-body">
                <div class="role">{{ message.type === 'agent' ? '智能回复' : message.type === 'system' ? '系统提示' : message.type === 'voice' ? '语音提问' : '我的提问' }}</div>
                <p>{{ message.content }}</p>
              </div>
            </div>
            <div v-if="loading" class="message agent">
              <div class="avatar">AI</div>
              <div class="msg-body"><div class="role">智能回复</div><p>后端处理中...</p></div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>景区确认</h2></div>
          <div class="state-grid">
            <div class="card"><span>景区绑定</span><strong>{{ scenicAreaLabel }}</strong></div>
            <div class="card"><span>已确认</span><strong>{{ chatState.scenicAreaConfirmed === 1 ? '是' : '否' }}</strong></div>
            <div class="card"><span>识别置信度</span><strong>{{ scenicConfidenceText }}</strong></div>
            <div class="card"><span>报告日期</span><strong>{{ chatState.reportDate || '--' }}</strong></div>
          </div>
          <div v-if="hasScenicPrompt" class="prompt">
            <strong>{{ chatState.detectedScenicAreaName ? `你是在咨询“${chatState.detectedScenicAreaName}”吗？` : '系统建议你确认当前咨询景区。' }}</strong>
            <p>{{ canBindDetectedScenic ? '确认后会调用绑定接口，把当天会话切换为景区服务模式。' : '当前只有景区名称提示，还没有可直接绑定的景区 ID。' }}</p>
            <div class="actions">
              <el-button type="primary" :disabled="!canBindDetectedScenic" :loading="bindLoading" @click="handleConfirmScenicArea()">确认就是这个景区</el-button>
              <el-button plain @click="handleDismissScenicPrompt()">暂不确认</el-button>
            </div>
          </div>
          <el-empty v-else description="当前还没有绑定景区，系统会在需要时提示你确认。" :image-size="92" />
        </div>

        <div class="panel">
          <div class="panel-head"><h2>今日总结</h2></div>
          <template v-if="canAccessSummaryDashboard">
            <div class="summary-box">
              <div><span>入口位置</span><strong>/dashboard</strong></div>
              <div><span>权限要求</span><strong>super_admin</strong></div>
            </div>
            <div class="summary-block">
              <span>为什么改到控制台</span>
              <p>新的日报接口要求显式提交 operatorUsername 和 operatorPassword，因此改为在管理员控制台统一发起，支持单用户日报和按日期批量日报两种模式。</p>
            </div>
            <div class="summary-block">
              <span>建议流程</span>
              <div class="tags">
                <em>先完成聊天联调</em>
                <em>再进入控制台生成日报</em>
                <em>需要时开启 forceReanalyze</em>
              </div>
            </div>
          </template>
          <el-empty
            v-else
            description="聊天日报仅超级管理员可用，普通账号请继续在本页联调聊天；需要日报时请联系超级管理员前往控制台处理。"
            :image-size="100"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page{min-height:100vh;padding:24px;background:linear-gradient(180deg,#edf4ff,#dfeaf8)}.page--embedded{min-height:auto;padding:0;background:transparent}.hero,.panel,.composer,.card{background:rgba(255,255,255,.88);box-shadow:0 18px 40px rgba(15,23,42,.08)}.hero{display:flex;justify-content:space-between;gap:20px;padding:24px;border-radius:28px}.kicker{display:inline-flex;padding:6px 12px;border-radius:999px;background:rgba(37,99,235,.08);color:#2563eb;font-size:12px;font-weight:700;text-transform:uppercase}.hero h1{margin:12px 0 8px;font-size:clamp(30px,4vw,44px);color:#0f172a}.hero p{margin:0;max-width:760px;color:#475569;line-height:1.8}.chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-content:flex-start}.chip{display:inline-flex;align-items:center;min-height:38px;padding:0 14px;border-radius:999px;background:#fff;color:#334155}.grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.95fr);gap:20px;margin-top:20px}.left,.right{display:flex;flex-direction:column;gap:20px}.stage{position:relative;min-height:62vh;border-radius:32px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#06111f,#101d2e);box-shadow:0 28px 60px rgba(15,23,42,.22)}#digital-human-video{width:min(760px,78vw);max-height:88%;object-fit:contain}.placeholder{position:absolute;inset:auto 24px 24px;z-index:2;padding:14px 16px;border-radius:18px;background:rgba(8,15,28,.54);color:#fff;line-height:1.7}.bubble{position:absolute;top:24px;left:24px;z-index:3;width:min(420px,calc(100% - 48px));padding:18px;border-radius:24px;background:rgba(255,255,255,.96);box-shadow:0 20px 44px rgba(15,23,42,.18)}.bubble-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;color:#1d4ed8;font-size:13px;font-weight:700}.bubble p,.msg-body p,.summary-block p{margin:0;white-space:pre-wrap;word-break:break-word;line-height:1.8}.stats,.state-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.card{padding:16px 18px;border-radius:22px}.card span,.summary-block span,.summary-box span{display:block;color:#64748b;font-size:13px}.card strong,.summary-box strong{display:block;margin-top:8px;color:#0f172a;font-size:16px;line-height:1.6;word-break:break-word}.composer{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:12px;padding:18px;border-radius:28px}.composer :deep(.el-input__wrapper){min-height:56px;border-radius:18px}.composer :deep(.el-button){min-height:56px;border-radius:18px}.voice{min-width:128px;min-height:56px;border:0;border-radius:18px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;font-weight:700;cursor:pointer}.voice.recording{background:linear-gradient(135deg,#ef4444,#dc2626)}.panel{padding:18px;border-radius:28px}.panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.panel-head h2{margin:0;font-size:22px;color:#10233e}.stream{display:flex;flex-direction:column;gap:14px;min-height:300px;max-height:420px;overflow-y:auto}.message{display:flex;gap:12px;align-items:flex-start}.message.user,.message.voice{flex-direction:row-reverse}.avatar{width:42px;height:42px;flex:0 0 42px;display:inline-flex;align-items:center;justify-content:center;border-radius:14px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);color:#1d4ed8;font-size:12px;font-weight:700}.message.agent .avatar{background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#15803d}.message.system .avatar{background:linear-gradient(135deg,#e2e8f0,#cbd5e1);color:#334155}.msg-body{max-width:min(84%,520px);padding:14px 16px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0}.message.user .msg-body,.message.voice .msg-body{background:linear-gradient(135deg,#409eff,#1d4ed8);border-color:transparent;color:#fff}.role{margin-bottom:8px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase}.message.user .role,.message.voice .role{color:rgba(255,255,255,.78)}.prompt{margin-top:16px;padding:16px;border-radius:22px;background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(15,118,110,.08))}.prompt p{margin:8px 0 0;color:#475569;line-height:1.7}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px}.summary,.summary-box{padding:16px;border-radius:22px;background:linear-gradient(135deg,rgba(16,185,129,.08),rgba(59,130,246,.08))}.summary-box{display:flex;justify-content:space-between;gap:18px}.summary-block{margin-top:16px}.tags{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.tags em{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;background:rgba(37,99,235,.08);color:#1d4ed8;font-style:normal}.bubble-fade-enter-active,.bubble-fade-leave-active{transition:opacity .28s ease,transform .28s ease}.bubble-fade-enter-from,.bubble-fade-leave-to{opacity:0;transform:translateY(-12px) scale(.96)}@media (max-width:1180px){.grid{grid-template-columns:1fr}.stage{min-height:52vh}}@media (max-width:900px){.page{padding:16px}.page--embedded{padding:0}.hero{flex-direction:column}.chips{justify-content:flex-start}.stats,.state-grid{grid-template-columns:1fr}.composer{grid-template-columns:1fr}.voice,.composer :deep(.el-button){width:100%}}@media (max-width:640px){.hero h1{font-size:28px}.bubble{top:16px;left:16px;width:min(360px,calc(100% - 32px))}.summary-box{flex-direction:column;align-items:flex-start}}
</style>
