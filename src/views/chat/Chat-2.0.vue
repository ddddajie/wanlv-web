<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Microphone, Promotion } from '@element-plus/icons-vue'
import { pinia, useUserStore } from '@/stores'
import {
  agentChatApi,
  fetchDigitalHuman,
  fetchInterruptTalk,
  sendWebRTCOffer,
} from '@/api/chat'

const props = defineProps({
  embedded: {
    type: Boolean,
    default: false,
  },
  headerTarget: {
    type: String,
    default: '',
  },
})

const route = useRoute()
const userStore = useUserStore(pinia)

const STUN_SERVER = 'stun:stun.l.google.com:19302'
const SPEECH_START_DELAY = 1200
const BASE_CHAR_INTERVAL = 185
const FINISHED_HIDE_DELAY = 900
const MOBILE_BREAKPOINT = 768
const PC_DIGITAL_HUMAN_RENDER_CONFIG = Object.freeze({ width: 540, height: 960, fps: 30 })
const MOBILE_DIGITAL_HUMAN_RENDER_CONFIG = Object.freeze({ width: 270, height: 480, fps: 18 })
const DIGITAL_HUMAN_AVATAR_STORAGE_KEY = 'wanlv:selected-digital-human-avatar'
const SCENIC_NAME_CACHE_KEY = 'wanlv:scenic-area-name-cache'

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
const connectionStatus = ref('disconnected')
const digitalHumanSessionId = ref(0)
const isVoiceRecording = ref(false)
const messages = ref([])
const chatArea = ref(null)
const digitalHumanVideo = ref(null)
const digitalHumanCanvas = ref(null)
const pc = ref(null)
const mediaRecorder = ref(null)
const recognition = ref(null)
const speechState = ref('idle')
const aiBubbleVisible = ref(false)
const aiBubbleText = ref('')
const aiBubbleFullText = ref('')
const isMobile = ref(false)
const renderFallbackActive = ref(false)
const avatarDrawerVisible = ref(false)
const selectedAvatarId = ref(digitalHumanAvatars[0].id)

const chatState = reactive({
  scenicAreaId: null,
})

let speechStartTimer = null
let speechTypeTimer = null
let bubbleHideTimer = null
let activeSpeechToken = 0
let digitalHumanRenderer = null

const toPositiveNumber = (value) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

const readScenicNameCache = () => {
  try {
    return JSON.parse(localStorage.getItem(SCENIC_NAME_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

const currentUserId = computed(() => toPositiveNumber(userStore.userId))
const routeScenicAreaId = computed(() => toPositiveNumber(route.query.scenicAreaId))
const routeScenicAreaName = computed(() =>
  (typeof route.query.scenicAreaName === 'string' ? route.query.scenicAreaName.trim() : '') ||
  (routeScenicAreaId.value ? readScenicNameCache()[String(routeScenicAreaId.value)] || '' : ''),
)
const statusText = computed(() => ({ connected: '已连接', connecting: '连接中...', disconnected: '未连接' }[connectionStatus.value] || '未连接'))
const statusType = computed(() => ({ connected: 'success', connecting: 'warning', disconnected: 'info' }[connectionStatus.value] || 'info'))
const bubbleStatusText = computed(() => ({ idle: '待命中', queued: '准备播报', speaking: '播报中', finished: '播报完成' }[speechState.value] || '待命中'))
const enabledDigitalHumanAvatars = computed(() => digitalHumanAvatars.filter((item) => item.enabled))
const selectedAvatar = computed(() =>
  enabledDigitalHumanAvatars.value.find((item) => item.id === selectedAvatarId.value) || enabledDigitalHumanAvatars.value[0],
)

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
  chatState.scenicAreaId = payload.scenicAreaId ?? chatState.scenicAreaId
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

const getDigitalHumanRenderConfig = () =>
  isMobile.value ? MOBILE_DIGITAL_HUMAN_RENDER_CONFIG : PC_DIGITAL_HUMAN_RENDER_CONFIG

class DigitalHumanRenderer {
  constructor(canvas, getConfig) {
    this.canvas = canvas
    this.getConfig = getConfig
    this.video = null
    this.gl = null
    this.program = null
    this.texture = null
    this.positionBuffer = null
    this.texCoordBuffer = null
    this.frameId = null
    this.running = false
    this.lastRenderTime = 0
    this.locations = null
  }

  start(videoElement) {
    this.stop()
    this.video = videoElement
    if (!this.canvas || !this.video || !this.initWebGL()) return false
    this.resize()
    this.running = true
    this.lastRenderTime = 0
    this.frameId = window.requestAnimationFrame((time) => this.render(time))
    return true
  }

  stop() {
    if (this.frameId) window.cancelAnimationFrame(this.frameId)
    this.frameId = null
    this.running = false
    this.clear()
  }

  resize() {
    if (!this.canvas || !this.gl) return
    const { width, height } = this.getConfig()
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
    this.gl.viewport(0, 0, width, height)
  }

  destroy() {
    this.stop()
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture)
      if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer)
      if (this.texCoordBuffer) this.gl.deleteBuffer(this.texCoordBuffer)
      if (this.program) this.gl.deleteProgram(this.program)
    }
    this.video = null
    this.gl = null
    this.program = null
    this.texture = null
    this.positionBuffer = null
    this.texCoordBuffer = null
    this.locations = null
  }

  initWebGL() {
    if (this.gl && this.program) return true
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    })
    if (!gl) return false

    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `)
    const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D u_video;
      varying vec2 v_texCoord;
      void main() {
        vec4 color = texture2D(u_video, v_texCoord);
        float maxRedBlue = max(color.r, color.b);
        float greenScore = color.g - maxRedBlue;
        float greenDominant = step(0.35, color.g) * step(0.11, greenScore) *
          step(color.r * 1.18, color.g) * step(color.b * 1.18, color.g);
        float matte = smoothstep(0.11, 0.34, greenScore) * greenDominant;
        if (matte > 0.96) discard;
        float alpha = 1.0 - matte;
        color.g = mix(min(color.g, maxRedBlue * 0.92), color.g, step(0.98, alpha));
        gl_FragColor = vec4(color.rgb, alpha);
      }
    `)
    const program = this.createProgram(gl, vertexShader, fragmentShader)
    if (!program) return false

    this.gl = gl
    this.program = program
    this.locations = {
      position: gl.getAttribLocation(program, 'a_position'),
      texCoord: gl.getAttribLocation(program, 'a_texCoord'),
      video: gl.getUniformLocation(program, 'u_video'),
    }
    this.positionBuffer = this.createBuffer(gl, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ]))
    this.texCoordBuffer = this.createBuffer(gl, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]))
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)
    return true
  }

  createShader(gl, type, source) {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Digital human shader compile failed:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  createProgram(gl, vertexShader, fragmentShader) {
    if (!vertexShader || !fragmentShader) return null
    const program = gl.createProgram()
    if (!program) return null
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Digital human shader link failed:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }
    return program
  }

  createBuffer(gl, data) {
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    return buffer
  }

  clear() {
    if (!this.gl || !this.canvas) return
    this.gl.viewport(0, 0, this.canvas.width || 1, this.canvas.height || 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  render(time) {
    if (!this.running || !this.gl || !this.video) return
    const { fps } = this.getConfig()
    const frameInterval = 1000 / fps
    if (time - this.lastRenderTime >= frameInterval) {
      this.drawFrame()
      this.lastRenderTime = time
    }
    this.frameId = window.requestAnimationFrame((nextTime) => this.render(nextTime))
  }

  drawFrame() {
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !this.video.videoWidth || !this.video.videoHeight) return
    const gl = this.gl
    this.resize()
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    // 视频帧作为 WebGL 纹理时需要翻转 Y 轴，避免数字人上下颠倒。
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video)
    gl.uniform1i(this.locations.video, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(this.locations.position)
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.enableVertexAttribArray(this.locations.texCoord)
    gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}

const getDigitalHumanRenderer = () => {
  if (!digitalHumanCanvas.value) return null
  if (digitalHumanRenderer && digitalHumanRenderer.canvas !== digitalHumanCanvas.value) {
    digitalHumanRenderer.destroy()
    digitalHumanRenderer = null
  }
  if (!digitalHumanRenderer) {
    digitalHumanRenderer = new DigitalHumanRenderer(digitalHumanCanvas.value, getDigitalHumanRenderConfig)
  }
  return digitalHumanRenderer
}

const stopDigitalHumanRender = () => {
  digitalHumanRenderer?.stop()
}

const startDigitalHumanRender = async () => {
  const video = digitalHumanVideo.value
  const renderer = getDigitalHumanRenderer()
  if (!video || !renderer) return
  stopDigitalHumanRender()
  await nextTick()
  try {
    await video.play()
  } catch (error) {
    console.warn('Digital human video autoplay failed:', error)
  }
  renderFallbackActive.value = !renderer.start(video)
}

const attachDigitalHumanVideoStream = async (stream) => {
  const video = digitalHumanVideo.value || document.getElementById('digital-human-video')
  if (!video) return
  renderFallbackActive.value = false
  stopDigitalHumanRender()
  video.srcObject = stream
  video.onloadedmetadata = startDigitalHumanRender
  video.onplaying = startDigitalHumanRender
  /* 数字人视频作为 WebGL 纹理源，连接后由 shader 完成绿幕抠像。 */
  await startDigitalHumanRender()
}

const clearDigitalHumanMedia = () => {
  stopDigitalHumanRender()
  renderFallbackActive.value = false
  const video = digitalHumanVideo.value || document.getElementById('digital-human-video')
  const audio = document.getElementById('digital-human-audio')
  if (video) {
    video.onloadedmetadata = null
    video.onplaying = null
    video.srcObject = null
  }
  if (audio) audio.srcObject = null
}

const cleanupPeerConnection = () => {
  clearDigitalHumanMedia()
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
      if (event.track.kind === 'video') {
        attachDigitalHumanVideoStream(event.streams[0])
        return
      }
      if (element) element.srcObject = event.streams[0]
    })
    pc.value.addEventListener('connectionstatechange', () => {
      const state = pc.value?.connectionState
      if (state === 'connected') return (connectionStatus.value = 'connected')
      if (['disconnected', 'failed', 'closed'].includes(state)) {
        connectionStatus.value = 'disconnected'
        clearDigitalHumanMedia()
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
  userInput.value = ''
  loading.value = true
  try {
    const result = await agentChatApi({
      userId: currentUserId.value,
      content: messageType === 'voice' ? undefined : message,
      messageType,
      voiceText: messageType === 'voice' ? message : null,
      scenicAreaId: chatState.scenicAreaId ?? routeScenicAreaId.value,
      scenicAreaSource: routeScenicAreaId.value ? 'FRONTEND' : null,
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

const handleConnectDigitalHuman = () => {
  connectionStatus.value = 'connecting'
  start()
}

const openAvatarSelector = () => {
  avatarDrawerVisible.value = true
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
  digitalHumanRenderer?.resize()
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
  digitalHumanRenderer?.destroy()
  digitalHumanRenderer = null
  window.removeEventListener('resize', syncScreenMode)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('unload', handleBeforeUnload)
})
</script>

<template>
  <div class="page" :class="{ 'page--embedded': embedded }">
    <Teleport v-if="headerTarget" :to="headerTarget">
      <div class="chat-titlebar-actions">
        <el-tag :type="statusType" effect="dark" round>{{ statusText }}</el-tag>
        <el-button v-if="connectionStatus !== 'connected'" class="chat-titlebar-connect" plain type="success"
          round :loading="connectionStatus === 'connecting'" @click="handleConnectDigitalHuman">
          {{ connectionStatus === 'connecting' ? '连接中' : isMobile ? '连接' : '连接数字人' }}
        </el-button>
        <el-button v-else class="chat-titlebar-connect" plain type="danger" round @click="stop()">
          {{ isMobile ? '断开' : '断开连接' }}
        </el-button>
        <button type="button" class="chat-titlebar-switch" @click="openAvatarSelector">切换形象</button>
      </div>
    </Teleport>

    <template v-if="!isMobile">
      <section class="grid">
        <div class="left">
          <div class="panel">
            <div ref="chatArea" class="stream">
              <el-empty v-if="!messages.length && !loading" description="开始发送第一条消息吧" :image-size="110" />
              <div v-for="message in messages" :key="message.id" class="message" :class="message.type">
                <div class="avatar">{{ message.type === 'agent' ? 'AI' : message.type === 'system' ? 'SYS' : '我' }}
                </div>
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
                  <p>正在思考...</p>
                </div>
              </div>
            </div>
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
          </div>
        </div>

        <div class="right">
          <div class="stage">
            <video id="digital-human-video" ref="digitalHumanVideo" class="digital-human-source"
              :class="{ 'digital-human-source--fallback': renderFallbackActive }" autoplay playsinline muted></video>
            <canvas ref="digitalHumanCanvas" class="digital-human-canvas"
              :class="{ 'digital-human-canvas--hidden': renderFallbackActive }" aria-label="透明背景数字人"></canvas>
            <audio id="digital-human-audio" autoplay></audio>
            <div v-if="connectionStatus !== 'connected'" class="desktop-placeholder">数字人未连接，可直接问答</div>
          </div>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="mobile-shell">
        <section ref="chatArea" class="stream mobile-chat-panel">
          <div class="mobile-digital-human-window" :class="{ 'mobile-digital-human-window--active': connectionStatus === 'connected' }"
            :aria-hidden="connectionStatus !== 'connected'">
            <video id="digital-human-video" ref="digitalHumanVideo" class="digital-human-source"
              :class="{ 'digital-human-source--fallback': renderFallbackActive }" autoplay playsinline muted></video>
            <canvas ref="digitalHumanCanvas" class="digital-human-canvas"
              :class="{ 'digital-human-canvas--hidden': renderFallbackActive }" aria-label="透明背景数字人"></canvas>
            <audio id="digital-human-audio" autoplay></audio>
          </div>

          <div v-if="connectionStatus !== 'connected'" class="mobile-system-tip">
            连接数字人后可同步播报回复；不连接也能正常文字问答。
          </div>
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
              <p>正在思考...</p>
            </div>
          </div>
        </section>

        <section class="mobile-composer">
          <el-input v-model="userInput" class="mobile-input" size="large" clearable :disabled="loading"
            placeholder="请输入你想咨询的问题..." @keydown.enter.prevent="sendChatMessage()" />
          <el-button class="mobile-send" type="primary" circle :loading="loading" aria-label="发送"
            @click="sendChatMessage()">
            <el-icon v-if="!loading"><Promotion /></el-icon>
          </el-button>
          <button type="button" class="voice mobile-voice" :class="{ recording: isVoiceRecording }"
            :aria-label="isVoiceRecording ? '松开发送' : '按住说话'" :title="isVoiceRecording ? '松开发送' : '按住说话'"
            @mousedown="handleVoiceRecordStart" @mouseup="handleVoiceRecordStop" @mouseleave="handleVoiceRecordStop"
            @touchstart.prevent="handleVoiceRecordStart" @touchend="handleVoiceRecordStop">
            <el-icon><Microphone /></el-icon>
          </button>
        </section>

      </section>
    </template>

    <el-dialog v-model="avatarDrawerVisible" title="选择数字人形象" :width="isMobile ? '88vw' : '420px'"
      class="avatar-dialog" append-to-body>
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
    </el-dialog>
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  min-height: 0;
  padding: 24px;
  overflow: hidden;
  background: linear-gradient(180deg, #edf4ff, #dfeaf8);
  box-sizing: border-box
}

.page--embedded {
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  background: transparent
}

.panel,
.composer {
  background: transparent;
  box-shadow: none
}

.chat-titlebar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  justify-content: flex-end
}

.chat-titlebar-switch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: #1d4ed8;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, .08)
}

.chat-titlebar-connect {
  min-height: 38px;
  margin: 0;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(15, 23, 42, .08)
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(230px, 18vw, 280px);
  gap: 0;
  height: calc(100vh - 48px);
  min-height: 0;
  margin-top: 0;
  align-items: stretch;
  overflow: hidden;
  border-radius: 28px;
  background: rgba(255, 255, 255, .9);
  box-shadow: 0 18px 40px rgba(15, 23, 42, .08)
}

.page--embedded .grid {
  height: 100%
}

.left,
.right {
  display: flex;
  flex-direction: column;
  gap: 0
}

.left {
  min-height: 0;
  padding: 24px 20px 20px;
  overflow: hidden
}

.right {
  /* 左右内容属于同一个问答工作区，仅用细线区分数字人展示区域。 */
  align-items: center;
  padding: 18px 12px 20px;
  border-left: 1px solid #e5e7eb;
  overflow: hidden
}

.stage {
  position: relative;
  width: 100%;
  max-width: 230px;
  height: 360px;
  flex: 0 0 360px;
  border-radius: 0;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: transparent;
  box-shadow: none
}

.digital-human-source {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none
}

.digital-human-source--fallback {
  position: static;
  width: 190px;
  height: auto;
  aspect-ratio: 9 / 16;
  opacity: 1;
  object-fit: contain
}

.digital-human-canvas {
  width: 190px;
  height: auto;
  aspect-ratio: 9 / 16;
  object-fit: contain
}

.digital-human-canvas--hidden {
  display: none
}

.msg-body p {
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

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12px;
  flex: 0 0 auto;
  margin-top: auto;
  padding: 18px 0 0;
  border-top: 1px solid #eef2f7;
  border-radius: 0;
  z-index: 6
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
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 0 18px;
  border-radius: 0
}

.stream {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
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

.desktop-placeholder {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  z-index: 2;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(15, 23, 42, .68);
  color: #fff;
  font-size: 13px;
  line-height: 1.5
}

.mobile-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 56px);
  min-height: 0;
  padding-bottom: 104px;
  overflow: hidden
}

.mobile-composer {
  border-radius: 18px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 12px 28px rgba(15, 23, 42, .08)
}

.mobile-chat-panel {
  flex: 1 1 auto;
  min-height: 0;
  gap: 12px;
  padding: 4px 2px 10px;
  overflow-y: auto
}

.mobile-digital-human-window {
  position: fixed;
  top: 66px;
  right: 18px;
  z-index: 18;
  width: 86px;
  height: 136px;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: 18px;
  background: rgba(255, 255, 255, .7);
  box-shadow: 0 14px 32px rgba(15, 23, 42, .16);
  opacity: 0;
  transform: translateY(-6px);
  pointer-events: none;
  transition: opacity .18s ease, transform .18s ease
}

.mobile-digital-human-window--active {
  opacity: 1;
  transform: translateY(0)
}

.mobile-digital-human-window .digital-human-canvas,
.mobile-digital-human-window .digital-human-source--fallback {
  width: 86px;
  height: 136px;
  object-fit: contain
}

.mobile-system-tip {
  align-self: flex-start;
  max-width: min(86%, 330px);
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(15, 23, 42, .58);
  color: #fff;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word
}

.mobile-chat-panel .avatar {
  width: 36px;
  height: 36px;
  flex-basis: 36px;
  border-radius: 12px
}

.mobile-chat-panel .msg-body {
  max-width: min(82%, 320px);
  padding: 11px 12px;
  border-radius: 16px
}

.mobile-composer {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 22px
}

.mobile-input :deep(.el-input__wrapper) {
  min-height: 44px;
  border-radius: 999px
}

.mobile-input {
  min-width: 0;
  flex: 1
}

.mobile-send,
.mobile-voice {
  width: 42px;
  height: 42px;
  min-width: 42px;
  min-height: 42px;
  flex: 0 0 42px;
  padding: 0;
  border-radius: 50%
}

.mobile-voice {
  display: inline-flex;
  align-items: center;
  justify-content: center
}

.mobile-send :deep(.el-icon),
.mobile-voice .el-icon {
  font-size: 19px
}

.avatar-list {
  display: grid;
  gap: 10px
}

.avatar-dialog :deep(.el-dialog) {
  border-radius: 18px
}

.avatar-dialog :deep(.el-dialog__header) {
  padding: 18px 20px 8px;
  margin-right: 0
}

.avatar-dialog :deep(.el-dialog__title) {
  color: #0f172a;
  font-size: 17px;
  font-weight: 800
}

.avatar-dialog :deep(.el-dialog__body) {
  padding: 10px 20px 20px
}

.avatar-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
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
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
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
    grid-template-columns: minmax(0, 1fr) 240px
  }

  .stage {
    height: 340px;
    flex-basis: 340px
  }

  .stream {
    min-height: 0
  }
}

@media (max-width:900px) {
  .chat-titlebar-actions {
    flex: 1;
    flex-wrap: nowrap;
    gap: 8px;
    min-width: 0
  }

  .chat-titlebar-actions :deep(.el-tag) {
    flex: 0 0 auto
  }

  .chat-titlebar-connect {
    min-height: 32px;
    padding: 0 10px;
    font-size: 12px;
    box-shadow: none
  }

  .chat-titlebar-switch {
    min-height: 32px;
    padding: 0 10px;
    font-size: 12px;
    white-space: nowrap;
    box-shadow: none
  }

  .page {
    height: auto;
    min-height: 100vh;
    overflow: visible;
    padding: 16px
  }

  .page--embedded {
    height: auto;
    min-height: auto;
    overflow: visible;
    padding: 0
  }

  .composer {
    grid-template-columns: 1fr
  }

  .voice,
  .composer :deep(.el-button) {
    width: 100%
  }
}
</style>
