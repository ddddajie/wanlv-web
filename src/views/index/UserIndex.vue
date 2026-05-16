<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  CloseOutline,
  InformationCircleOutline,
  LocationOutline,
  MapOutline,
  SparklesOutline,
  TicketOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import defaultSpotImage from '@/assets/default-spot.webp'
import { pageScenicAreasApi } from '@/api/map'
import { normalizePageResult } from '@/views/map/mapUtils'

const router = useRouter()

const scenicList = ref([])
const activeCategory = ref('all')
const loading = ref(false)
const isScenicInfoOpen = ref(false)
const selectedScenicInfo = ref(null)
const activeScenicIndex = ref(0)
const scenicTouchStartX = ref(0)
const scenicTouchStartY = ref(0)
const scenicTouchMoved = ref(false)
let scenicCarouselTimer = null

const categoryOptions = [
  { key: 'all', label: '综合推荐' },
  { key: 'family', label: '亲子同游' },
  { key: 'nature', label: '自然风光' },
  { key: 'culture', label: '历史人文' },
  { key: 'night', label: '夜游打卡' },
]

const scenicThemes = [
  'from-emerald-400 via-teal-600 to-amber-300',
  'from-sky-400 via-cyan-700 to-rose-200',
  'from-orange-300 via-rose-500 to-slate-700',
  'from-teal-300 via-emerald-700 to-yellow-200',
  'from-blue-300 via-indigo-700 to-orange-300',
]

const offerThemes = [
  {
    title: '亲子畅玩票',
    description: '适合周末轻松出游，覆盖热门景区的亲子同行场景。',
    price: '168',
    suffix: '元起',
    buttonText: '查看景区',
    gradient: 'from-emerald-500 via-teal-600 to-lime-400',
  },
  {
    title: '夜游双人票',
    description: '适合夜景、演艺与市集联动体验，主打轻量出行。',
    price: '99',
    suffix: '元起',
    buttonText: '查看门票',
    gradient: 'from-orange-400 via-amber-400 to-rose-400',
  },
  {
    title: '团队预约咨询',
    description: '适合企业团建、研学游与定制化服务预约。',
    price: '定制',
    suffix: '服务',
    buttonText: '联系咨询',
    gradient: 'from-indigo-500 via-violet-500 to-blue-500',
  },
]

function matchCategory(item, category) {
  if (category === 'all') return true

  const text = [item.scenicName, item.description, item.address, item.city, item.district]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const keywordMap = {
    family: ['亲子', '乐园', '动物', '儿童'],
    nature: ['自然', '森林', '山', '湖', '湿地', '峡谷'],
    culture: ['历史', '文化', '古城', '博物馆', '文博', '非遗'],
    night: ['夜', '灯', '演艺', '市集', '秀'],
  }

  return (keywordMap[category] || []).some((keyword) => text.includes(keyword))
}

const filteredScenicList = computed(() => {
  const matched = scenicList.value.filter((item) => matchCategory(item, activeCategory.value))
  return (matched.length ? matched : scenicList.value).slice(0, 5)
})

function normalizeScenicIndex(index, total = filteredScenicList.value.length) {
  if (!total) return 0
  return (index + total) % total
}

function getScenicSlidePosition(index) {
  const total = filteredScenicList.value.length
  if (total <= 1 || index === activeScenicIndex.value) return 'active'

  const forwardStep = normalizeScenicIndex(index - activeScenicIndex.value, total)
  const backwardStep = normalizeScenicIndex(activeScenicIndex.value - index, total)

  if (forwardStep === 1) return 'next'
  if (backwardStep === 1 && total > 2) return 'prev'
  if (forwardStep === 2) return 'far-next'
  if (backwardStep === 2) return 'far-prev'
  return 'hidden'
}

function setActiveScenicIndex(index) {
  activeScenicIndex.value = normalizeScenicIndex(index)
}

function showPrevScenic() {
  setActiveScenicIndex(activeScenicIndex.value - 1)
}

function showNextScenic() {
  setActiveScenicIndex(activeScenicIndex.value + 1)
}

function restartScenicCarousel() {
  stopScenicCarousel()
  if (filteredScenicList.value.length <= 1) return
  scenicCarouselTimer = window.setInterval(showNextScenic, 4200)
}

function stopScenicCarousel() {
  if (!scenicCarouselTimer) return
  window.clearInterval(scenicCarouselTimer)
  scenicCarouselTimer = null
}

function handleScenicCategoryChange(key) {
  activeCategory.value = key
  activeScenicIndex.value = 0
  restartScenicCarousel()
}

function handleScenicTouchStart(event) {
  const touch = event.touches?.[0]
  if (!touch) return
  scenicTouchStartX.value = touch.clientX
  scenicTouchStartY.value = touch.clientY
  scenicTouchMoved.value = false
  stopScenicCarousel()
}

function handleScenicTouchMove(event) {
  const touch = event.touches?.[0]
  if (!touch) return

  const distanceX = touch.clientX - scenicTouchStartX.value
  const distanceY = touch.clientY - scenicTouchStartY.value
  scenicTouchMoved.value = Math.abs(distanceX) > 12 && Math.abs(distanceX) > Math.abs(distanceY)
}

function handleScenicTouchEnd(event) {
  const touch = event.changedTouches?.[0]
  if (!touch) {
    restartScenicCarousel()
    return
  }

  const distanceX = touch.clientX - scenicTouchStartX.value
  const distanceY = touch.clientY - scenicTouchStartY.value

  // 重点：小屏游客更习惯横向滑动，超过阈值才切换，避免上下滚动页面时误触轮播。
  if (Math.abs(distanceX) > 46 && Math.abs(distanceX) > Math.abs(distanceY) * 1.2) {
    if (distanceX < 0) {
      showNextScenic()
    } else {
      showPrevScenic()
    }
  }

  scenicTouchMoved.value = false
  restartScenicCarousel()
}

// 重点：游客首页只保留景区推荐和信息查看，不再提供地图导览跳转入口。
async function loadScenicList() {
  loading.value = true
  try {
    const result = await pageScenicAreasApi({ current: 1, size: 12, status: 1 })
    scenicList.value = normalizePageResult(result).records || []
  } finally {
    loading.value = false
  }
}

function getScenicLocation(item) {
  const parts = [item.province, item.city, item.district].filter(Boolean)
  return parts.length ? parts.join(' · ') : item.address || '景区位置信息待完善'
}

function getScenicDescription(item) {
  return item.description || '这里将展示景区亮点、游玩氛围和适合人群，方便游客快速筛选目的地。'
}

function getScenicLevel(item) {
  return item.scenicLevel || item.levelName || item.grade || '热门景区'
}

function getScenicTheme(index) {
  return scenicThemes[index % scenicThemes.length]
}

function getScenicCoverImage(item) {
  return item.coverImageUrl || defaultSpotImage
}

function openScenicInfo(item) {
  selectedScenicInfo.value = item || null
  isScenicInfoOpen.value = true
}

function closeScenicInfo() {
  isScenicInfoOpen.value = false
}

const scenicInfoLocationText = computed(() => {
  const item = selectedScenicInfo.value
  if (!item) return ''
  const parts = [item.province, item.city, item.district].filter(Boolean)
  return parts.length ? parts.join(' / ') : item.address || '景区位置信息待完善'
})

const scenicInfoLevelText = computed(() => {
  const item = selectedScenicInfo.value
  return item?.scenicLevel || item?.levelName || item?.grade || '国家 AAAAA 级旅游景区'
})

function openReservationPage() {
  router.push({
    path: '/dashboard',
    query: {
      view: 'reservation-workspace',
    },
  })
}

onMounted(() => {
  loadScenicList()
  restartScenicCarousel()
})

onBeforeUnmount(() => {
  stopScenicCarousel()
})

watch(
  () => filteredScenicList.value.length,
  (length) => {
    activeScenicIndex.value = normalizeScenicIndex(activeScenicIndex.value, length)
    restartScenicCarousel()
  },
)

watch(activeCategory, () => {
  activeScenicIndex.value = 0
})
</script>

<template>
  <div class="user-index-page min-h-full overflow-auto bg-slate-50">
    <div class="user-index-shell">
      <div class="user-index-surface flex w-full flex-col gap-10">
        <section
          class="user-index-hero relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-teal-900 to-emerald-500 px-6 py-8 text-white md:px-8 md:py-10 lg:px-10">
          <div class="pointer-events-none absolute inset-0">
            <div class="absolute right-[-60px] top-[-40px] h-56 w-56 rounded-full bg-white/10 blur-2xl"></div>
            <div class="absolute bottom-[-48px] left-[-36px] h-40 w-72 rounded-full bg-white/10"></div>
            <div class="absolute bottom-0 right-0 h-48 w-2/5 clip-hero-mountain bg-white/10"></div>
          </div>
          <div
            class="user-index-hero__curve pointer-events-none absolute inset-x-[-8%] bottom-[-170px] h-[260px] rounded-[50%] bg-slate-50">
          </div>

          <div class="relative">
            <div class="space-y-6">
              <div class="space-y-4">
                <h1 class="max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.04em] md:text-5xl xl:text-6xl">
                  游客必玩景区
                  <span class="block bg-gradient-to-r from-amber-200 to-yellow-300 bg-clip-text text-transparent">
                    一眼找到适合你的目的地
                  </span>
                </h1>
                <p class="max-w-3xl text-sm leading-7 text-white/80 md:text-base">
                  这里保留游客首页最核心的景区推荐与优惠门票内容，帮助游客快速浏览热门景区、位置亮点和当前可选服务。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="user-index-section space-y-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div class="space-y-3">
              <div class="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-teal-700">
                <span>Scenic Spots</span>
                <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                <span>全部景区</span>
              </div>
              <div>
                <h2 class="text-3xl font-black tracking-[-0.04em] text-slate-900 md:text-5xl">游客必玩</h2>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <n-button v-for="item in categoryOptions" :key="item.key" round strong
              :type="activeCategory === item.key ? 'primary' : 'default'" :ghost="activeCategory !== item.key"
              :color="activeCategory === item.key ? '#0f8a73' : '#ffffff'"
              :text-color="activeCategory === item.key ? '#ffffff' : '#475569'" class="!shadow-sm"
              @click="handleScenicCategoryChange(item.key)">
              {{ item.label }}
            </n-button>
          </div>

          <n-spin :show="loading">
            <div v-if="filteredScenicList.length" class="user-index-scenic-carousel" @mouseenter="stopScenicCarousel"
              @mouseleave="restartScenicCarousel">
              <button v-if="filteredScenicList.length > 1" type="button"
                class="user-index-scenic-carousel__arrow user-index-scenic-carousel__arrow--prev" aria-label="切换到上一个景区"
                @click="showPrevScenic">
                <n-icon>
                  <ChevronBackOutline />
                </n-icon>
              </button>

              <!-- 重点：游客必玩改为轮播展示，所有卡片持续占位过渡，避免切换时两侧出现空白。 -->
              <div class="user-index-scenic-carousel__stage"
                @touchstart.passive="handleScenicTouchStart"
                @touchmove.passive="handleScenicTouchMove"
                @touchend.passive="handleScenicTouchEnd"
                @touchcancel.passive="restartScenicCarousel">
                <article v-for="(item, index) in filteredScenicList" :key="item.id || `${item.scenicName}-${index}`"
                  class="user-index-scenic-card group relative overflow-hidden rounded-[30px] text-white"
                  :class="`user-index-scenic-card--${getScenicSlidePosition(index)}`">
                  <div class="absolute inset-0 bg-gradient-to-br" :class="getScenicTheme(index)"></div>
                  <img :src="getScenicCoverImage(item)" :alt="item.scenicName || '景区封面'"
                    class="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-105" />
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-white/5"></div>

                  <div class="relative flex h-full flex-col justify-between p-5 md:p-7">
                    <div class="flex items-start justify-between gap-3">
                      <n-tag round :bordered="false" color="transparent" text-color="#ffffff">
                        {{ getScenicLevel(item) }}
                      </n-tag>
                      <span
                        class="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-white/85">
                        推荐值 {{ Number(item.recommendedLevel) || index + 1 }}
                      </span>
                    </div>

                    <div class="space-y-4">
                      <div>
                        <h3 class="text-2xl font-black tracking-[-0.03em] md:text-4xl">{{ item.scenicName || '未命名景区' }}
                        </h3>
                        <p class="mt-3 line-clamp-3 text-sm leading-6 text-white/80">
                          {{ getScenicDescription(item) }}
                        </p>
                      </div>

                      <div class="flex flex-wrap gap-2 text-xs text-white/85">
                        <span class="rounded-full border border-white/20 bg-white/12 px-3 py-1">
                          {{ getScenicLocation(item) }}
                        </span>
                        <span class="rounded-full border border-white/20 bg-white/12 px-3 py-1">
                          已启用景区
                        </span>
                      </div>

                      <div class="flex flex-wrap gap-3">
                        <n-button round strong type="primary" color="rgba(255,255,255,0.95)" text-color="#17333a"
                          @click="openScenicInfo(item)">
                          <template #icon>
                            <n-icon>
                              <InformationCircleOutline />
                            </n-icon>
                          </template>
                          景区信息
                        </n-button>
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <button v-if="filteredScenicList.length > 1" type="button"
                class="user-index-scenic-carousel__arrow user-index-scenic-carousel__arrow--next" aria-label="切换到下一个景区"
                @click="showNextScenic">
                <n-icon>
                  <ChevronForwardOutline />
                </n-icon>
              </button>

              <div v-if="filteredScenicList.length > 1" class="user-index-scenic-carousel__dots">
                <button v-for="(item, index) in filteredScenicList" :key="item.id || `${item.scenicName}-dot-${index}`"
                  type="button" class="user-index-scenic-carousel__dot"
                  :class="{ 'user-index-scenic-carousel__dot--active': index === activeScenicIndex }"
                  :aria-label="`切换到第 ${index + 1} 个景区`" @click="setActiveScenicIndex(index)"></button>
              </div>
            </div>

            <n-empty v-else-if="!loading" description="暂无可展示的游客首页景区内容" class="rounded-[28px] bg-slate-50 py-16" />
          </n-spin>
        </section>

        <section class="user-index-section space-y-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div class="space-y-3">
              <div class="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-teal-700">
                <span>Tickets & Offers</span>
                <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                <span>门票优惠</span>
              </div>
              <div>
                <h2 class="text-3xl font-black tracking-[-0.04em] text-slate-900 md:text-5xl">优惠门票</h2>
                <p class="mt-3 max-w-3xl text-sm leading-7 text-slate-500 md:text-base">
                  延续设计稿里的彩色优惠卡片表现，但移除了首页中的地图导览快捷入口，保持游客浏览更聚焦。
                </p>
              </div>
            </div>

            <n-button round strong secondary type="success" @click="openReservationPage">
              查看更多服务
            </n-button>
          </div>

          <div class="grid gap-5 lg:grid-cols-3">
            <article v-for="item in offerThemes" :key="item.title"
              class="relative overflow-hidden rounded-[30px] p-6 text-white shadow-[0_18px_44px_rgba(13,116,101,0.14)]">
              <div class="absolute inset-0 bg-gradient-to-br" :class="item.gradient"></div>
              <div class="absolute -bottom-14 -right-10 h-44 w-44 rounded-full bg-white/20"></div>
              <div class="relative flex min-h-[240px] flex-col">
                <div class="flex items-start justify-between gap-3">
                  <div class="rounded-2xl bg-white/18 p-3 backdrop-blur">
                    <n-icon size="22">
                      <TicketOutline />
                    </n-icon>
                  </div>
                  <n-tag round :bordered="false" type="warning">游客可见</n-tag>
                </div>

                <div class="mt-6 space-y-3">
                  <h3 class="text-2xl font-black">{{ item.title }}</h3>
                  <p class="max-w-xs text-sm leading-6 text-white/85">
                    {{ item.description }}
                  </p>
                </div>

                <div class="mt-auto flex items-end justify-between gap-3 pt-8">
                  <div>
                    <p class="text-sm text-white/75">{{ item.suffix }}</p>
                    <p class="text-3xl font-black tracking-[-0.03em]">{{ item.price }}</p>
                  </div>
                  <n-button round strong color="rgba(255,255,255,0.92)" text-color="#17333a"
                    @click="openReservationPage">
                    {{ item.buttonText }}
                  </n-button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>

    <n-modal v-model:show="isScenicInfoOpen" preset="card" class="user-index-scenic-modal" :bordered="false"
      :closable="false" :segmented="false" :style="{
        width: 'min(720px, calc(100vw - 32px))',
        '--n-padding-left': '0',
        '--n-padding-right': '0',
        '--n-padding-top': '0',
        '--n-padding-bottom': '0',
        '--n-color': 'transparent',
        '--n-color-modal': 'transparent',
        '--n-border-color': 'transparent',
      }">
      <div v-if="selectedScenicInfo" class="user-index-scenic-modal__body"
        :style="{ backgroundImage: `url(${getScenicCoverImage(selectedScenicInfo)})` }">
        <div class="user-index-scenic-modal__shade" aria-hidden="true"></div>
        <div class="user-index-scenic-modal__header">
          <div class="user-index-scenic-modal__eyebrow">
            <n-icon>
              <MapOutline />
            </n-icon>
            <span>景区信息</span>
          </div>
          <button type="button" class="user-index-scenic-modal__close" aria-label="关闭景区信息" @click="closeScenicInfo">
            <n-icon>
              <CloseOutline />
            </n-icon>
          </button>
        </div>
        <div class="user-index-scenic-modal__content">
          <section class="user-index-scenic-modal__hero">
            <div class="user-index-scenic-modal__copy">
              <h3 class="user-index-scenic-modal__title">{{ selectedScenicInfo.scenicName || '请选择景区' }}</h3>
              <span class="user-index-scenic-modal__level">{{ scenicInfoLevelText }}</span>
              <p class="user-index-scenic-modal__desc">
                {{ getScenicDescription(selectedScenicInfo) }}
              </p>
            </div>
          </section>

          <!-- 重点：详情弹窗直接叠加在景区图片上，减少内部卡片层级，让游客更聚焦景区本身。 -->
          <dl class="user-index-scenic-modal__list">
            <div class="user-index-scenic-modal__row">
              <span class="user-index-scenic-modal__icon">
                <n-icon>
                  <LocationOutline />
                </n-icon>
              </span>
              <dt>位置</dt>
              <dd>{{ scenicInfoLocationText }}</dd>
            </div>
            <div v-if="selectedScenicInfo.openingHours" class="user-index-scenic-modal__row">
              <span class="user-index-scenic-modal__icon">
                <n-icon>
                  <TimeOutline />
                </n-icon>
              </span>
              <dt>开放时间</dt>
              <dd>{{ selectedScenicInfo.openingHours }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
.clip-hero-mountain {
  clip-path: polygon(0 100%, 15% 52%, 30% 78%, 48% 30%, 60% 68%, 78% 18%, 100% 100%);
}

.user-index-page {
  width: 100%;
}

.user-index-shell {
  width: 100%;
}

.user-index-surface {
  width: 100%;
}

.user-index-hero {
  width: 100%;
  min-height: 340px;
  padding-bottom: 120px;
}

.user-index-hero__curve {
  transform: translateZ(0);
}

.user-index-section {
  width: 100%;
}

.user-index-scenic-carousel {
  position: relative;
  display: grid;
  gap: 18px;
  overflow: hidden;
  padding: 18px 72px 10px;
}

.user-index-scenic-carousel__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 470px;
  perspective: 1200px;
  touch-action: pan-y;
}

.user-index-scenic-card {
  position: absolute;
  width: min(680px, 58vw);
  min-height: 360px;
  will-change: transform, opacity;
  transition:
    transform 0.62s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.42s ease,
    filter 0.42s ease;
}

.user-index-scenic-card--active {
  z-index: 3;
  min-height: 430px;
  opacity: 1;
  transform: translateX(0) scale(1.08);
}

.user-index-scenic-card--prev,
.user-index-scenic-card--next,
.user-index-scenic-card--far-prev,
.user-index-scenic-card--far-next,
.user-index-scenic-card--hidden {
  z-index: 1;
  opacity: 0.58;
  filter: saturate(0.88);
  pointer-events: none;
}

.user-index-scenic-card--prev {
  transform: translateX(-58%) scale(0.78) rotateY(8deg);
}

.user-index-scenic-card--next {
  transform: translateX(58%) scale(0.78) rotateY(-8deg);
}

.user-index-scenic-card--far-prev {
  z-index: 0;
  opacity: 0;
  transform: translateX(-94%) scale(0.68) rotateY(12deg);
}

.user-index-scenic-card--far-next {
  z-index: 0;
  opacity: 0;
  transform: translateX(94%) scale(0.68) rotateY(-12deg);
}

.user-index-scenic-card--hidden {
  z-index: 0;
  opacity: 0;
  transform: translateX(0) scale(0.62);
}

.user-index-scenic-carousel__arrow {
  position: absolute;
  top: 50%;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border: 1px solid rgba(15, 118, 110, 0.14);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.92);
  color: #0f766e;
  font-size: 22px;
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    transform 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.user-index-scenic-carousel__arrow:hover {
  color: #0f172a;
  transform: translateY(-50%) scale(1.06);
}

.user-index-scenic-carousel__arrow--prev {
  left: 14px;
}

.user-index-scenic-carousel__arrow--next {
  right: 14px;
}

.user-index-scenic-carousel__dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.user-index-scenic-carousel__dot {
  width: 9px;
  height: 9px;
  border: 0;
  border-radius: 9999px;
  background: #cbd5e1;
  cursor: pointer;
  transition:
    width 0.2s ease,
    background 0.2s ease;
}

.user-index-scenic-carousel__dot--active {
  width: 28px;
  background: #0f8a73;
}

.user-index-scenic-modal :deep(.n-card) {
  overflow: hidden;
  border-radius: 28px;
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
}

:deep(.user-index-scenic-modal.n-card) {
  overflow: hidden;
  padding: 0 !important;
  border-radius: 28px;
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
}

.user-index-scenic-modal :deep(.n-card-header) {
  display: none;
}

.user-index-scenic-modal :deep(.n-card__content) {
  padding: 0 !important;
  background: transparent;
}

:deep(.user-index-scenic-modal.n-card > .n-card__content) {
  padding: 0 !important;
  background: transparent !important;
}

.user-index-scenic-modal__header {
  position: absolute;
  inset: 0 0 auto;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 26px 0;
}

.user-index-scenic-modal__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  font-weight: 700;
  text-shadow: 0 1px 8px rgba(15, 23, 42, 0.45);
}

.user-index-scenic-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(12px);
}

.user-index-scenic-modal__body {
  position: relative;
  overflow: hidden;
  min-height: 500px;
  border-radius: 28px;
  background-position: center;
  background-size: cover;
  color: #fff;
}

.user-index-scenic-modal__shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.56) 46%, rgba(15, 23, 42, 0.18) 100%),
    linear-gradient(0deg, rgba(15, 23, 42, 0.62) 0%, rgba(15, 23, 42, 0.08) 62%);
}

.user-index-scenic-modal__content {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 500px;
  flex-direction: column;
  justify-content: flex-end;
  gap: 28px;
  padding: 104px 34px 34px;
}

.user-index-scenic-modal__hero {
  position: relative;
  color: #fff;
}

.user-index-scenic-modal__copy {
  position: relative;
  display: grid;
  gap: 12px;
}

.user-index-scenic-modal__title {
  margin: 0;
  color: #fff;
  font-size: 40px;
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -0.04em;
  text-shadow: 0 2px 14px rgba(15, 23, 42, 0.5);
}

.user-index-scenic-modal__level {
  display: inline-flex;
  width: fit-content;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 13px;
  font-weight: 600;
  backdrop-filter: blur(10px);
}

.user-index-scenic-modal__desc {
  margin: 0;
  max-width: 520px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  line-height: 1.8;
  text-shadow: 0 1px 10px rgba(15, 23, 42, 0.42);
}

.user-index-scenic-modal__list {
  display: flex;
  flex-wrap: wrap;
  gap: 22px 30px;
  margin: 0;
}

.user-index-scenic-modal__row {
  display: grid;
  grid-template-columns: 24px auto;
  align-items: center;
  gap: 6px 10px;
  min-width: min(280px, 100%);
}

.user-index-scenic-modal__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  grid-row: span 2;
  width: 24px;
  height: 24px;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
}

.user-index-scenic-modal__row dt {
  color: rgba(255, 255, 255, 0.68);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}

.user-index-scenic-modal__row dd {
  margin: 0;
  color: rgba(255, 255, 255, 0.95);
  font-size: 15px;
  line-height: 1.5;
  text-shadow: 0 1px 8px rgba(15, 23, 42, 0.42);
}

.user-index-scenic-modal__footer {
  display: flex;
  justify-content: flex-end;
}

.user-index-section+.user-index-section {
  /* 重点：内部只保留轻分隔，让首页保持一整块结构。 */
  padding-top: 36px;
  border-top: 1px solid rgba(226, 232, 240, 0.82);
}

@media (max-width: 768px) {

  /* 重点：移动端保持统一边距，避免内容贴边影响阅读。 */
  .user-index-surface {
    gap: 24px;
  }

  .user-index-hero {
    border-radius: 24px;
    padding-bottom: 92px;
  }

  .user-index-hero__curve {
    inset-inline: -12%;
    bottom: -122px;
    height: 190px;
  }

  .user-index-scenic-carousel {
    padding: 4px 0 6px;
  }

  .user-index-scenic-carousel__stage {
    min-height: 350px;
    overflow: hidden;
  }

  .user-index-scenic-card {
    width: min(66vw, 268px);
    min-height: 300px;
  }

  .user-index-scenic-card--active {
    min-height: 320px;
    transform: translateX(0) scale(1);
  }

  .user-index-scenic-card--prev,
  .user-index-scenic-card--next {
    opacity: 0.46;
    filter: saturate(0.82);
  }

  .user-index-scenic-card--prev {
    transform: translateX(-66%) scale(0.82);
  }

  .user-index-scenic-card--next {
    transform: translateX(66%) scale(0.82);
  }

  .user-index-scenic-card--far-prev {
    opacity: 0;
    transform: translateX(-108%) scale(0.78);
  }

  .user-index-scenic-card--far-next {
    opacity: 0;
    transform: translateX(108%) scale(0.78);
  }

  .user-index-scenic-card--hidden {
    opacity: 0;
    transform: translateX(0) scale(0.72);
  }

  .user-index-scenic-carousel__arrow {
    top: 50%;
    bottom: auto;
    width: 36px;
    height: 36px;
    border: 0;
    background: transparent;
    color: #0f766e;
    font-size: 20px;
    transform: translateY(-50%);
  }

  .user-index-scenic-carousel__arrow:hover {
    color: #0f172a;
    transform: translateY(-50%) scale(1.04);
  }

  .user-index-scenic-carousel__arrow--prev {
    left: 12px;
  }

  .user-index-scenic-carousel__arrow--next {
    right: 12px;
  }

  .user-index-scenic-modal :deep(.n-card__content) {
    padding: 0;
  }

  .user-index-scenic-modal__header {
    padding: 18px 18px 0;
  }

  .user-index-scenic-modal__body,
  .user-index-scenic-modal__content {
    min-height: 460px;
  }

  .user-index-scenic-modal__shade {
    background:
      linear-gradient(0deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.38) 58%, rgba(15, 23, 42, 0.18) 100%);
  }

  .user-index-scenic-modal__content {
    gap: 22px;
    padding: 92px 22px 24px;
  }

  .user-index-scenic-modal__title {
    font-size: 30px;
  }

  .user-index-scenic-modal__desc {
    font-size: 14px;
    line-height: 1.7;
  }

  .user-index-scenic-modal__list {
    gap: 16px;
  }

  .user-index-scenic-modal__row {
    grid-template-columns: 24px 1fr;
  }

  .user-index-scenic-modal__row dt,
  .user-index-scenic-modal__row dd {
    grid-column: 2;
    line-height: 1.6;
  }

  .user-index-scenic-modal__row dt {
    margin-bottom: 4px;
  }

  .user-index-section+.user-index-section {
    padding-top: 28px;
  }
}

@media (min-width: 769px) {

  /* 重点：桌面端取消页面内部二次限宽，让内容区域和其他页面保持一致。 */
  .user-index-surface {
    gap: 28px;
  }
}
</style>
