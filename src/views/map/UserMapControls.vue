<script setup>
import {
  AddOutline,
  ChevronDownOutline,
  FlagOutline,
  LocateOutline,
  LocationOutline,
  MapOutline,
  NavigateOutline,
  RefreshOutline,
  RemoveOutline,
} from '@vicons/ionicons5'

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
  <!-- 重点：右下角只保留高频地图操作，复杂信息统一交给 TouristMap 信息浮层承载。 -->
  <div class="user-map-controls pointer-events-auto">
    <div class="user-map-controls__stack" aria-label="地图缩放">
      <n-tooltip placement="left">
        <template #trigger>
          <n-button quaternary circle class="user-map-controls__button" @click="emit('zoom-in')">
            <template #icon><n-icon><AddOutline /></n-icon></template>
          </n-button>
        </template>
        放大地图
      </n-tooltip>
      <n-tooltip placement="left">
        <template #trigger>
          <n-button quaternary circle class="user-map-controls__button" @click="emit('zoom-out')">
            <template #icon><n-icon><RemoveOutline /></n-icon></template>
          </n-button>
        </template>
        缩小地图
      </n-tooltip>
    </div>

    <div class="user-map-controls__stack" aria-label="地图工具">
      <n-tooltip placement="left">
        <template #trigger>
          <n-button quaternary circle class="user-map-controls__button" @click="emit('fit-view')">
            <template #icon><n-icon><NavigateOutline /></n-icon></template>
          </n-button>
        </template>
        回到景区
      </n-tooltip>
      <n-tooltip placement="left">
        <template #trigger>
          <n-button quaternary circle class="user-map-controls__button" @click="emit('locate')">
            <template #icon><n-icon><LocateOutline /></n-icon></template>
          </n-button>
        </template>
        定位
      </n-tooltip>
      <n-tooltip placement="left">
        <template #trigger>
          <n-button quaternary circle class="user-map-controls__button" :loading="loading" :disabled="loading" @click="emit('refresh')">
            <template #icon><n-icon><RefreshOutline /></n-icon></template>
          </n-button>
        </template>
        刷新地图
      </n-tooltip>
    </div>

    <button type="button" class="user-map-controls__summary" :aria-expanded="panelOpen" @click="emit('toggle-panel')">
      <span class="user-map-controls__summary-title">
        <n-icon><MapOutline /></n-icon>
        地图说明
      </span>
      <span class="user-map-controls__summary-grid">
        <span><n-icon><LocationOutline /></n-icon>{{ spotCount }} 个景点</span>
        <span><n-icon><FlagOutline /></n-icon>{{ routeCount }} 条路线</span>
        <span><n-icon><MapOutline /></n-icon>{{ featureCount }} 个要素</span>
      </span>
      <n-icon class="user-map-controls__chevron" :class="{ 'is-open': panelOpen }"><ChevronDownOutline /></n-icon>
    </button>
  </div>
</template>

<style scoped>
.user-map-controls {
  display: grid;
  gap: 12px;
  justify-items: end;
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
  width: 48px;
  height: 48px;
  border-radius: 0;
  color: #0f172a;
}

.user-map-controls__stack :deep(.n-tooltip-trigger:not(:last-child)) .user-map-controls__button {
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.user-map-controls__button:hover,
.user-map-controls__button:focus-visible {
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

.user-map-controls__summary:hover {
  background: #f8fafc;
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

  .user-map-controls__summary {
    display: none;
  }
}
</style>
