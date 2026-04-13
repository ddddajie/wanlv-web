<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchChat, fetchDigitalHuman, sendWebRTCOffer } from '../api/chat';

const STUN_SERVER = 'stun:stun.l.google.com:19302';

const messages = ref([]);
const userInput = ref('');
const connectionStatus = ref('disconnected');
const isVoiceRecording = ref(false);
const videoSize = ref(100);
const sessionId = ref(0);
const loading = ref(false);
const pc = ref(null);
const mediaRecorder = ref(null);
const audioChunks = ref([]);
const recognition = ref(null);
const chatArea = ref(null);

const statusText = computed(() => {
  const map = {
    connected: '已连接',
    connecting: '连接中...',
    disconnected: '未连接',
  };
  return map[connectionStatus.value] ?? '未连接';
});

const statusTagType = computed(() => {
  const map = {
    connected: 'success',
    connecting: 'warning',
    disconnected: 'danger',
  };
  return map[connectionStatus.value] ?? 'info';
});

const scrollToChatBottom = async () => {
  await nextTick();
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight;
  }
};

watch(
  () => [messages.value.length, loading.value],
  () => {
    scrollToChatBottom();
  }
);

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

      const checkState = () => {
        if (pc.value?.iceGatheringState === 'complete') {
          pc.value.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.value.addEventListener('icegatheringstatechange', checkState);
    });

    const offerData = pc.value.localDescription;
    const response = await sendWebRTCOffer({ sdp: offerData.sdp, type: offerData.type });
    const answer = response.data;
    sessionId.value = answer.sessionid;
    await pc.value.setRemoteDescription(answer);
  } catch (error) {
    ElMessage.error(`WebRTC 协商失败：${error.message}`);
    connectionStatus.value = 'disconnected';
  }
};

const start = async () => {
  try {
    const config = {
      sdpSemantics: 'unified-plan',
      iceServers: [{ urls: [STUN_SERVER] }],
    };

    pc.value = new RTCPeerConnection(config);

    pc.value.addEventListener('track', (event) => {
      if (event.track.kind === 'video') {
        const videoElement = document.getElementById('digital-human-video');
        if (videoElement) {
          videoElement.srcObject = event.streams[0];
        }
      } else {
        const audioElement = document.getElementById('audio');
        if (audioElement) {
          audioElement.srcObject = event.streams[0];
        }
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
      }
    });

    await negotiate();
  } catch (error) {
    ElMessage.error(`启动连接失败：${error.message}`);
    connectionStatus.value = 'disconnected';
  }
};

const stop = () => {
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

const handleStopConnect = () => {
  stop();
};

const sendChatMessage = async () => {
  const message = userInput.value.trim();
  if (!message || loading.value) {
    return;
  }

  messages.value.push({ type: 'user', content: message });
  userInput.value = '';
  loading.value = true;
  await scrollToChatBottom();

  try {
    const response = await fetchChat({
      query: message,
      session_id: sessionId.value.toString(),
    });

    const agentResponse = response.data.response || '暂时没有获取到回复。';
    const cleanedResponse = agentResponse.replace(/\*\*|\*|#|\[|\]|\(|\)/g, '').trim();

    messages.value.push({ type: 'agent', content: agentResponse });

    try {
      await fetchDigitalHuman({
        type: 'echo',
        text: cleanedResponse,
        sessionid: sessionId.value,
      });
    } catch (error) {
      console.error('数字人播报失败:', error);
      ElMessage.warning('文本已返回，数字人播报暂时失败。');
    }
  } catch (error) {
    console.error('聊天请求失败:', error);
    messages.value.push({
      type: 'agent',
      content: '抱歉，处理请求时发生错误，请稍后再试。',
    });
    ElMessage.error('聊天请求失败，请稍后重试。');
  } finally {
    loading.value = false;
    await scrollToChatBottom();
  }
};

const handleVoiceRecordStart = async () => {
  if (isVoiceRecording.value) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks.value = [];
    mediaRecorder.value = new MediaRecorder(stream);

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data);
      }
    };

    mediaRecorder.value.start();
    isVoiceRecording.value = true;

    if (recognition.value) {
      recognition.value.start();
    }
  } catch (error) {
    console.error('麦克风访问失败:', error);
    ElMessage.error('无法访问麦克风，请检查浏览器权限设置。');
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
    const recognizedText = userInput.value.trim();
    if (recognizedText) {
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
        userInput.value = interimTranscript;
      }
    }

    if (finalTranscript) {
      userInput.value = finalTranscript;
    }
  };

  recognition.value.onerror = (event) => {
    console.error('语音识别错误:', event.error);
  };
};

const handleBeforeUnload = () => {
  cleanupPeerConnection();
};

onMounted(() => {
  initSpeechRecognition();
  scrollToChatBottom();
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('unload', handleBeforeUnload);
});

onUnmounted(() => {
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
  <div class="chat-page">
    <div class="chat-shell">
      <section class="hero-section">
        <div class="hero-copy">
          <span class="hero-kicker">Wanlv AI Chat</span>
          <h1>智能对话系统</h1>
          <p>使用 Element Plus 重构聊天界面，支持桌面双栏和移动端纵向自适应布局。</p>
        </div>

        <div class="hero-meta">
          <el-tag :type="statusTagType" effect="dark" round>{{ statusText }}</el-tag>
          <div class="session-badge">会话 ID：{{ sessionId || '--' }}</div>
        </div>
      </section>

      <section class="content-grid">
        <el-card class="panel panel-chat" shadow="never">
          <template #header>
            <div class="panel-header">
              <div>
                <h2>对话窗口</h2>
                <p>支持文本消息展示、加载反馈和语音转写输入。</p>
              </div>
              <el-tag type="info" round>{{ messages.length }} 条消息</el-tag>
            </div>
          </template>

          <div ref="chatArea" class="chat-stream">
            <el-empty
              v-if="!messages.length && !loading"
              description="开始发送第一条消息吧"
              :image-size="120"
            />

            <div
              v-for="(msg, index) in messages"
              :key="index"
              class="message-row"
              :class="msg.type"
            >
              <div class="message-avatar">{{ msg.type === 'user' ? '我' : 'AI' }}</div>
              <div class="message-bubble">
                <div class="message-role">{{ msg.type === 'user' ? '我的消息' : 'AI 回复' }}</div>
                <p>{{ msg.content }}</p>
              </div>
            </div>

            <div v-if="loading" class="message-row agent">
              <div class="message-avatar">AI</div>
              <div class="message-bubble loading-bubble">
                <div class="message-role">AI 回复</div>
                <div class="typing-row">
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                  <span>正在思考中...</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <el-card class="panel panel-video" shadow="never">
          <template #header>
            <div class="panel-header">
              <div>
                <h2>数字人面板</h2>
                <p>管理连接状态、视频缩放和语音输入。</p>
              </div>
              <el-tag :type="statusTagType" round>{{ statusText }}</el-tag>
            </div>
          </template>

          <div class="video-stage">
            <div class="video-frame">
              <video
                id="digital-human-video"
                autoplay
                playsinline
                :style="{ width: `${videoSize}%` }"
              ></video>
              <audio id="audio" autoplay></audio>

              <div v-if="connectionStatus !== 'connected'" class="video-placeholder">
                <div class="placeholder-title">等待连接数字人</div>
                <div class="placeholder-text">连接成功后，实时画面会显示在这里。</div>
              </div>

              <div v-if="isVoiceRecording" class="recording-badge">录音中</div>
            </div>

            <div class="action-row">
              <el-button
                v-if="connectionStatus !== 'connected'"
                type="primary"
                size="large"
                class="action-button"
                @click="handleStartConnect"
              >
                {{ connectionStatus === 'connecting' ? '连接中...' : '开始连接' }}
              </el-button>
              <el-button
                v-else
                type="danger"
                plain
                size="large"
                class="action-button"
                @click="handleStopConnect"
              >
                断开连接
              </el-button>
            </div>

            <div class="control-card">
              <div class="control-title">画面缩放</div>
              <div class="control-desc">拖动滑块调整数字人视频显示比例。</div>
              <el-slider v-model="videoSize" :min="50" :max="150" show-input />
            </div>

            <div class="control-card voice-card">
              <div class="control-title">语音输入</div>
              <div class="control-desc">按住按钮开始录音，松开后自动识别并发送。</div>
              <button
                type="button"
                class="voice-record-btn"
                :class="{ 'recording-pulse': isVoiceRecording }"
                @mousedown="handleVoiceRecordStart"
                @mouseup="handleVoiceRecordStop"
                @mouseleave="handleVoiceRecordStop"
                @touchstart.prevent="handleVoiceRecordStart"
                @touchend="handleVoiceRecordStop"
              >
                {{ isVoiceRecording ? '松开发送' : '按住说话' }}
              </button>
            </div>
          </div>
        </el-card>
      </section>

      <el-card class="composer-card" shadow="never">
        <div class="composer">
          <el-input
            v-model="userInput"
            size="large"
            clearable
            placeholder="请输入您想咨询的内容..."
            @keydown.enter.prevent="sendChatMessage"
          />
          <el-button type="primary" size="large" :loading="loading" @click="sendChatMessage">
            发送消息
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  min-height: 100vh;
  padding: 24px;
  text-align: left;
  background:
    radial-gradient(circle at top left, rgba(64, 158, 255, 0.16), transparent 28%),
    radial-gradient(circle at top right, rgba(103, 194, 58, 0.12), transparent 26%),
    linear-gradient(180deg, #f3f7ff 0%, #eef3f9 100%);
}

.chat-shell {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hero-section {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 28px 32px;
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(64, 158, 255, 0.96), rgba(24, 109, 242, 0.88)),
    linear-gradient(180deg, #409eff, #186df2);
  color: #fff;
  box-shadow: 0 24px 48px rgba(24, 109, 242, 0.16);
}

.hero-copy {
  max-width: 720px;
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 16px 0 10px;
  font-size: clamp(32px, 4vw, 48px);
  line-height: 1.1;
  color: #fff;
}

.hero-copy p {
  max-width: 640px;
  font-size: 15px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.9);
}

.hero-meta {
  min-width: 180px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.session-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 14px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
  gap: 20px;
}

.panel {
  border: 0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
}

:deep(.panel > .el-card__header) {
  padding: 22px 24px 0;
  border-bottom: 0;
}

:deep(.panel > .el-card__body) {
  padding: 20px 24px 24px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-header h2 {
  margin: 0;
  font-size: 22px;
  color: #10233e;
}

.panel-header p {
  margin-top: 6px;
  font-size: 14px;
  color: #667085;
}

.chat-stream {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 560px;
  max-height: 68vh;
  padding-right: 6px;
  overflow-y: auto;
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.message-row.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 700;
}

.message-row.agent .message-avatar {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
  color: #15803d;
}

.message-bubble {
  max-width: min(78%, 640px);
  padding: 14px 16px;
  border-radius: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.message-row.user .message-bubble {
  background: linear-gradient(135deg, #409eff, #1d4ed8);
  border-color: transparent;
  color: #fff;
}

.message-role {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
}

.message-row.user .message-role {
  color: rgba(255, 255, 255, 0.78);
}

.message-bubble p {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.loading-bubble {
  min-width: 180px;
}

.typing-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #475467;
  font-size: 14px;
}

.typing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #409eff;
  animation: typing-bounce 1.2s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }

  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.video-stage {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.video-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, rgba(64, 158, 255, 0.18), transparent 24%),
    linear-gradient(160deg, #0f172a, #1e293b 65%, #0b1120);
}

#digital-human-video {
  max-width: none;
  height: 100%;
  object-fit: contain;
  z-index: 1;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: rgba(255, 255, 255, 0.82);
}

.placeholder-title {
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: 700;
}

.placeholder-text {
  max-width: 240px;
  font-size: 14px;
  line-height: 1.7;
}

.recording-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.action-row {
  display: flex;
}

.action-button {
  width: 100%;
}

.control-card {
  padding: 18px;
  border-radius: 20px;
  background: #f8fbff;
  border: 1px solid #dce7f5;
}

.control-title {
  margin-bottom: 6px;
  font-size: 16px;
  font-weight: 700;
  color: #10233e;
}

.control-desc {
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.7;
  color: #667085;
}

.voice-card {
  text-align: center;
}

.voice-record-btn {
  width: 100%;
  min-height: 52px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #409eff, #1d4ed8);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
  box-shadow: 0 14px 30px rgba(29, 78, 216, 0.22);
}

.voice-record-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 30px rgba(29, 78, 216, 0.24);
}

.voice-record-btn:active {
  transform: scale(0.98);
}

.recording-pulse {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
  }

  70% {
    box-shadow: 0 0 0 16px rgba(239, 68, 68, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.composer-card {
  border: 0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
}

:deep(.composer-card > .el-card__body) {
  padding: 20px 24px;
}

.composer {
  display: flex;
  align-items: center;
  gap: 14px;
}

.composer :deep(.el-input__wrapper) {
  min-height: 52px;
  border-radius: 16px;
  box-shadow: 0 0 0 1px #d0d9e5 inset;
}

.composer :deep(.el-button) {
  min-width: 132px;
  min-height: 52px;
  border-radius: 16px;
}

@media (max-width: 1080px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .chat-stream {
    min-height: 440px;
    max-height: 52vh;
  }

  .video-frame {
    min-height: 360px;
  }
}

@media (max-width: 768px) {
  .chat-page {
    padding: 14px;
  }

  .hero-section {
    padding: 22px 20px;
    flex-direction: column;
  }

  .hero-meta {
    min-width: 0;
    width: 100%;
    align-items: flex-start;
  }

  :deep(.panel > .el-card__header) {
    padding: 18px 18px 0;
  }

  :deep(.panel > .el-card__body) {
    padding: 18px;
  }

  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .chat-stream {
    min-height: 360px;
    max-height: none;
  }

  .message-bubble {
    max-width: calc(100% - 54px);
  }

  .video-frame {
    min-height: 280px;
  }

  .composer {
    flex-direction: column;
  }

  .composer :deep(.el-button) {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .hero-copy h1 {
    margin-top: 14px;
    font-size: 28px;
  }

  .hero-copy p,
  .panel-header p,
  .control-desc,
  .message-bubble p {
    font-size: 13px;
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
    border-radius: 12px;
  }

  .message-bubble {
    padding: 12px 14px;
  }

  .video-frame {
    min-height: 240px;
    border-radius: 20px;
  }

  .control-card {
    padding: 16px;
  }
}
</style>
