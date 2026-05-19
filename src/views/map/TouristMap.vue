<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChevronDownOutline,
  CloseOutline,
  EyeOutline,
  FootstepsOutline,
  LeafOutline,
  LocationOutline,
  MapOutline,
  MicOutline,
  SparklesOutline,
  TimeOutline,
  TrailSignOutline,
} from '@vicons/ionicons5'
import { getLatestAgentRouteGeoApi, getMapInitApi, pageScenicAreasApi } from '@/api/map'
import {
  agentChatApi,
  fetchDigitalHuman,
  fetchInterruptTalk,
  sendWebRTCOffer,
} from '@/api/chat'
import { useScenicWarmReminder } from '@/composables/useScenicWarmReminder'
import { pinia, useUserStore } from '@/stores'
import { message } from '@/utils/feedback'
import MapCanvas from './MapCanvas.vue'
import UserMapControls from './UserMapControls.vue'
import { normalizePageResult } from './mapUtils'

defineProps({
  headerTarget: {
    type: String,
    default: '',
  },
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStore(pinia)
const SCENIC_NAME_CACHE_KEY = 'wanlv:scenic-area-name-cache'
const STUN_SERVER = 'stun:stun.l.google.com:19302'
const DIGITAL_HUMAN_API_URL =
  import.meta.env.VITE_DIGITAL_HUMAN_GUIDE_API_URL ||
  import.meta.env.VITE_DIGITAL_HUMAN_API_URL ||
  'http://localhost:8011'

const scenicOptions = ref([])
const selectedScenicId = ref(null)
const mapData = ref(null)
const selectedSpot = ref(null)
const isLoadingScenic = ref(false)
const isLoadingMap = ref(false)
const isLoadingAgentRoute = ref(false)
const isScenicInfoOpen = ref(false)
const isRoutePanelOpen = ref(false)
const visibleRouteIds = ref([])
const mapCanvasRef = ref(null)
const agentRoute = ref(null)
const isDigitalHumanOpen = ref(false)
const digitalHumanVideoRef = ref(null)
const digitalHumanCanvasRef = ref(null)
const digitalHumanAudioRef = ref(null)
const digitalHumanPc = ref(null)
const digitalHumanSessionId = ref(0)
const digitalHumanStatus = ref('disconnected')
const digitalHumanInput = ref('')
const digitalHumanLoading = ref(false)
const digitalHumanReply = ref('')
const digitalHumanRenderFallback = ref(false)
const isDigitalHumanVoiceRecording = ref(false)
const digitalHumanMediaRecorder = ref(null)
const digitalHumanRecognition = ref(null)

let digitalHumanRenderer = null

const scenicArea = computed(() => mapData.value?.scenicArea || null)
const spots = computed(() => mapData.value?.spots || [])
const routes = computed(() => mapData.value?.routes || [])
const geoFeatures = computed(() => mapData.value?.geoFeatures || [])
const displayRoutes = computed(() => (agentRoute.value ? [agentRoute.value, ...routes.value] : routes.value))
const displayMapData = computed(() =>
  mapData.value
    ? {
      ...mapData.value,
      routes: displayRoutes.value,
    }
    : mapData.value,
)
const currentUserId = computed(() => {
  const userId = Number(userStore.userId)
  return Number.isFinite(userId) && userId > 0 ? userId : null
})
const digitalHumanStatusText = computed(() => ({
  connected: '已连接',
  connecting: '连接中',
  disconnected: '未连接',
}[digitalHumanStatus.value] || '未连接'))

const enabledScenicOptions = computed(() =>
  scenicOptions.value.filter((item) => Number(item.status) === 1 || Number(item.id) === Number(selectedScenicId.value)),
)

// 重点：Naive UI Select 使用统一的 label/value 结构，避免模板里重复转换景区数据。
const scenicSelectOptions = computed(() =>
  enabledScenicOptions.value.map((item) => ({
    label: item.scenicName,
    value: item.id,
  })),
)

const officialRoutes = computed(() =>
  routes.value.filter((item) => String(item.routeType || '').trim().toLowerCase() === 'official'),
)

const recommendedRoutes = computed(() => (agentRoute.value ? [agentRoute.value, ...officialRoutes.value] : officialRoutes.value))

const highlightedSpots = computed(() =>
  spots.value
    .filter((item) => String(item.poiType || '').trim() === 'SCENIC_SPOT')
    .slice()
    .sort((a, b) => (Number(b.recommendedLevel) || 0) - (Number(a.recommendedLevel) || 0))
    .slice(0, 6),
)

const scenicLocationText = computed(() => {
  const parts = [scenicArea.value?.province, scenicArea.value?.city, scenicArea.value?.district].filter(Boolean)
  return parts.length ? parts.join(' · ') : scenicArea.value?.address || '景区位置待完善'
})
const scenicLevelText = computed(() => scenicArea.value?.scenicLevel || scenicArea.value?.levelName || scenicArea.value?.grade || '国家 AAAAA 级旅游景区')
const scenicWarmReminderName = computed(() => getSelectedScenicName(selectedScenicId.value))

useScenicWarmReminder({
  scenicAreaId: selectedScenicId,
  scenicAreaName: scenicWarmReminderName,
})

const mapLegendItems = [
  { label: '步行道路', color: '#cbd5e1' },
  { label: '车行道路', color: '#fdba74' },
  { label: '游览步道', color: '#86efac' },
  { label: '服务通道', color: '#93c5fd' },
]

function readScenicNameCache() {
  try {
    return JSON.parse(localStorage.getItem(SCENIC_NAME_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function cacheScenicNames(rows = []) {
  const nextCache = readScenicNameCache()
  rows.forEach((item) => {
    if (item?.id && item?.scenicName) {
      nextCache[String(item.id)] = item.scenicName
    }
  })
  localStorage.setItem(SCENIC_NAME_CACHE_KEY, JSON.stringify(nextCache))
}

function getSelectedScenicName(id = selectedScenicId.value) {
  return (
    scenicOptions.value.find((item) => Number(item.id) === Number(id))?.scenicName ||
    scenicArea.value?.scenicName ||
    readScenicNameCache()[String(id)] ||
    ''
  )
}

function createAgentRouteId(id) {
  const routeId = Number(id)
  return Number.isFinite(routeId) ? -100000000 - routeId : `agent-${Date.now()}`
}

function parseSpotNamesText(value) {
  if (!value) return ''

  try {
    const names = JSON.parse(value)
    return Array.isArray(names) ? names.filter(Boolean).join('、') : ''
  } catch {
    return ''
  }
}

function normalizeAgentRoute(data) {
  if (!data?.geojson) return null

  return {
    ...data,
    // 专属路线使用前端临时 ID，避免和官方路线 ID 撞号后影响地图开关。
    id: createAgentRouteId(data.id),
    agentRouteGeoId: data.id,
    routeType: 'agent_custom',
    routeName: data.routeName || '我的专属路线',
    description: parseSpotNamesText(data.spotNamesJson),
    status: 1,
  }
}

async function fetchLatestAgentRoute() {
  agentRoute.value = null
  if (!userStore.isLoggedIn || !userStore.userId || !selectedScenicId.value) return

  isLoadingAgentRoute.value = true
  try {
    const result = await getLatestAgentRouteGeoApi({
      userId: userStore.userId,
      scenicAreaId: Number(selectedScenicId.value),
    })
    agentRoute.value = normalizeAgentRoute(result)
  } catch (error) {
    console.error('Failed to load latest agent route:', error)
  } finally {
    isLoadingAgentRoute.value = false
  }
}

function syncRouteQuery(id) {
  const scenicName = getSelectedScenicName(id)
  router.replace({
    query: {
      ...route.query,
      scenicAreaId: id || undefined,
      scenicAreaName: scenicName || undefined,
    },
  })
}

async function fetchScenicOptions() {
  isLoadingScenic.value = true
  try {
    const result = await pageScenicAreasApi({ current: 1, size: 100, status: 1 })
    const page = normalizePageResult(result)
    scenicOptions.value = page.records
    cacheScenicNames(page.records)

    const queryId = Number(route.query.scenicAreaId)
    const firstId = queryId || page.records[0]?.id
    if (firstId) {
      selectedScenicId.value = Number(firstId)
    }
  } finally {
    isLoadingScenic.value = false
  }
}

async function fetchMapData() {
  if (!selectedScenicId.value) return

  isLoadingMap.value = true
  selectedSpot.value = null
  try {
    mapData.value = await getMapInitApi(Number(selectedScenicId.value))
    cacheScenicNames([mapData.value?.scenicArea])
    syncRouteQuery(selectedScenicId.value)
    await fetchLatestAgentRoute()
    visibleRouteIds.value = recommendedRoutes.value.filter(hasRouteGeojson).map((item) => item.id).filter(Boolean).slice(0, 2)
    await nextTick()
    mapCanvasRef.value?.resize()
  } catch (error) {
    console.error('Failed to load tourist map:', error)
    message.error('景区地图加载失败，请稍后再试')
  } finally {
    isLoadingMap.value = false
  }
}

function handleScenicChange(value) {
  selectedScenicId.value = value
  syncRouteQuery(value)
}

function handleSpotClick(id) {
  selectedSpot.value = spots.value.find((item) => Number(item.id) === Number(id)) || null
  isScenicInfoOpen.value = true
}

function toggleRoute(routeId) {
  const route = recommendedRoutes.value.find((item) => String(item.id) === String(routeId))
  if (!hasRouteGeojson(route)) {
    message.warning('该路线暂未配置轨迹')
    return
  }

  const normalizedId = String(routeId)

  visibleRouteIds.value = visibleRouteIds.value.some((item) => String(item) === normalizedId)
    ? visibleRouteIds.value.filter((item) => String(item) !== normalizedId)
    : [...visibleRouteIds.value, routeId]
}

function isRouteVisible(routeId) {
  return visibleRouteIds.value.some((item) => String(item) === String(routeId))
}

function hasRouteGeojson(route) {
  return Boolean(route?.geojson)
}

function formatRouteDuration(route) {
  const minutes = Number(route?.durationMinutes)
  if (!Number.isFinite(minutes) || minutes <= 0) return '时长待定'
  if (minutes < 60) return `${minutes} 分钟`

  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours} 小时` : `${hours.toFixed(1)} 小时`
}

function getRouteDesc(route) {
  return route?.description || route?.recommendedReason || route?.suitableCrowd || '适合按图快速浏览景区重点节点，路线详情会随地图轨迹同步展示。'
}

function getRouteTags(route) {
  const tags = [
    formatRouteDuration(route),
    route?.routeType === 'agent_custom' ? '专属推荐' : '官方路线',
    route?.suitableCrowd || (route?.routeType === 'agent_custom' ? '个性游览' : '经典打卡'),
  ]

  return tags.filter(Boolean).slice(0, 3)
}

class DigitalHumanRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.video = null
    this.gl = null
    this.program = null
    this.texture = null
    this.positionBuffer = null
    this.texCoordBuffer = null
    this.frameId = null
    this.running = false
    this.locations = null
  }

  start(video) {
    this.stop()
    this.video = video
    if (!this.canvas || !this.video || !this.initWebGL()) return false
    this.resize()
    this.running = true
    this.frameId = window.requestAnimationFrame(() => this.render())
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
    const width = 270
    const height = 480
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
    this.positionBuffer = this.createBuffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]))
    this.texCoordBuffer = this.createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]))
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

  render() {
    if (!this.running || !this.gl || !this.video) return
    if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.video.videoWidth && this.video.videoHeight) {
      const gl = this.gl
      this.resize()
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(this.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      // 重点：视频帧作为 WebGL 纹理时翻转 Y 轴，再用 shader 去除绿幕背景。
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
    this.frameId = window.requestAnimationFrame(() => this.render())
  }
}

function getDigitalHumanRenderer() {
  if (!digitalHumanCanvasRef.value) return null
  if (!digitalHumanRenderer || digitalHumanRenderer.canvas !== digitalHumanCanvasRef.value) {
    digitalHumanRenderer?.destroy()
    digitalHumanRenderer = new DigitalHumanRenderer(digitalHumanCanvasRef.value)
  }
  return digitalHumanRenderer
}

async function startDigitalHumanRender() {
  const video = digitalHumanVideoRef.value
  const renderer = getDigitalHumanRenderer()
  if (!video || !renderer) return
  digitalHumanRenderer?.stop()
  await nextTick()
  try {
    await video.play()
  } catch (error) {
    console.warn('Digital human video autoplay failed:', error)
  }
  digitalHumanRenderFallback.value = !renderer.start(video)
}

function stopDigitalHumanRender() {
  digitalHumanRenderer?.stop()
  digitalHumanRenderFallback.value = false
}

function clearDigitalHumanMedia() {
  stopDigitalHumanRender()
  if (digitalHumanVideoRef.value) {
    digitalHumanVideoRef.value.onloadedmetadata = null
    digitalHumanVideoRef.value.onplaying = null
    digitalHumanVideoRef.value.srcObject = null
  }
  if (digitalHumanAudioRef.value) {
    digitalHumanAudioRef.value.srcObject = null
  }
}

function cleanupDigitalHumanConnection() {
  clearDigitalHumanMedia()
  digitalHumanPc.value?.close()
  digitalHumanPc.value = null
  digitalHumanSessionId.value = 0
  digitalHumanStatus.value = 'disconnected'
}

async function negotiateDigitalHuman() {
  digitalHumanPc.value.addTransceiver('video', { direction: 'recvonly' })
  digitalHumanPc.value.addTransceiver('audio', { direction: 'recvonly' })
  const offer = await digitalHumanPc.value.createOffer()
  await digitalHumanPc.value.setLocalDescription(offer)
  await new Promise((resolve) => {
    if (digitalHumanPc.value.iceGatheringState === 'complete') {
      resolve()
      return
    }

    const handler = () => {
      if (digitalHumanPc.value?.iceGatheringState === 'complete') {
        digitalHumanPc.value.removeEventListener('icegatheringstatechange', handler)
        resolve()
      }
    }
    digitalHumanPc.value.addEventListener('icegatheringstatechange', handler)
  })

  const response = await sendWebRTCOffer(
    { sdp: digitalHumanPc.value.localDescription.sdp, type: digitalHumanPc.value.localDescription.type },
    DIGITAL_HUMAN_API_URL,
  )
  digitalHumanSessionId.value = response.data.sessionid
  await digitalHumanPc.value.setRemoteDescription(response.data)
}

async function startDigitalHuman() {
  if (digitalHumanStatus.value === 'connecting' || digitalHumanStatus.value === 'connected') return

  digitalHumanStatus.value = 'connecting'
  try {
    digitalHumanPc.value = new RTCPeerConnection({
      sdpSemantics: 'unified-plan',
      iceServers: [{ urls: [STUN_SERVER] }],
    })
    digitalHumanPc.value.addEventListener('track', (event) => {
      if (event.track.kind === 'video' && digitalHumanVideoRef.value) {
        digitalHumanVideoRef.value.srcObject = event.streams[0]
        digitalHumanVideoRef.value.onloadedmetadata = startDigitalHumanRender
        digitalHumanVideoRef.value.onplaying = startDigitalHumanRender
        startDigitalHumanRender()
        return
      }
      if (event.track.kind === 'audio' && digitalHumanAudioRef.value) {
        digitalHumanAudioRef.value.srcObject = event.streams[0]
      }
    })
    digitalHumanPc.value.addEventListener('connectionstatechange', () => {
      const state = digitalHumanPc.value?.connectionState
      if (state === 'connected') {
        digitalHumanStatus.value = 'connected'
        return
      }
      if (['disconnected', 'failed', 'closed'].includes(state)) {
        clearDigitalHumanMedia()
        digitalHumanStatus.value = 'disconnected'
      }
    })
    await negotiateDigitalHuman()
  } catch (error) {
    console.error('Failed to connect digital human:', error)
    cleanupDigitalHumanConnection()
    message.error(`数字人连接失败：${error.message || '请稍后再试'}`)
  }
}

async function stopDigitalHuman() {
  try {
    if (digitalHumanSessionId.value) {
      await fetchInterruptTalk({ sessionid: digitalHumanSessionId.value }, DIGITAL_HUMAN_API_URL)
    }
  } catch (error) {
    console.error('Failed to interrupt digital human:', error)
  } finally {
    cleanupDigitalHumanConnection()
  }
}

async function toggleDigitalHuman() {
  isDigitalHumanOpen.value = !isDigitalHumanOpen.value
  if (isDigitalHumanOpen.value) {
    await nextTick()
    startDigitalHuman()
    return
  }
  digitalHumanReply.value = ''
  await stopDigitalHuman()
}

function cleanDigitalHumanSpeechText(text = '') {
  return String(text)
    // 重点：数字人播报前去掉表情和 Markdown 标记，避免语音读出符号。
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, '')
    .replace(/\*\*|\*|#|\[|\]|\(|\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

async function playDigitalHumanReply(replyText) {
  const text = cleanDigitalHumanSpeechText(replyText)
  if (!text || digitalHumanStatus.value !== 'connected' || !digitalHumanSessionId.value) return

  try {
    const response = await fetchDigitalHuman(
      { type: 'echo', text, sessionid: digitalHumanSessionId.value },
      DIGITAL_HUMAN_API_URL,
    )
    if (response.data?.code !== 0) throw new Error(response.data?.msg || '数字人播报失败')
  } catch (error) {
    console.error('Failed to play digital human reply:', error)
    message.warning(error.message || '数字人播报失败')
  }
}

async function sendDigitalHumanQuestion() {
  const content = digitalHumanInput.value.trim()
  if (!content || digitalHumanLoading.value) return
  if (!currentUserId.value) {
    message.error('当前登录用户不存在，无法发起问答')
    return
  }

  digitalHumanLoading.value = true
  digitalHumanInput.value = ''
  digitalHumanReply.value = ''
  try {
    if (digitalHumanSessionId.value) {
      await fetchInterruptTalk({ sessionid: digitalHumanSessionId.value }, DIGITAL_HUMAN_API_URL)
    }
    const result = await agentChatApi({
      userId: currentUserId.value,
      content,
      messageType: 'text',
      scenicAreaId: selectedScenicId.value,
      scenicAreaSource: selectedScenicId.value ? 'FRONTEND' : null,
      sourceType: selectedScenicId.value ? 'SCENIC_DETAIL' : 'GLOBAL_CHAT',
      sourceId: selectedScenicId.value ? String(selectedScenicId.value) : null,
    })
    const reply = result?.answer || '暂时没有获取到回复。'
    digitalHumanReply.value = reply
    await playDigitalHumanReply(reply)
  } catch (error) {
    console.error('Failed to send digital human question:', error)
    message.error('这次提问没有成功送达后端，请稍后重试')
  } finally {
    digitalHumanLoading.value = false
  }
}

async function handleDigitalHumanVoiceStart() {
  if (isDigitalHumanVoiceRecording.value || digitalHumanLoading.value) return

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    digitalHumanMediaRecorder.value = new MediaRecorder(stream)
    digitalHumanMediaRecorder.value.ondataavailable = () => { }
    digitalHumanMediaRecorder.value.start()
    isDigitalHumanVoiceRecording.value = true
    digitalHumanRecognition.value?.start()
  } catch (error) {
    console.error('Failed to access microphone:', error)
    message.error('无法访问麦克风，请检查浏览器权限设置')
  }
}

function handleDigitalHumanVoiceStop() {
  if (!isDigitalHumanVoiceRecording.value || !digitalHumanMediaRecorder.value) return

  digitalHumanMediaRecorder.value.stop()
  isDigitalHumanVoiceRecording.value = false
  digitalHumanMediaRecorder.value.stream?.getTracks().forEach((track) => track.stop())
  digitalHumanRecognition.value?.stop()
  window.setTimeout(() => {
    if (digitalHumanInput.value.trim()) {
      sendDigitalHumanQuestion()
    }
  }, 500)
}

function initDigitalHumanSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return

  digitalHumanRecognition.value = new SpeechRecognition()
  digitalHumanRecognition.value.continuous = true
  digitalHumanRecognition.value.interimResults = true
  digitalHumanRecognition.value.lang = 'zh-CN'
  digitalHumanRecognition.value.onresult = (event) => {
    let transcript = ''
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript
    }
    // 重点：语音识别结果直接进入底部输入框，复用同一套数字人问答发送逻辑。
    digitalHumanInput.value = transcript.trim()
  }
}

watch(selectedScenicId, (value) => {
  if (value) fetchMapData()
})

watch(
  () => route.query.scenicAreaId,
  (value) => {
    const nextId = Number(value)
    if (Number.isFinite(nextId) && nextId > 0 && nextId !== Number(selectedScenicId.value)) {
      selectedScenicId.value = nextId
    }
  },
)

onMounted(() => {
  fetchScenicOptions()
  initDigitalHumanSpeechRecognition()
})

onUnmounted(() => {
  cleanupDigitalHumanConnection()
  if (isDigitalHumanVoiceRecording.value && digitalHumanMediaRecorder.value) {
    digitalHumanMediaRecorder.value.stop()
    digitalHumanMediaRecorder.value.stream?.getTracks().forEach((track) => track.stop())
  }
  digitalHumanRecognition.value?.stop()
  digitalHumanRenderer?.destroy()
  digitalHumanRenderer = null
})
</script>

<template>
  <section class="tourist-map relative h-full min-h-0 overflow-hidden bg-slate-200">
    <n-spin :show="isLoadingMap" class="tourist-map__spin">
      <MapCanvas ref="mapCanvasRef" :map-data="displayMapData" :visible-route-ids="visibleRouteIds"
        :show-native-controls="false" compact @spot-click="handleSpotClick" />

      <div v-if="!mapData && !isLoadingMap"
        class="tourist-map__empty absolute inset-0 grid place-items-center bg-slate-50/90">
        <n-empty description="请选择景区查看导游地图" />
      </div>
    </n-spin>

    <Teleport v-if="headerTarget" :to="headerTarget">
      <div class="tourist-map__titlebar-control">
        <n-select v-model:value="selectedScenicId" class="tourist-map__titlebar-select" :options="scenicSelectOptions"
          :loading="isLoadingScenic" placeholder="切换景区" @update:value="handleScenicChange" />
      </div>
    </Teleport>

    <header v-else class="pointer-events-none absolute left-4 right-4 top-4 z-[5]">
      <n-card class="tourist-map__top-card pointer-events-auto" size="small" :bordered="false">
        <div class="flex min-w-0 items-center gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-700 text-white shadow-sm">
            <n-icon :size="22">
              <MapOutline />
            </n-icon>
          </span>

          <div class="grid min-w-0 flex-1 gap-1">
            <span class="text-xs leading-none text-slate-500">导游地图</span>
            <n-select v-model:value="selectedScenicId" class="tourist-map__select" :options="scenicSelectOptions"
              :loading="isLoadingScenic" placeholder="切换景区" @update:value="handleScenicChange" />
          </div>
        </div>
      </n-card>
    </header>

    <aside class="pointer-events-none absolute right-1 top-4 z-[6]">
      <UserMapControls :loading="isLoadingMap" :info-open="isScenicInfoOpen" :route-open="isRoutePanelOpen"
        :digital-human-open="isDigitalHumanOpen" @locate="mapCanvasRef?.locate()" @refresh="fetchMapData"
        @toggle-info="isScenicInfoOpen = !isScenicInfoOpen" @toggle-routes="isRoutePanelOpen = !isRoutePanelOpen"
        @toggle-digital-human="toggleDigitalHuman" />
    </aside>

    <transition name="tourist-map-digital-human">
      <section v-show="isDigitalHumanOpen" class="tourist-map__digital-human" aria-label="AI 数字人问答">
        <div class="tourist-map__digital-human-stage">
          <video ref="digitalHumanVideoRef" class="tourist-map__digital-human-source"
            :class="{ 'tourist-map__digital-human-source--fallback': digitalHumanRenderFallback }" autoplay playsinline
            muted></video>
          <canvas ref="digitalHumanCanvasRef" class="tourist-map__digital-human-canvas"
            :class="{ 'tourist-map__digital-human-canvas--hidden': digitalHumanRenderFallback }"
            aria-label="透明背景数字人"></canvas>
          <audio ref="digitalHumanAudioRef" autoplay></audio>
          <div v-if="digitalHumanStatus !== 'connected'" class="tourist-map__digital-human-placeholder">
            {{ digitalHumanStatusText }}
          </div>
        </div>
      </section>
    </transition>

    <transition name="tourist-map-composer">
      <form v-show="isDigitalHumanOpen" class="tourist-map__digital-human-composer"
        @submit.prevent="sendDigitalHumanQuestion">
        <n-input v-model:value="digitalHumanInput" round clearable :disabled="digitalHumanLoading"
          placeholder="直接向数字人提问..." />
        <n-button round class="tourist-map__digital-human-voice"
          :class="{ 'tourist-map__digital-human-voice--recording': isDigitalHumanVoiceRecording }"
          :disabled="digitalHumanLoading" :title="isDigitalHumanVoiceRecording ? '松开发送' : '按住说话'"
          :aria-label="isDigitalHumanVoiceRecording ? '松开发送' : '按住说话'" @mousedown="handleDigitalHumanVoiceStart"
          @mouseup="handleDigitalHumanVoiceStop" @mouseleave="handleDigitalHumanVoiceStop"
          @touchstart.prevent="handleDigitalHumanVoiceStart" @touchend="handleDigitalHumanVoiceStop">
          <template #icon>
            <n-icon>
              <MicOutline />
            </n-icon>
          </template>
        </n-button>
        <n-button round type="primary" attr-type="submit" :loading="digitalHumanLoading"
          :disabled="!digitalHumanInput.trim()">
          发送
        </n-button>
      </form>
    </transition>

    <transition name="tourist-map-panel">
      <div v-show="isScenicInfoOpen" class="tourist-map__widgets tourist-map__widgets--info">
        <n-card class="tourist-map__widget tourist-map__info-card" :bordered="false">
          <div class="tourist-map__info-shell">
            <header class="tourist-map__panel-top">
              <div class="tourist-map__eyebrow">
                <span><n-icon>
                    <MapOutline />
                  </n-icon></span>
                景区信息
              </div>
              <button class="tourist-map__close-button" type="button" aria-label="收起景区信息"
                @click="isScenicInfoOpen = false">
                <n-icon>
                  <CloseOutline />
                </n-icon>
              </button>
            </header>

            <section class="tourist-map__info-hero">
              <div class="tourist-map__hero-art" aria-hidden="true"></div>
              <div class="tourist-map__info-hero-copy">
                <h1 class="tourist-map__info-title">{{ scenicArea?.scenicName || '请选择景区' }}</h1>
                <span class="tourist-map__level-pill">{{ scenicLevelText }}</span>
                <p class="tourist-map__info-desc">
                  {{ selectedSpot?.spotName ? `已选中：${selectedSpot.spotName}` : scenicArea?.description ||
                    '这里会展示景区范围、景点、路线和服务设施，方便游客快速了解导览信息。' }}
                </p>
              </div>
            </section>

            <div class="tourist-map__metric-card">
              <div class="tourist-map__metric tourist-map__metric--spot">
                <span class="tourist-map__metric-icon"><n-icon>
                    <LeafOutline />
                  </n-icon></span>
                <span class="tourist-map__metric-label">景点</span>
                <strong>{{ spots.length }}</strong>
                <small>个</small>
              </div>
              <div class="tourist-map__metric tourist-map__metric--route">
                <span class="tourist-map__metric-icon"><n-icon>
                    <TrailSignOutline />
                  </n-icon></span>
                <span class="tourist-map__metric-label">路线</span>
                <strong>{{ displayRoutes.length }}</strong>
                <small>条</small>
              </div>
            </div>

            <!-- 重点：基础信息从表格改为移动端信息卡片，不改变字段来源。 -->
            <dl class="tourist-map__info-list">
              <div class="tourist-map__info-row">
                <span class="tourist-map__row-icon tourist-map__row-icon--location"><n-icon>
                    <LocationOutline />
                  </n-icon></span>
                <dt>位置</dt>
                <dd>{{ scenicLocationText }}</dd>
              </div>
              <div v-if="scenicArea?.openingHours" class="tourist-map__info-row">
                <span class="tourist-map__row-icon tourist-map__row-icon--time"><n-icon>
                    <TimeOutline />
                  </n-icon></span>
                <dt>开放时间</dt>
                <dd>{{ scenicArea.openingHours }}</dd>
              </div>
            </dl>

            <section class="tourist-map__info-section tourist-map__info-section--legend">
              <div class="tourist-map__section-head">
                <h2>地图图例</h2>
                <small>游客端展示重点</small>
              </div>
              <div class="tourist-map__legend-tags">
                <span v-for="item in mapLegendItems" :key="item.label" class="tourist-map__legend-tag">
                  <i class="tourist-map__legend-line" :style="{ backgroundColor: item.color }"></i>
                  {{ item.label }}
                </span>
              </div>
            </section>

            <section class="tourist-map__info-section">
              <div class="tourist-map__section-head">
                <h2>推荐景点</h2>
                <small>{{ selectedSpot?.spotName || '点击地图标记查看' }}</small>
              </div>
              <div v-if="highlightedSpots.length" class="tourist-map__spot-tags">
                <span v-for="item in highlightedSpots" :key="item.id" class="tourist-map__spot-tag">
                  <n-icon>
                    <FootstepsOutline />
                  </n-icon>
                  {{ item.spotName || '未命名景点' }}
                </span>
              </div>
              <p v-else class="tourist-map__empty-text">当前景区暂无景点类型的推荐数据。</p>
            </section>
          </div>
        </n-card>
      </div>
    </transition>

    <transition name="tourist-map-panel">
      <section v-show="isRoutePanelOpen" class="tourist-map__route-panel" aria-label="推荐路线弹窗">
        <header class="tourist-map__route-header">
          <div class="tourist-map__route-title-wrap">
            <h2 class="tourist-map__route-title">推荐路线</h2>
            <p class="tourist-map__route-subtitle">点击路线可控制地图显示，快速切换不同游览方案</p>
          </div>

          <button class="tourist-map__route-toggle" type="button" aria-label="收起推荐路线" @click="isRoutePanelOpen = false">
            <n-icon>
              <CloseOutline />
            </n-icon>
          </button>
        </header>

        <div v-if="recommendedRoutes.length" class="tourist-map__route-list">
          <article v-for="(item, index) in recommendedRoutes" :key="item.id" class="tourist-map__route-card" :class="{
            'tourist-map__route-card--active': isRouteVisible(item.id),
            'tourist-map__route-card--disabled': !hasRouteGeojson(item),
            'tourist-map__route-card--agent': item.routeType === 'agent_custom',
            'tourist-map__route-card--green': item.routeType !== 'agent_custom' && index % 2 === 1,
          }">
            <div class="tourist-map__route-card-top">
              <div class="tourist-map__route-main">
                <h3 class="tourist-map__route-name">{{ item.routeName || '未命名路线' }}</h3>

                <!-- 重点：路线卡片展示层只做字段兜底，不改变后端路线数据结构。 -->
                <div class="tourist-map__route-meta">
                  <span v-for="tag in getRouteTags(item)" :key="`${item.id}-${tag}`"
                    class="tourist-map__route-meta-tag">
                    <n-icon>
                      <TimeOutline v-if="tag === formatRouteDuration(item)" />
                      <SparklesOutline v-else-if="item.routeType === 'agent_custom'" />
                      <TrailSignOutline v-else />
                    </n-icon>
                    {{ tag }}
                  </span>
                </div>

                <p class="tourist-map__route-desc">{{ getRouteDesc(item) }}</p>
              </div>

              <div class="tourist-map__route-action">
                <span class="tourist-map__route-status">
                  <n-icon>
                    <EyeOutline />
                  </n-icon>
                  {{ hasRouteGeojson(item) ? (isRouteVisible(item.id) ? '地图可见' : '点击切换') : '未配置轨迹' }}
                </span>
                <button class="tourist-map__route-show" type="button" :disabled="!hasRouteGeojson(item)"
                  @click="toggleRoute(item.id)">
                  {{ hasRouteGeojson(item) ? (isRouteVisible(item.id) ? '已显示' : '显示路线') : '不可显示' }}
                </button>
              </div>
            </div>
          </article>
        </div>
        <p v-else-if="isLoadingAgentRoute" class="tourist-map__route-empty">正在加载专属路线...</p>
        <p v-else class="tourist-map__route-empty">当前景区暂无推荐路线。</p>

        <div class="tourist-map__route-tip">
          小提示：路线显示后，可在地图中同步查看路径高亮、主要景点节点与推荐游览顺序。
        </div>
      </section>
    </transition>
  </section>
</template>

<style scoped>
.tourist-map {
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  border-radius: 24px;
  box-shadow: 0 24px 58px rgba(15, 23, 42, 0.16);
  contain: layout paint;
}

.tourist-map__spin,
.tourist-map__spin :deep(.n-spin-content),
.tourist-map__spin :deep(.map-canvas) {
  height: 100%;
}

.tourist-map__spin {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.tourist-map__top-card {
  width: min(420px, 100%);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(16px);
}

.tourist-map__top-card :deep(.n-card__content) {
  padding: 10px 12px;
}

.tourist-map__titlebar-control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: min(360px, 100%);
  min-width: 0;
}

.tourist-map__titlebar-select {
  width: min(340px, 42vw);
  min-width: 220px;
}

.tourist-map__select :deep(.n-base-selection) {
  --n-height: 30px;
  --n-border: 0;
  --n-border-hover: 0;
  --n-border-focus: 0;
  --n-box-shadow-focus: none;
  --n-color: transparent;
  --n-padding-single: 0;
  --n-font-size: 18px;
  font-weight: 800;
}

.tourist-map__widgets {
  position: absolute;
  top: 24px;
  right: 84px;
  z-index: 5;
  display: grid;
  gap: 12px;
  width: min(430px, calc(100% - 120px));
  max-height: calc(100% - 48px);
  overflow: auto;
  scrollbar-width: none;
}

.tourist-map__widgets::-webkit-scrollbar {
  display: none;
}

.tourist-map__widgets--info {
  width: min(430px, calc(100% - 120px));
}

.tourist-map__route-panel {
  position: absolute;
  right: 84px;
  bottom: 18px;
  z-index: 5;
  width: min(400px, calc(100% - 120px));
  max-height: min(62vh, 620px);
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 28px 28px 0 0;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 20px 50px rgba(25, 52, 62, 0.18);
  backdrop-filter: blur(18px);
  scrollbar-width: none;
  padding: 18px 18px 24px;
}

.tourist-map__route-panel::-webkit-scrollbar {
  display: none;
}

.tourist-map__widget {
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.92)),
    rgba(255, 255, 255, 0.92);
  box-shadow: 0 28px 80px rgba(35, 58, 72, 0.22);
  backdrop-filter: blur(22px);
}

.tourist-map__widget :deep(.n-card__content) {
  padding: 18px;
}

.tourist-map__info-card {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.78);
}

.tourist-map__info-card :deep(.n-card__content) {
  padding: 0;
}

.tourist-map__info-shell {
  display: grid;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 16px 10px 22px;
}

.tourist-map__panel-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.tourist-map__info-hero {
  position: relative;
  min-height: 220px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  padding: 18px 4px 8px;
}

.tourist-map__info-hero-copy {
  position: relative;
  z-index: 2;
  display: grid;
  align-content: start;
  min-width: 0;
  max-width: none;
  padding-right: 0;
}

.tourist-map__hero-art {
  position: absolute;
  top: 0;
  right: -18px;
  width: 48%;
  height: 210px;
  border-radius: 26px;
  opacity: 0.78;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.25) 42%, rgba(255, 255, 255, 0.05) 100%),
    radial-gradient(circle at 70% 43%, rgba(26, 85, 73, 0.2) 0 7%, transparent 8%),
    radial-gradient(circle at 72% 42%, rgba(68, 83, 74, 0.28) 0 2%, transparent 3%),
    linear-gradient(180deg, transparent 0 30%, rgba(76, 135, 103, 0.26) 31% 70%, transparent 71% 100%),
    radial-gradient(ellipse at 58% 78%, rgba(46, 113, 76, 0.32) 0 24%, transparent 25%),
    radial-gradient(ellipse at 70% 78%, rgba(73, 126, 92, 0.28) 0 30%, transparent 31%),
    linear-gradient(180deg, #eff5f1 0%, #e4eee7 48%, #f8fbfa 100%);
  filter: saturate(0.82);
}

.tourist-map__hero-art::before {
  position: absolute;
  top: 33px;
  right: 44px;
  width: 40px;
  height: 118px;
  border-radius: 24px 24px 8px 8px;
  background:
    radial-gradient(circle at 50% 9%, #7c827b 0 14px, transparent 15px),
    linear-gradient(90deg, transparent 0 22%, #8a9089 23% 78%, transparent 79% 100%),
    linear-gradient(180deg, #7d847c 0%, #a5ada3 100%);
  box-shadow: 0 18px 0 -3px rgba(132, 141, 132, 0.92), 0 26px 0 -8px rgba(103, 114, 108, 0.72);
  content: '';
  opacity: 0.72;
}

.tourist-map__hero-art::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #ffffff 0%, rgba(255, 255, 255, 0.82) 22%, rgba(255, 255, 255, 0.38) 58%, rgba(255, 255, 255, 0.88) 100%);
  content: '';
}

.tourist-map__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  color: #08766f;
  font-size: 15px;
  font-weight: 700;
  line-height: 32px;
  letter-spacing: 0.02em;
}

.tourist-map__eyebrow span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 999px;
  background: #eaf7f2;
  font-size: 18px;
}

.tourist-map__info-title {
  overflow: hidden;
  margin: 6px 0 8px;
  color: #17202b;
  font-family: 'STSong', 'Songti SC', 'SimSun', serif;
  font-size: clamp(42px, 12vw, 58px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.08em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tourist-map__level-pill {
  width: fit-content;
  border: 1px solid rgba(15, 118, 110, 0.16);
  border-radius: 999px;
  background: rgba(234, 247, 242, 0.72);
  padding: 7px 12px;
  color: #08766f;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  margin-bottom: 22px;
  box-shadow: none;
}

.tourist-map__info-desc {
  display: -webkit-box;
  overflow: hidden;
  width: 64%;
  margin: 0;
  color: #34404c;
  font-size: 15.5px;
  line-height: 1.75;
  letter-spacing: 0.02em;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.tourist-map__close-button {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(31, 41, 51, 0.09);
  border-radius: 999px;
  background: rgba(246, 248, 249, 0.88);
  color: #1f2933;
  font-size: 21px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: 0.2s ease;
}

.tourist-map__close-button:hover {
  background: #ffffff;
  transform: rotate(90deg);
}

.tourist-map__metric-card {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  width: 100%;
  box-sizing: border-box;
  margin: 2px 0 20px;
  overflow: hidden;
  border: 1px solid rgba(31, 41, 51, 0.09);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 30px rgba(31, 52, 63, 0.06);
  padding: 16px 2px;
}

.tourist-map__metric {
  position: relative;
  display: grid;
  min-width: 0;
  justify-items: center;
  grid-template-columns: auto auto;
  justify-content: center;
  align-items: center;
  gap: 0 8px;
  padding: 0 4px;
}

.tourist-map__metric:not(:last-child)::after {
  position: absolute;
  top: 9px;
  right: 0;
  width: 1px;
  bottom: 9px;
  height: auto;
  background: rgba(31, 41, 51, 0.09);
  content: '';
}

.tourist-map__metric-icon {
  grid-row: span 3;
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 999px;
  font-size: 20px;
}

.tourist-map__metric-label {
  justify-self: start;
  color: #3b4652;
  font-size: 13px;
  font-weight: 700;
  line-height: 17px;
  margin-bottom: 3px;
}

.tourist-map__metric strong {
  justify-self: start;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1;
}

.tourist-map__metric small {
  justify-self: start;
  color: #5d6875;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
}

.tourist-map__metric--spot {
  color: #0f766e;
}

.tourist-map__metric--spot .tourist-map__metric-icon {
  background: rgba(20, 184, 166, 0.13);
}

.tourist-map__metric--route {
  color: #2563eb;
}

.tourist-map__metric--route .tourist-map__metric-icon {
  background: rgba(59, 130, 246, 0.12);
}

.tourist-map__metric--feature {
  color: #d97706;
}

.tourist-map__metric--feature .tourist-map__metric-icon {
  background: rgba(251, 191, 36, 0.18);
}

.tourist-map__info-list {
  display: grid;
  width: 100%;
  overflow: hidden;
  border: 1px solid rgba(31, 41, 51, 0.09);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
  margin: 0 0 24px;
  padding: 6px 0;
  box-shadow: 0 10px 30px rgba(31, 52, 63, 0.06);
}

.tourist-map__info-row {
  display: grid;
  grid-template-columns: 30px 78px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  min-height: 64px;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0 10px;
  color: #24303c;
}

.tourist-map__info-row:not(:last-child) {
  border-bottom: 1px solid rgba(31, 41, 51, 0.09);
}

.tourist-map__info-row dt {
  position: relative;
  min-width: 0;
  color: #3d4854;
  font-size: 15px;
  font-weight: 700;
}

.tourist-map__info-row dt::after {
  position: absolute;
  top: 2px;
  right: -6px;
  bottom: 2px;
  width: 1px;
  background: rgba(31, 41, 51, 0.09);
  content: '';
}

.tourist-map__info-row dd {
  min-width: 0;
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
  letter-spacing: 0.02em;
  text-align: left;
  overflow-wrap: anywhere;
  white-space: nowrap;
}

.tourist-map__row-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  font-size: 17px;
}

.tourist-map__row-icon--location,
.tourist-map__row-icon--time {
  background: transparent;
  color: #0f766e;
}

.tourist-map__info-section {
  display: grid;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
  border-radius: 0;
  background: transparent;
  padding: 0;
}

.tourist-map__info-section--legend {
  border-top: 1px solid rgba(31, 41, 51, 0.09);
  padding-top: 22px;
  margin-top: 22px;
}

.tourist-map__info-section+.tourist-map__info-section {
  border-top: 1px solid rgba(31, 41, 51, 0.09);
  padding-top: 22px;
  margin-top: 22px;
}

.tourist-map__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.tourist-map__section-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 28px;
}

.tourist-map__section-head h2::before {
  width: 18px;
  height: 18px;
  background: currentColor;
  content: '';
  mask: linear-gradient(#000 0 0) left 2px top 3px / 3px 12px no-repeat,
    linear-gradient(#000 0 0) left 7px top 1px / 3px 14px no-repeat,
    linear-gradient(#000 0 0) right 2px top 4px / 3px 11px no-repeat;
}

.tourist-map__section-head small {
  overflow: hidden;
  color: #94a3b8;
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tourist-map__legend-tags,
.tourist-map__spot-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 8px;
}

.tourist-map__spot-tags {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tourist-map__legend-tag,
.tourist-map__spot-tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 36px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.tourist-map__legend-tag {
  gap: 7px;
  border: 1px solid rgba(31, 41, 51, 0.08);
  background: rgba(247, 249, 250, 0.92);
  padding: 8px 13px;
  color: #2f3a45;
}

.tourist-map__legend-line {
  width: 4px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.tourist-map__spot-tag {
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  border: 1px solid rgba(31, 41, 51, 0.1);
  background: rgba(255, 255, 255, 0.78);
  padding: 8px 12px;
  color: #2d3742;
  font-size: 15px;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(34, 54, 66, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.tourist-map__spot-tag .n-icon {
  flex: 0 0 auto;
  color: #a97848;
}

.tourist-map__empty-text {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 20px;
}

.tourist-map__route-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.tourist-map__route-title-wrap {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.tourist-map__route-title {
  margin: 0;
  color: #1f2a33;
  font-size: 22px;
  font-weight: 800;
  line-height: 28px;
}

.tourist-map__route-subtitle {
  margin: 0;
  color: #66727f;
  font-size: 14px;
  line-height: 1.5;
}

.tourist-map__route-toggle {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: #f4f7f8;
  color: #2c3640;
  font-size: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: 0.2s ease;
}

.tourist-map__route-toggle:hover {
  background: #ffffff;
  transform: translateY(-1px);
}

.tourist-map__route-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.tourist-map__route-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(143, 99, 232, 0.22);
  border-radius: 20px;
  background: linear-gradient(135deg, #fbf8ff 0%, #f7f1ff 100%);
  box-shadow: 0 10px 24px rgba(38, 60, 72, 0.06);
  padding: 14px;
}

.tourist-map__route-card::before {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.15));
  content: '';
  pointer-events: none;
}

.tourist-map__route-card--green {
  border-color: rgba(12, 138, 118, 0.18);
  background: linear-gradient(135deg, #f5fcfa 0%, #edf9f5 100%);
}

.tourist-map__route-card--active {
  border-color: rgba(12, 138, 118, 0.3);
}

.tourist-map__route-card--agent {
  border-color: rgba(143, 99, 232, 0.26);
}

.tourist-map__route-card--disabled {
  opacity: 0.72;
}

.tourist-map__route-card-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tourist-map__route-main {
  min-width: 0;
  flex: 1;
}

.tourist-map__route-name {
  overflow: hidden;
  display: -webkit-box;
  margin: 0 0 10px;
  color: #1f2a33;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.45;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tourist-map__route-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.tourist-map__route-meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  border: 1px solid rgba(143, 99, 232, 0.16);
  border-radius: 999px;
  background: #f5efff;
  color: #8f63e8;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
}

.tourist-map__route-card--green .tourist-map__route-meta-tag,
.tourist-map__route-card--active:not(.tourist-map__route-card--agent) .tourist-map__route-meta-tag {
  border-color: rgba(12, 138, 118, 0.14);
  background: #e9f8f4;
  color: #0c8a76;
}

.tourist-map__route-meta-tag .n-icon {
  font-size: 16px;
}

.tourist-map__route-desc {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: #5f6a76;
  font-size: 13px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tourist-map__route-action {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.tourist-map__route-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #7a8693;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.tourist-map__route-status .n-icon {
  font-size: 16px;
}

.tourist-map__route-show {
  min-width: 82px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #a983ff 0%, #8f63e8 100%);
  box-shadow: 0 8px 18px rgba(143, 99, 232, 0.28);
  color: #ffffff;
  cursor: pointer;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 800;
  line-height: 18px;
  transition: 0.2s ease;
}

.tourist-map__route-card--green .tourist-map__route-show,
.tourist-map__route-card--active:not(.tourist-map__route-card--agent) .tourist-map__route-show {
  background: linear-gradient(135deg, #37bea6 0%, #0c8a76 100%);
  box-shadow: 0 8px 18px rgba(12, 138, 118, 0.24);
}

.tourist-map__route-show:hover:not(:disabled) {
  filter: brightness(1.02);
  transform: translateY(-1px);
}

.tourist-map__route-show:disabled {
  background: #d7dde2;
  box-shadow: none;
  color: #7a8693;
  cursor: not-allowed;
}

.tourist-map__route-tip {
  margin-top: 16px;
  border: 1px solid rgba(31, 42, 51, 0.08);
  border-radius: 14px;
  background: rgba(246, 249, 250, 0.88);
  color: #75818c;
  padding: 12px 14px;
  font-size: 12.5px;
  line-height: 1.6;
}

.tourist-map__route-empty {
  margin: 18px 0 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 22px;
}

.tourist-map__digital-human {
  position: absolute;
  top: 26px;
  left: 46px;
  z-index: 4;
  display: grid;
  justify-items: center;
  gap: 10px;
  width: min(170px, 28vw);
  pointer-events: none;
}

.tourist-map__digital-human-stage {
  position: relative;
  display: flex;
  width: min(150px, 100%);
  aspect-ratio: 9 / 16;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
}

.tourist-map__digital-human-source {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.tourist-map__digital-human-source--fallback {
  position: static;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 1;
}

.tourist-map__digital-human-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tourist-map__digital-human-canvas--hidden {
  display: none;
}

.tourist-map__digital-human-placeholder {
  position: absolute;
  right: 16px;
  bottom: 20px;
  left: 16px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
}

.tourist-map__digital-human-composer {
  position: absolute;
  right: auto;
  bottom: 22px;
  left: 50%;
  z-index: 7;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  width: min(760px, calc(100% - 220px));
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
  padding: 10px;
  backdrop-filter: blur(18px);
  /* 重点：数字人提问栏作为一个整体透明，输入框文字和按钮也一起降到 30%。 */
  opacity: 0.6;
  transform: translateX(-50%);
}

.tourist-map__digital-human-composer :deep(.n-input) {
  min-width: 0;
}

.tourist-map__digital-human-composer :deep(.n-input .n-input__border),
.tourist-map__digital-human-composer :deep(.n-input .n-input__state-border) {
  border-color: rgba(255, 255, 255, 0.46);
}

.tourist-map__digital-human-composer :deep(.n-input .n-input-wrapper) {
  background: rgba(255, 255, 255, 0.7);
}

.tourist-map__digital-human-composer :deep(.n-input-wrapper) {
  min-height: 42px;
}

.tourist-map__digital-human-composer :deep(.n-button) {
  background-color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.46);
}

.tourist-map__digital-human-composer :deep(.n-button--primary-type) {
  background-color: rgba(20, 184, 166, 0.72);
  border-color: rgba(20, 184, 166, 0.46);
}

.tourist-map__digital-human-voice {
  min-width: 42px;
  width: 42px;
  height: 42px;
  padding: 0;
}

.tourist-map__digital-human-voice--recording {
  background: #ef4444;
  color: #fff;
}

.tourist-map__digital-human-voice--recording:hover {
  background: #dc2626;
  color: #fff;
}

.tourist-map-digital-human-enter-active,
.tourist-map-digital-human-leave-active,
.tourist-map-composer-enter-active,
.tourist-map-composer-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.tourist-map-digital-human-enter-from,
.tourist-map-digital-human-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.tourist-map-composer-enter-from,
.tourist-map-composer-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}

.tourist-map-panel-enter-active,
.tourist-map-panel-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.tourist-map-panel-enter-from,
.tourist-map-panel-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

@media (max-width: 768px) {
  .tourist-map {
    border-radius: 20px;
  }

  .tourist-map__select :deep(.n-base-selection) {
    font-size: 16px;
  }

  .tourist-map__titlebar-control {
    width: 100%;
  }

  .tourist-map__titlebar-select {
    flex: 1;
    width: auto;
    min-width: 0;
  }

  .tourist-map__widgets,
  .tourist-map__widgets--info {
    top: auto;
    right: 12px;
    bottom: 12px;
    left: 12px;
    width: auto;
    max-height: min(92vh, 860px);
  }

  .tourist-map__route-panel {
    left: 12px;
    right: 12px;
    bottom: 12px;
    width: auto;
    max-height: min(72vh, 620px);
  }

  .tourist-map__digital-human {
    top: 16px;
    left: 18px;
    width: min(118px, 30vw);
  }

  .tourist-map__digital-human-stage {
    width: min(104px, 100%);
  }

  .tourist-map__digital-human-composer {
    right: 56px;
    bottom: 14px;
    left: 12px;
    width: auto;
    gap: 8px;
    padding: 8px;
    transform: none;
  }
}

@media (max-width: 390px) {

  .tourist-map__widgets,
  .tourist-map__widgets--info {
    right: 0;
    bottom: 0;
    left: 0;
    max-height: 92vh;
  }

  .tourist-map__info-card {
    border-radius: 26px 26px 0 0;
  }

  .tourist-map__info-shell {
    padding: 14px 6px 22px;
  }

  .tourist-map__info-hero {
    min-height: 205px;
  }

  .tourist-map__hero-art {
    right: -28px;
    width: 52%;
  }

  .tourist-map__info-desc {
    width: 68%;
  }

  .tourist-map__metric {
    grid-template-columns: 1fr;
    gap: 6px;
    text-align: center;
  }

  .tourist-map__metric-icon,
  .tourist-map__metric-label,
  .tourist-map__metric strong,
  .tourist-map__metric small {
    justify-self: center;
  }

  .tourist-map__metric-icon {
    grid-row: auto;
    width: 40px;
    height: 40px;
  }

  .tourist-map__info-row {
    grid-template-columns: 22px 60px minmax(0, 1fr);
    gap: 5px;
    min-height: 58px;
    padding: 0 8px;
  }

  .tourist-map__info-row dt,
  .tourist-map__info-row dd {
    font-size: 14px;
  }

  .tourist-map__info-row dd {
    white-space: normal;
  }

  .tourist-map__row-icon {
    width: 24px;
    height: 24px;
  }

  .tourist-map__spot-tags {
    grid-template-columns: 1fr;
  }

  .tourist-map__route-panel {
    right: 0;
    bottom: 0;
    left: 0;
    max-height: 76vh;
    border-radius: 28px 28px 0 0;
    padding: 18px 14px 22px;
  }

  .tourist-map__route-card-top {
    flex-direction: column;
  }

  .tourist-map__route-action {
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .tourist-map__route-show {
    min-width: 96px;
  }
}
</style>
