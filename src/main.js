import { createApp } from 'vue'
import './style.css'
import naive from 'naive-ui'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'

const app = createApp(App)
pinia.use(piniaPluginPersistedstate)

app.use(naive)
app.use(ElementPlus, { locale: zhCn })
app.use(pinia)
app.use(router)
app.mount('#app')
