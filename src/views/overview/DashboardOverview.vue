<script setup>
defineProps({
  targetBaseUrl: {
    type: String,
    default: '',
  },
  username: {
    type: String,
    default: '',
  },
  displayName: {
    type: String,
    default: '',
  },
  roleLabel: {
    type: String,
    default: '',
  },
  heroTitle: {
    type: String,
    default: '',
  },
  heroDescription: {
    type: String,
    default: '',
  },
  heroAlert: {
    type: Object,
    default: () => ({}),
  },
  canUseAnalysis: {
    type: Boolean,
    default: false,
  },
  userSummary: {
    type: Array,
    default: () => [],
  },
  actionCards: {
    type: Array,
    default: () => [],
  },
  capabilityList: {
    type: Array,
    default: () => [],
  },
  apiNotes: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['navigate'])

function handleNavigate(action) {
  emit('navigate', action)
}
</script>

<template>
  <div class="overview-panel">
    <section class="overview-hero">
      <div>
        <p class="overview-hero__eyebrow">Connected to {{ targetBaseUrl }}</p>
        <h2 class="overview-hero__title">
          {{ displayName || username || '欢迎使用万旅后台' }}，{{ heroTitle }}
        </h2>
        <p class="overview-hero__desc">{{ heroDescription }}</p>
      </div>

      <div class="overview-hero__side">
        <el-alert :title="heroAlert.title" :description="heroAlert.description" :type="heroAlert.type" :closable="false"
          show-icon />

        <div class="overview-hero__tags">
          <el-tag effect="dark" type="primary">{{ roleLabel }}</el-tag>
          <el-tag effect="plain" :type="canUseAnalysis ? 'success' : 'info'">
            {{ canUseAnalysis ? '可执行日报分析' : '只读访问' }}
          </el-tag>
        </div>
      </div>
    </section>

    <section class="overview-grid">
      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="panel-card__header">
            <span>账号信息</span>
            <el-tag effect="plain">{{ username || '-' }}</el-tag>
          </div>
        </template>

        <div class="summary-grid">
          <div v-for="item in userSummary" :key="item.label" class="summary-item">
            <span class="summary-item__label">{{ item.label }}</span>
            <strong class="summary-item__value">{{ item.value }}</strong>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="panel-card__header">
            <span>当前可用能力</span>
          </div>
        </template>

        <ul class="capability-list">
          <li v-for="item in capabilityList" :key="item">{{ item }}</li>
        </ul>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.overview-panel {
  display: grid;
  gap: 20px;
}

.overview-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
  gap: 20px;
  padding: 28px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(238, 247, 255, 0.9));
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.overview-hero__eyebrow {
  margin: 0 0 12px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.overview-hero__title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(28px, 4vw, 40px);
  line-height: 1.15;
}

.overview-hero__desc {
  margin: 16px 0 0;
  color: #475569;
  line-height: 1.8;
}

.overview-hero__side {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
}

.overview-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.panel-card {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
}

.panel-card :deep(.el-card__header) {
  border-bottom: 0;
  padding-bottom: 0;
}

.panel-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.panel-card__hint {
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.summary-item {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.summary-item__label {
  color: #64748b;
  font-size: 13px;
}

.summary-item__value {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.45;
  word-break: break-word;
}

.action-list {
  display: grid;
  gap: 14px;
}

.action-card {
  width: 100%;
  padding: 18px;
  text-align: left;
  border: 1px solid #dbe5f1;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(240, 249, 255, 0.98));
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.08);
}

.action-card__title {
  display: block;
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}

.action-card__desc {
  display: block;
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.action-card__link {
  display: inline-flex;
  margin-top: 14px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 700;
}

.capability-list {
  margin: 0;
  padding-left: 18px;
  color: #334155;
  line-height: 1.9;
}

.note-list {
  display: grid;
  gap: 12px;
  color: #334155;
  line-height: 1.8;
}

@media (max-width: 1120px) {

  .overview-hero,
  .overview-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .overview-hero {
    padding: 22px;
  }
}
</style>
