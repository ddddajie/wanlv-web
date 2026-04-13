<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  fetchChat,
  fetchDigitalHuman,
  fetchInterruptTalk,
  sendWebRTCOffer,
} from '../api/chat';

const STUN_SERVER = 'stun:stun.l.google.com:19302';
const SPEECH_START_DELAY = 1200;
const BASE_CHAR_INTERVAL = 185;
const FINISHED_HIDE_DELAY = 900;

const uiText = {
  brand: 'Digital Human',
  title: '数字人问答舞台',
  subtitle: 'AI 回复会根据数字人准备播报的时机，在左上角气泡中按固定节奏缓慢显示。',
  connected: '已连接',
  connecting: '连接中...',
  disconnected: '未连接',
  bubbleIdle: '待命中',
  bubbleQueued: '准备播报',
  bubbleSpeaking: '播报中',
  bubbleFinished: '播报完成',
  sessionPrefix: '会话 ID：',
  bubbleTitle: 'AI 回答',
  placeholderTitle: '等待数字人连接',
  placeholderBody: '点击“开始连接”后，数字人会显示在舞台中央，回复气泡会在准备播报时开始慢慢显示文字。',
  featureOne: '不再持续轮询数字人状态',
  featureTwo: '前端按固定节奏推演字幕',
  featureThree: '准备播报后约 700ms 开始显字',
  connect: '开始连接',
  disconnect: '断开连接',
  latestQuestion: '最近提问',
  inputPlaceholder: '请输入你的问题，数字人会在中心舞台上回答你...',
  ask: '提问',
  holdToTalk: '按住说话',
  releaseToSend: '松开发送',
  connectFirst: '请先连接数字人，再开始问答。',
  chatFailed: '获取 AI 回复失败，请稍后再试。',
  micFailed: '无法访问麦克风，请检查浏览器权限设置。',
  rtcNegotiationFailed: 'WebRTC 协商失败：',
  rtcStartFailed: '启动连接失败：',
  digitalHumanFailed: '数字人播报失败',
  emptyReply: '暂时没有获取到回复。',
};

const userInput = ref('');
const connectionStatus = ref('disconnected');
const sessionId = ref(0);
const loading = ref(false);
const lastQuestion = ref('');
const isVoiceRecording = ref(false);
const pc = ref(null);
const mediaRecorder = ref(null);
const recognition = ref(null);

const speechState = ref('idle');
const aiBubbleVisible = ref(false);
const aiBubbleText = ref('');
const aiBubbleFullText = ref('');

let speechStartTimer = null;
let speechTypeTimer = null;
let bubbleHideTimer = null;
let activeSpeechToken = 0;

const statusText = computed(() => {
  const map = {
    connected: uiText.connected,
    connecting: uiText.connecting,
    disconnected: uiText.disconnected,
  };
  return map[connectionStatus.value] ?? uiText.disconnected;
});

const statusTagType = computed(() => {
  const map = {
    connected: 'success',
    connecting: 'warning',
    disconnected: 'info',
  };
  return map[connectionStatus.value] ?? 'info';
});

const bubbleStatusText = computed(() => {
  const map = {
    idle: uiText.bubbleIdle,
    queued: uiText.bubbleQueued,
    speaking: uiText.bubbleSpeaking,
    finished: uiText.bubbleFinished,
  };
  return map[speechState.value] ?? uiText.bubbleIdle;
});

const sanitizeReplyText = (text) => {
  return text.replace(/\*\*|\*|#|\[|\]|\(|\)/g, '').replace(/\s+\n/g, '\n').trim();
};

const getCharDelay = (char) => {
  if (['。', '！', '？', '!', '?'].includes(char)) {
    return BASE_CHAR_INTERVAL + 220;
  }

  if (['，', '、', '；', '：', ',', ';', ':'].includes(char)) {
    return BASE_CHAR_INTERVAL + 100;
  }

  if (char === '\n') {
    return BASE_CHAR_INTERVAL + 160;
  }

  if (char === ' ') {
    return BASE_CHAR_INTERVAL - 40;
  }

  return BASE_CHAR_INTERVAL;
};

const clearSpeechTimers = () => {
  if (speechStartTimer) {
    window.clearTimeout(speechStartTimer);
    speechStartTimer = null;
  }

  if (speechTypeTimer) {
    window.clearTimeout(speechTypeTimer);
    speechTypeTimer = null;
  }

  if (bubbleHideTimer) {
    window.clearTimeout(bubbleHideTimer);
    bubbleHideTimer = null;
  }
};

const resetSpeechBubble = () => {
  clearSpeechTimers();
  speechState.value = 'idle';
  aiBubbleVisible.value = false;
  aiBubbleText.value = '';
  aiBubbleFullText.value = '';
};

const finishSpeechBubble = (token) => {
  if (activeSpeechToken !== token) {
    return;
  }

  speechState.value = 'finished';
  aiBubbleText.value = aiBubbleFullText.value;

  bubbleHideTimer = window.setTimeout(() => {
    if (activeSpeechToken !== token) {
      return;
    }
    resetSpeechBubble();
  }, FINISHED_HIDE_DELAY);
};

const runTypewriter = (token, index = 0) => {
  if (activeSpeechToken !== token) {
    return;
  }

  const fullText = aiBubbleFullText.value;
  if (!fullText || index >= fullText.length) {
    finishSpeechBubble(token);
    return;
  }

  speechState.value = 'speaking';
  aiBubbleText.value = fullText.slice(0, index + 1);

  const nextChar = fullText[index];
  speechTypeTimer = window.setTimeout(() => {
    runTypewriter(token, index + 1);
  }, getCharDelay(nextChar));
};

const startSimulatedSpeech = (text) => {
  const token = Date.now();
  activeSpeechToken = token;
  clearSpeechTimers();

  aiBubbleFullText.value = text;
  aiBubbleText.value = '';
  aiBubbleVisible.value = true;
  speechState.value = 'queued';

  speechStartTimer = window.setTimeout(() => {
    runTypewriter(token, 0);
  }, SPEECH_START_DELAY);
};

const cleanupPeerConnection = () => {
  if (pc.value) {
    pc.value.close();
    pc.value = null;
  }
};

const negotiate = async () => {
  try {
    pc.value.addTransceiver('video', { direction: 'recvonly' });
    pc.value.addTransceiver('audio', { direction: 'recvonly' });

    const offer = await pc.value.createOffer();
    await pc.value.setLocalDescription(offer);

    await new Promise((resolve) => {
      if (pc.value.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const handleStateChange = () => {
        if (pc.value?.iceGatheringState === 'complete') {
          pc.value.removeEventListener('icegatheringstatechange', handleStateChange);
          resolve();
        }
      };

      pc.value.addEventListener('icegatheringstatechange', handleStateChange);
    });

    const offerData = pc.value.localDescription;
    const response = await sendWebRTCOffer({ sdp: offerData.sdp, type: offerData.type });
    const answer = response.data;
    sessionId.value = answer.sessionid;
    await pc.value.setRemoteDescription(answer);
  } catch (error) {
    ElMessage.error(`${uiText.rtcNegotiationFailed}${error.message}`);
    connectionStatus.value = 'disconnected';
  }
};

const start = async () => {
  try {
    pc.value = new RTCPeerConnection({
      sdpSemantics: 'unified-plan',
      iceServers: [{ urls: [STUN_SERVER] }],
    });

    pc.value.addEventListener('track', (event) => {
      if (event.track.kind === 'video') {
        const videoElement = document.getElementById('digital-human-video');
        if (videoElement) {
          videoElement.srcObject = event.streams[0];
        }
        return;
      }

      const audioElement = document.getElementById('digital-human-audio');
      if (audioElement) {
        audioElement.srcObject = event.streams[0];
      }
    });

    pc.value.addEventListener('connectionstatechange', () => {
      const state = pc.value?.connectionState;

      if (state === 'connected') {
        connectionStatus.value = 'connected';
        return;
      }

      if (['disconnected', 'failed', 'closed'].includes(state)) {
        connectionStatus.value = 'disconnected';
        resetSpeechBubble();
      }
    });

    await negotiate();
  } catch (error) {
    ElMessage.error(`${uiText.rtcStartFailed}${error.message}`);
    connectionStatus.value = 'disconnected';
  }
};

const stop = async () => {
  try {
    if (sessionId.value) {
      await fetchInterruptTalk({ sessionid: sessionId.value });
    }
  } catch (error) {
    console.error('Failed to interrupt current speech:', error);
  }

  resetSpeechBubble();
  cleanupPeerConnection();
  connectionStatus.value = 'disconnected';
};

const handleStartConnect = async () => {
  if (connectionStatus.value === 'connecting' || connectionStatus.value === 'connected') {
    return;
  }

  connectionStatus.value = 'connecting';
  await start();
};

const handleStopConnect = async () => {
  await stop();
};

const interruptCurrentSpeech = async () => {
  activeSpeechToken = Date.now();
  clearSpeechTimers();

  if (!sessionId.value) {
    resetSpeechBubble();
    return;
  }

  try {
    await fetchInterruptTalk({ sessionid: sessionId.value });
  } catch (error) {
    console.error('Failed to interrupt digital human speech:', error);
  } finally {
    resetSpeechBubble();
  }
};

const playBubbleReply = async (replyText) => {
  const cleanedReply = sanitizeReplyText(replyText);
  const response = await fetchDigitalHuman({
    type: 'echo',
    text: cleanedReply,
    sessionid: sessionId.value,
  });

  if (response.data?.code !== 0) {
    throw new Error(response.data?.msg || uiText.digitalHumanFailed);
  }

  startSimulatedSpeech(cleanedReply);
};

const sendChatMessage = async () => {
  const message = userInput.value.trim();
  if (!message || loading.value) {
    return;
  }

  if (connectionStatus.value !== 'connected') {
    ElMessage.warning(uiText.connectFirst);
    return;
  }

  await interruptCurrentSpeech();

  lastQuestion.value = message;
  userInput.value = '';
  loading.value = true;

  try {
    const response = await fetchChat({
      query: message,
      session_id: sessionId.value.toString(),
    });

    const agentResponse = response.data?.response || uiText.emptyReply;
    await playBubbleReply(agentResponse);
  } catch (error) {
    console.error('Failed to fetch AI reply:', error);
    ElMessage.error(uiText.chatFailed);
  } finally {
    loading.value = false;
  }
};

const handleVoiceRecordStart = async () => {
  if (isVoiceRecording.value) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.value = new MediaRecorder(stream);
    mediaRecorder.value.ondataavailable = () => { };
    mediaRecorder.value.start();
    isVoiceRecording.value = true;

    if (recognition.value) {
      recognition.value.start();
    }
  } catch (error) {
    console.error('Failed to access microphone:', error);
    ElMessage.error(uiText.micFailed);
  }
};

const handleVoiceRecordStop = () => {
  if (!isVoiceRecording.value || !mediaRecorder.value) {
    return;
  }

  mediaRecorder.value.stop();
  isVoiceRecording.value = false;

  if (mediaRecorder.value.stream) {
    mediaRecorder.value.stream.getTracks().forEach((track) => track.stop());
  }

  if (recognition.value) {
    recognition.value.stop();
  }

  window.setTimeout(() => {
    if (userInput.value.trim()) {
      sendChatMessage();
    }
  }, 500);
};

const initSpeechRecognition = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return;
  }

  recognition.value = new SpeechRecognition();
  recognition.value.continuous = true;
  recognition.value.interimResults = true;
  recognition.value.lang = 'zh-CN';

  recognition.value.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) {
        finalTranscript += event.results[index][0].transcript;
      } else {
        interimTranscript += event.results[index][0].transcript;
      }
    }

    userInput.value = (finalTranscript || interimTranscript).trim();
  };

  recognition.value.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
  };
};

const handleBeforeUnload = () => {
  resetSpeechBubble();
  cleanupPeerConnection();
};

onMounted(() => {
  initSpeechRecognition();
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('unload', handleBeforeUnload);
});

onUnmounted(() => {
  resetSpeechBubble();
  cleanupPeerConnection();

  if (isVoiceRecording.value && mediaRecorder.value) {
    mediaRecorder.value.stop();
    mediaRecorder.value.stream.getTracks().forEach((track) => track.stop());
  }

  if (recognition.value) {
    recognition.value.stop();
  }

  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('unload', handleBeforeUnload);
});
</script>

<template>
  <div class="chat-stage-page">
    <div class="ambient ambient-left"></div>
    <div class="ambient ambient-right"></div>

    <section class="stage-shell">
      <header class="top-bar">
        <div class="brand-copy">
          <span class="brand-kicker">{{ uiText.brand }}</span>
          <h1>{{ uiText.title }}</h1>
          <p>{{ uiText.subtitle }}</p>
        </div>

        <div class="status-cluster">
          <el-tag :type="statusTagType" effect="dark" round>{{ statusText }}</el-tag>
          <div class="session-chip">{{ uiText.sessionPrefix }}{{ sessionId || '--' }}</div>
        </div>
      </header>

      <main class="stage-panel">
        <div class="stage-frame">
          <transition name="bubble-fade">
            <div v-if="aiBubbleVisible" class="reply-bubble">
              <div class="reply-bubble-head">
                <span>{{ uiText.bubbleTitle }}</span>
                <span class="bubble-status">{{ bubbleStatusText }}</span>
              </div>
              <p>{{ aiBubbleText || aiBubbleFullText }}</p>
            </div>
          </transition>

          <video id="digital-human-video" autoplay playsinline></video>
          <audio id="digital-human-audio" autoplay></audio>

          <div class="video-mask"></div>

          <div v-if="connectionStatus !== 'connected'" class="video-placeholder">
            <div class="placeholder-card">
              <div class="placeholder-title">{{ uiText.placeholderTitle }}</div>
              <div class="placeholder-text">{{ uiText.placeholderBody }}</div>
            </div>
          </div>
        </div>

        <div class="stage-actions">
          <div class="action-pills">
            <span class="pill">{{ uiText.featureOne }}</span>
            <span class="pill">{{ uiText.featureTwo }}</span>
            <span class="pill">{{ uiText.featureThree }}</span>
          </div>

          <div class="button-row">
            <el-button v-if="connectionStatus !== 'connected'" type="primary" size="large"
              :loading="connectionStatus === 'connecting'" @click="handleStartConnect">
              {{ connectionStatus === 'connecting' ? uiText.connecting : uiText.connect }}
            </el-button>
            <el-button v-else type="danger" plain size="large" @click="handleStopConnect">
              {{ uiText.disconnect }}
            </el-button>
          </div>

          <div v-if="lastQuestion" class="latest-question">
            <span class="question-label">{{ uiText.latestQuestion }}</span>
            <p>{{ lastQuestion }}</p>
          </div>
        </div>
      </main>

      <footer class="composer-panel">
        <div class="composer-wrap">
          <el-input v-model="userInput" size="large" clearable :disabled="loading"
            :placeholder="uiText.inputPlaceholder" @keydown.enter.prevent="sendChatMessage" />

          <el-button type="primary" size="large" :loading="loading" @click="sendChatMessage">
            {{ uiText.ask }}
          </el-button>

          <button type="button" class="voice-button" :class="{ recording: isVoiceRecording }"
            @mousedown="handleVoiceRecordStart" @mouseup="handleVoiceRecordStop" @mouseleave="handleVoiceRecordStop"
            @touchstart.prevent="handleVoiceRecordStart" @touchend="handleVoiceRecordStop">
            {{ isVoiceRecording ? uiText.releaseToSend : uiText.holdToTalk }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.chat-stage-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 28px 20px 24px;
  background:
    radial-gradient(circle at top, rgba(76, 145, 255, 0.2), transparent 28%),
    linear-gradient(180deg, #edf4ff 0%, #dfeaf8 100%);
}

.ambient {
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  filter: blur(32px);
  opacity: 0.55;
  pointer-events: none;
}

.ambient-left {
  top: 80px;
  left: -120px;
  background: rgba(64, 158, 255, 0.24);
}

.ambient-right {
  right: -140px;
  bottom: 100px;
  background: rgba(103, 194, 58, 0.18);
}

.stage-shell {
  position: relative;
  z-index: 1;
  width: min(1320px, 100%);
  margin: 0 auto;
}

.top-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.brand-kicker {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.brand-copy h1 {
  margin: 14px 0 10px;
  color: #0f172a;
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.08;
}

.brand-copy p {
  max-width: 660px;
  color: #475569;
  font-size: 15px;
  line-height: 1.75;
}

.status-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.session-chip {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  color: #334155;
  font-size: 14px;
}

.stage-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}

.stage-frame {
  position: relative;
  width: 100%;
  min-height: 72vh;
  border-radius: 36px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 50% 18%, rgba(64, 158, 255, 0.22), transparent 20%),
    linear-gradient(180deg, #06111f 0%, #09182c 45%, #101d2e 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 28px 60px rgba(15, 23, 42, 0.22);
}

.video-mask {
  position: absolute;
  inset: auto 0 0;
  height: 180px;
  background: linear-gradient(180deg, rgba(6, 17, 31, 0), rgba(6, 17, 31, 0.34));
  pointer-events: none;
}

#digital-human-video {
  position: relative;
  z-index: 1;
  width: min(760px, 78vw);
  max-height: 88%;
  object-fit: contain;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  pointer-events: none;
}

.placeholder-card {
  max-width: 420px;
  padding: 22px 24px;
  border-radius: 24px;
  background: rgba(8, 15, 28, 0.48);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  text-align: center;
  backdrop-filter: blur(10px);
}

.placeholder-title {
  margin-bottom: 10px;
  color: #ffffff;
  font-size: 24px;
  font-weight: 700;
}

.placeholder-text {
  color: rgba(255, 255, 255, 0.84);
  font-size: 15px;
  line-height: 1.8;
}

.reply-bubble {
  position: absolute;
  top: 28px;
  left: 28px;
  z-index: 4;
  width: min(420px, calc(100% - 48px));
  padding: 18px 18px 16px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.18);
}

.reply-bubble::after {
  content: '';
  position: absolute;
  left: 28px;
  bottom: -12px;
  width: 28px;
  height: 28px;
  border-radius: 0 0 18px 0;
  background: rgba(255, 255, 255, 0.96);
  transform: rotate(40deg);
}

.reply-bubble-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 700;
}

.bubble-status {
  color: #64748b;
  font-size: 12px;
}

.reply-bubble p {
  margin: 0;
  min-height: 56px;
  color: #1e293b;
  font-size: 15px;
  line-height: 1.9;
  white-space: pre-wrap;
  word-break: break-word;
}

.stage-actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.action-pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pill {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
  color: #334155;
  font-size: 13px;
}

.button-row {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 12px;
}

.latest-question {
  width: 100%;
  padding: 16px 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.question-label {
  display: inline-block;
  margin-bottom: 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.latest-question p {
  margin: 0;
  color: #334155;
  font-size: 14px;
  line-height: 1.8;
}

.composer-panel {
  position: relative;
  z-index: 2;
  margin-top: 22px;
  padding: 18px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(14px);
}

.composer-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 14px;
  align-items: center;
}

.composer-wrap :deep(.el-input__wrapper) {
  min-height: 56px;
  border-radius: 18px;
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.28) inset;
}

.composer-wrap :deep(.el-button) {
  min-width: 120px;
  min-height: 56px;
  border-radius: 18px;
}

.voice-button {
  min-width: 130px;
  min-height: 56px;
  padding: 0 22px;
  border: 0;
  border-radius: 18px;
  background: linear-gradient(135deg, #0f172a, #1e3a8a);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
  box-shadow: 0 16px 32px rgba(30, 58, 138, 0.18);
}

.voice-button:hover {
  transform: translateY(-1px);
}

.voice-button.recording {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  animation: recording-wave 1.4s infinite;
}

@keyframes recording-wave {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45);
  }

  70% {
    box-shadow: 0 0 0 18px rgba(239, 68, 68, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.bubble-fade-enter-active,
.bubble-fade-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}

.bubble-fade-enter-from,
.bubble-fade-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.96);
}

@media (max-width: 900px) {
  .chat-stage-page {
    padding: 18px 14px 16px;
  }

  .top-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .status-cluster {
    justify-content: flex-start;
  }

  .stage-frame {
    min-height: 62vh;
    border-radius: 28px;
  }

  #digital-human-video {
    width: min(620px, 84vw);
  }

  .reply-bubble {
    top: 18px;
    left: 18px;
    width: min(360px, calc(100% - 36px));
  }

  .composer-wrap {
    grid-template-columns: 1fr;
  }

  .composer-wrap :deep(.el-button),
  .voice-button {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .brand-copy h1 {
    font-size: 28px;
  }

  .brand-copy p,
  .placeholder-text,
  .reply-bubble p {
    font-size: 14px;
  }

  .stage-frame {
    min-height: 54vh;
  }

  #digital-human-video {
    width: min(520px, 92vw);
  }

  .reply-bubble {
    padding: 16px 16px 14px;
    border-radius: 22px;
  }

  .reply-bubble::after {
    left: 22px;
    width: 24px;
    height: 24px;
  }

  .stage-actions {
    align-items: stretch;
  }

  .button-row {
    width: 100%;
  }

  .button-row :deep(.el-button) {
    width: 100%;
  }
}
</style>
