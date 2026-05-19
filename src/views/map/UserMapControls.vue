<script setup>
import {
  FlagOutline,
  InformationCircleOutline,
  LocateOutline,
  RefreshOutline,
} from '@vicons/ionicons5'

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  infoOpen: {
    type: Boolean,
    default: false,
  },
  routeOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['locate', 'refresh', 'toggle-info', 'toggle-routes'])
</script>

<template>
  <!-- 重点：景区信息和推荐路线都做成地图工具式 icon 小组件，避免占用顶部标题栏。 -->
  <div class="user-map-controls pointer-events-auto">
    <div class="user-map-controls__stack" aria-label="导游信息">
      <n-tooltip placement="left">
        <template #trigger>
          <n-button
            quaternary
            circle
            class="user-map-controls__button"
            :class="{ 'user-map-controls__button--active': infoOpen }"
            @click="emit('toggle-info')"
          >
            <template #icon><n-icon><InformationCircleOutline /></n-icon></template>
          </n-button>
        </template>
        景区信息
      </n-tooltip>
      <n-tooltip placement="left">
        <template #trigger>
          <n-button
            quaternary
            circle
            class="user-map-controls__button"
            :class="{ 'user-map-controls__button--active': routeOpen }"
            @click="emit('toggle-routes')"
          >
            <template #icon><n-icon><FlagOutline /></n-icon></template>
          </n-button>
        </template>
        推荐路线
      </n-tooltip>
    </div>

    <div class="user-map-controls__stack" aria-label="地图工具">
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
  overflow: visible;
  border: 0;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
}

.user-map-controls__button {
  width: 48px;
  height: 48px;
  border-radius: 0;
  background: transparent;
  color: #0f172a;
}

.user-map-controls__stack :deep(.n-tooltip-trigger:not(:last-child)) .user-map-controls__button {
  border-bottom: 0;
}

.user-map-controls__button:hover,
.user-map-controls__button:focus-visible {
  background: rgba(255, 255, 255, 0.42);
}

.user-map-controls__button--active {
  background: rgba(15, 118, 110, 0.1);
  color: #0f766e;
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
}
</style>
