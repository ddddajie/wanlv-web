import axios from 'axios';

const AGENT_API_URL = 'http://localhost:8000';
const DIGITAL_HUMAN_API_URL = 'http://localhost:8010';

export const fetchChat = (data) => {
  return axios.post(`${AGENT_API_URL}/chat`, data);
};

export const fetchDigitalHuman = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/human`, data);
};

export const fetchSpeechState = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/speech_state`, data);
};

export const fetchIsSpeaking = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/is_speaking`, data);
};

export const fetchInterruptTalk = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/interrupt_talk`, data);
};

export const fetchStartRecord = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/record`, data);
};

export const fetchStopRecord = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/record`, data);
};

export const sendWebRTCOffer = (data) => {
  return axios.post(`${DIGITAL_HUMAN_API_URL}/offer`, data);
};
