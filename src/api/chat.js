import axios from 'axios'
import request from '@/utils/request'

const DIGITAL_HUMAN_API_URL =
  import.meta.env.VITE_DIGITAL_HUMAN_API_URL || 'http://localhost:8010'
const DIGITAL_HUMAN_CLOSE_PATH =
  import.meta.env.VITE_DIGITAL_HUMAN_CLOSE_PATH || '/session/close'

const getDigitalHumanUrl = (path, apiUrl) => {
  const baseUrl = String(apiUrl || DIGITAL_HUMAN_API_URL).replace(/\/$/, '')
  const normalizedPath = String(path).startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

const digitalHumanPost = (path, data, apiUrl) => {
  return axios.post(getDigitalHumanUrl(path, apiUrl), data)
}

export const agentChatApi = (data) => request.post('/agent/chat', data)

export const analyzeSessionApi = (data) => request.post('/agent/session-analysis', data)

export const analyzeDailySessionsApi = (data) =>
  request.post('/agent/session-analysis/daily', data)

export const bindSessionScenicAreaApi = (data) =>
  request.post('/agent/session/scenic-area/bind', data)

// 保留旧方法名，避免仓库里未切换的新旧页面同时存在时直接报错。
export const fetchChat = async (data) => {
  const result = await agentChatApi(data)

  return {
    data: {
      ...result,
      response: result?.answer ?? '',
    },
  }
}

export const fetchDigitalHuman = (data, apiUrl) => {
  return digitalHumanPost('/human', data, apiUrl)
}

export const fetchSpeechState = (data, apiUrl) => {
  return digitalHumanPost('/speech_state', data, apiUrl)
}

export const fetchIsSpeaking = (data, apiUrl) => {
  return digitalHumanPost('/is_speaking', data, apiUrl)
}

export const fetchInterruptTalk = (data, apiUrl) => {
  return digitalHumanPost('/interrupt_talk', data, apiUrl)
}

export const fetchStartRecord = (data, apiUrl) => {
  return digitalHumanPost('/record', data, apiUrl)
}

export const fetchStopRecord = (data, apiUrl) => {
  return digitalHumanPost('/record', data, apiUrl)
}

export const sendWebRTCOffer = (data, apiUrl) => {
  return digitalHumanPost('/offer', data, apiUrl)
}

export const closeDigitalHumanSession = async (data, apiUrl, { keepalive = false } = {}) => {
  const url = getDigitalHumanUrl(DIGITAL_HUMAN_CLOSE_PATH, apiUrl)

  if (keepalive && typeof fetch === 'function') {
    // 页面退出或安卓 WebView 退后台时使用 keepalive，尽量保证释放请求能离开当前页面。
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
    })
    if (!response.ok) throw new Error(`释放数字人会话失败（HTTP ${response.status}）`)
    const payload = await response.json()
    if (payload?.code !== 0) throw new Error(payload?.msg || '释放数字人会话失败')
    return { data: payload }
  }

  const response = await axios.post(url, data, { timeout: 5000 })
  if (response.data?.code !== 0) {
    throw new Error(response.data?.msg || '释放数字人会话失败')
  }
  return response
}
