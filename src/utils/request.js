import axios from 'axios'
import { pinia, useUserStore } from '@/stores'
import { message as feedbackMessage } from '@/utils/feedback'

const targetBaseUrl = import.meta.env.VITE_API_BASE_URL
const baseURL = import.meta.env.DEV ? '/api' : targetBaseUrl

const instance = axios.create({
  baseURL,
  timeout: 600000,
  headers: {
    'Content-Type': 'application/json',
  },
})

function redirectToLogin(userType) {
  if (typeof window === 'undefined') return

  const loginPath = userType === 'admin' ? '/admin/login' : '/normal/login'
  const currentPath = `${window.location.pathname}${window.location.search}`

  if (currentPath.startsWith(loginPath)) return

  const redirect = encodeURIComponent(currentPath || '/dashboard')
  window.location.replace(`${loginPath}?redirect=${redirect}`)
}

function handleUnauthorized(message = '请先登录') {
  const userStore = useUserStore(pinia)
  const userType = userStore.userType

  userStore.clearLogin()
  feedbackMessage.error(message)
  redirectToLogin(userType)
}

instance.interceptors.request.use((config) => {
  const userStore = useUserStore(pinia)

  // 登录成功后统一携带 JWT，后端通过 Authorization 头完成权限校验。
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }

  return config
})

instance.interceptors.response.use(
  (response) => {
    const payload = response.data

    if (payload?.code === 401) {
      handleUnauthorized(payload?.msg)
      return Promise.reject(payload)
    }

    if (payload?.code !== 200) {
      const message = payload?.msg || '请求失败'
      feedbackMessage.error(message)
      return Promise.reject(payload)
    }

    return payload.data
  },
  (error) => {
    let message = error?.response?.data?.msg || error?.message || '网络异常'

    if (error?.response?.status === 401 || error?.response?.data?.code === 401) {
      handleUnauthorized(message)
      return Promise.reject(error)
    }

    if (error?.message?.includes('timeout')) {
      message = '请求超时，请稍后重试'
    }

    feedbackMessage.error(message)
    return Promise.reject(error)
  },
)

export default instance
export { baseURL, targetBaseUrl }
