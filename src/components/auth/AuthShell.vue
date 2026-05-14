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
      <div class="auth-shell__scenery" aria-hidden="true">
        <span class="auth-shell__sun" />
        <span class="auth-shell__ridge auth-shell__ridge--back" />
        <span class="auth-shell__ridge auth-shell__ridge--front" />
        <span class="auth-shell__water" />
      </div>

      <div class="auth-shell__copy">
        <div class="auth-shell__topbar">
          <span class="auth-shell__eyebrow">{{ eyebrow }}</span>
          <slot name="hero-actions" />
        </div>

        <div class="auth-shell__headline">
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>

        <div class="auth-shell__highlights">
          <article v-for="item in highlights" :key="item.title" class="auth-shell__highlight">
            <span>{{ item.title }}</span>
            <strong>{{ item.description }}</strong>
          </article>
        </div>
      </div>
    </section>

    <section class="auth-shell__panel wl-panel">
      <div class="auth-shell__panel-head">
        <span>Wanlv Access</span>
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
  grid-template-columns: minmax(0, 1.08fr) minmax(390px, 0.72fr);
  gap: 20px;
  padding: 20px;
}

.auth-shell__hero {
  position: relative;
  min-height: calc(100vh - 40px);
  overflow: hidden;
  border-radius: var(--wl-radius-lg);
  background:
    linear-gradient(180deg, rgba(11, 64, 58, 0.1), rgba(11, 64, 58, 0.54)),
    linear-gradient(135deg, #dff4ee 0%, #dcecf7 54%, #fff2d8 100%);
  box-shadow: var(--wl-shadow-md);
}

.auth-shell__scenery {
  position: absolute;
  inset: 0;
}

.auth-shell__sun {
  position: absolute;
  top: 11%;
  right: 12%;
  width: 124px;
  height: 124px;
  border-radius: 999px;
  background: #f7c75f;
  box-shadow: 0 0 70px rgba(247, 199, 95, 0.46);
}

.auth-shell__ridge {
  position: absolute;
  right: -6%;
  bottom: 13%;
  left: -6%;
  height: 46%;
  clip-path: polygon(0 72%, 14% 42%, 27% 58%, 42% 25%, 56% 52%, 72% 18%, 88% 46%, 100% 31%, 100% 100%, 0 100%);
}

.auth-shell__ridge--back {
  background: rgba(47, 128, 192, 0.26);
}

.auth-shell__ridge--front {
  bottom: 0;
  height: 52%;
  background: linear-gradient(180deg, rgba(15, 111, 99, 0.86), rgba(9, 66, 58, 0.98));
}

.auth-shell__water {
  position: absolute;
  right: -8%;
  bottom: -12%;
  left: -8%;
  height: 28%;
  border-radius: 50% 50% 0 0;
  background: rgba(226, 244, 239, 0.26);
}

.auth-shell__copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 100%;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(28px, 4vw, 56px);
  color: #fff;
}

.auth-shell__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.auth-shell__eyebrow {
  width: fit-content;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.auth-shell__headline {
  max-width: 640px;
  padding: 72px 0;
}

.auth-shell__headline h1 {
  margin: 0;
  font-size: clamp(38px, 6.2vw, 72px);
  line-height: 1.02;
  letter-spacing: 0;
}

.auth-shell__headline p {
  max-width: 540px;
  margin: 18px 0 0;
  color: rgba(255, 255, 255, 0.84);
  font-size: 16px;
  line-height: 1.8;
}

.auth-shell__highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.auth-shell__highlight {
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--wl-radius-sm);
  background: rgba(255, 255, 255, 0.13);
}

.auth-shell__highlight span {
  display: block;
  color: rgba(255, 255, 255, 0.76);
  font-size: 12px;
}

.auth-shell__highlight strong {
  display: block;
  margin-top: 8px;
  color: #fff;
  font-size: 13px;
  line-height: 1.55;
}

.auth-shell__panel {
  align-self: center;
  padding: 28px;
}

.auth-shell__panel-head {
  margin-bottom: 22px;
}

.auth-shell__panel-head span {
  color: var(--wl-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.auth-shell__panel-head h2 {
  margin: 8px 0 8px;
  color: var(--wl-ink);
  font-size: 28px;
  line-height: 1.2;
}

.auth-shell__panel-head p {
  margin: 0;
  color: var(--wl-muted);
  font-size: 14px;
  line-height: 1.65;
}

@media (max-width: 1040px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }

  .auth-shell__hero {
    min-height: 520px;
  }

  .auth-shell__panel {
    align-self: stretch;
  }
}

@media (max-width: 680px) {
  .auth-shell {
    padding: 12px;
  }

  .auth-shell__hero {
    min-height: 580px;
  }

  .auth-shell__copy {
    padding: 22px;
  }

  .auth-shell__topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .auth-shell__highlights {
    grid-template-columns: 1fr;
  }

  .auth-shell__panel {
    padding: 22px;
  }
}
</style>
