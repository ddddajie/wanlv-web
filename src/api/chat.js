import axios from 'axios'
import request from '@/utils/request'

const DIGITAL_HUMAN_API_URL =
  import.meta.env.VITE_DIGITAL_HUMAN_API_URL || 'http://localhost:8010'

const digitalHumanPost = (path, data, apiUrl) => {
  const baseUrl = String(apiUrl || DIGITAL_HUMAN_API_URL).replace(/\/$/, '')
  return axios.post(`${baseUrl}${path}`, data)
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
