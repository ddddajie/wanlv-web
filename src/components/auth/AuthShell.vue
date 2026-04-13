<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  panelTitle: {
    type: String,
    default: '',
  },
  panelDescription: {
    type: String,
    default: '',
  },
  highlights: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <div class="auth-shell">
    <section class="auth-shell__hero">
      <div class="auth-shell__copy glass-card">
        <span class="auth-shell__eyebrow">{{ eyebrow }}</span>
        <h1 class="auth-shell__title">{{ title }}</h1>
        <p class="auth-shell__description">{{ description }}</p>

        <div class="auth-shell__highlights">
          <div
            v-for="item in highlights"
            :key="item.title"
            class="auth-shell__highlight"
          >
            <div class="auth-shell__highlight-title">{{ item.title }}</div>
            <div class="auth-shell__highlight-desc">{{ item.description }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="auth-shell__panel glass-card">
      <div class="auth-shell__panel-head">
        <h2>{{ panelTitle }}</h2>
        <p>{{ panelDescription }}</p>
      </div>

      <slot />
    </section>
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 24px;
  padding: 24px;
}

.auth-shell__hero {
  display: flex;
  align-items: stretch;
}

.auth-shell__copy,
.auth-shell__panel {
  width: 100%;
}

.auth-shell__copy {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px;
  overflow: hidden;
  position: relative;
}

.auth-shell__copy::before,
.auth-shell__copy::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  filter: blur(10px);
}

.auth-shell__copy::before {
  width: 240px;
  height: 240px;
  top: -50px;
  right: -40px;
  background: rgba(249, 115, 22, 0.18);
}

.auth-shell__copy::after {
  width: 320px;
  height: 320px;
  bottom: -120px;
  left: -60px;
  background: rgba(14, 165, 233, 0.16);
}

.auth-shell__eyebrow {
  width: fit-content;
  padding: 7px 12px;
  border-radius: 999px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 700;
  background: rgba(15, 118, 110, 0.1);
}

.auth-shell__title {
  max-width: 560px;
  margin: 20px 0 14px;
  color: #0f172a;
  font-size: clamp(32px, 6vw, 52px);
  line-height: 1.08;
}

.auth-shell__description {
  max-width: 520px;
  margin: 0;
  color: #475569;
  font-size: 16px;
}

.auth-shell__highlights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-top: 36px;
}

.auth-shell__highlight {
  position: relative;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.auth-shell__highlight-title {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.auth-shell__highlight-desc {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.auth-shell__panel {
  align-self: center;
  padding: 34px 30px;
}

.auth-shell__panel-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 28px;
}

.auth-shell__panel-head p {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 14px;
}

@media (max-width: 980px) {
  .auth-shell {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .auth-shell__copy {
    padding: 28px;
  }

  .auth-shell__panel {
    padding: 28px 22px;
  }
}
</style>
