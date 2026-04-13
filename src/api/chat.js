import axios from 'axios'
import request from '@/utils/request'

const DIGITAL_HUMAN_API_URL = 'http://localhost:8010'

export const agentChatApi = (data) => request.post('/agent/chat', data)

export const analyzeSessionApi = (data) => request.post('/agent/session-analysis', data)

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

export const fetchDigitalHuman = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/human`, data)
}

export const fetchSpeechState = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/speech_state`, data)
}

export const fetchIsSpeaking = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/is_speaking`, data)
}

export const fetchInterruptTalk = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/interrupt_talk`, data)
}

export const fetchStartRecord = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/record`, data)
}

export const fetchStopRecord = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/record`, data)
}

export const sendWebRTCOffer = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/offer`, data)
}
