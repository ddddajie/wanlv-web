<script setup>
import {
  Aim,
  ArrowDown,
  Flag,
  Location,
  MapLocation,
  Minus,
  Place,
  Plus,
  Refresh,
} from '@element-plus/icons-vue'

defineProps({
  scenicArea: {
    type: Object,
    default: null,
  },
  spotCount: {
    type: Number,
    default: 0,
  },
  routeCount: {
    type: Number,
    default: 0,
  },
  featureCount: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  panelOpen: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['zoom-in', 'zoom-out', 'fit-view', 'locate', 'refresh', 'toggle-panel'])
</script>

<template>
  <div class="user-map-controls">
    <div class="user-map-controls__stack" aria-label="地图缩放">
      <el-tooltip content="放大地图" placement="left">
        <button type="button" class="user-map-controls__button" @click="emit('zoom-in')">
          <el-icon><Plus /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="缩小地图" placement="left">
        <button type="button" class="user-map-controls__button" @click="emit('zoom-out')">
          <el-icon><Minus /></el-icon>
        </button>
      </el-tooltip>
    </div>

    <div class="user-map-controls__stack" aria-label="地图工具">
      <el-tooltip content="回到景区" placement="left">
        <button type="button" class="user-map-controls__button" @click="emit('fit-view')">
          <el-icon><Aim /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="定位" placement="left">
        <button type="button" class="user-map-controls__button" @click="emit('locate')">
          <el-icon><Location /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="刷新地图" placement="left">
        <button type="button" class="user-map-controls__button" :disabled="loading" @click="emit('refresh')">
          <el-icon :class="{ 'is-loading': loading }"><Refresh /></el-icon>
        </button>
      </el-tooltip>
    </div>

    <button type="button" class="user-map-controls__summary" @click="emit('toggle-panel')">
      <span class="user-map-controls__summary-title">
        <el-icon><MapLocation /></el-icon>
        地图说明
      </span>
      <span class="user-map-controls__summary-grid">
        <span><el-icon><Place /></el-icon>{{ spotCount }} 个景点</span>
        <span><el-icon><Flag /></el-icon>{{ routeCount }} 条路线</span>
        <span><el-icon><MapLocation /></el-icon>{{ featureCount }} 个要素</span>
      </span>
      <el-icon class="user-map-controls__chevron" :class="{ 'is-open': panelOpen }"><ArrowDown /></el-icon>
    </button>
  </div>
</template>

<style scoped>
.user-map-controls {
  display: grid;
  gap: 12px;
  justify-items: end;
  pointer-events: auto;
}

.user-map-controls__stack {
  display: grid;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
}

.user-map-controls__button {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  background: transparent;
  color: #0f172a;
  cursor: pointer;
}

.user-map-controls__button:last-child {
  border-bottom: 0;
}

.user-map-controls__button:disabled {
  color: #94a3b8;
  cursor: wait;
}

.user-map-controls__button .el-icon {
  font-size: 28px;
}

.user-map-controls__button:hover {
  background: #f8fafc;
}

.user-map-controls__summary {
  display: none;
  width: min(360px, calc(100vw - 32px));
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  padding: 12px 42px 12px 14px;
  position: relative;
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  text-align: left;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
}

.user-map-controls__summary-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 800;
}

.user-map-controls__summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 8px;
  color: #475569;
  font-size: 12px;
}

.user-map-controls__summary-grid span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.user-map-controls__chevron {
  position: absolute;
  top: 16px;
  right: 14px;
  transition: transform 0.2s ease;
}

.user-map-controls__chevron.is-open {
  transform: rotate(180deg);
}

.is-loading {
  animation: user-map-spin 0.8s linear infinite;
}

@keyframes user-map-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .user-map-controls {
    width: auto;
    grid-template-columns: 1fr;
    align-items: end;
    gap: 8px;
  }

  .user-map-controls__stack {
    justify-self: end;
  }

  .user-map-controls__button {
    width: 38px;
    height: 38px;
  }

  .user-map-controls__button .el-icon {
    font-size: 22px;
  }

  .user-map-controls__summary {
    display: none;
  }
}
</style>
