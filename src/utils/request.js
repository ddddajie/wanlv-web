import axios from 'axios'
import { refreshNormalUserTokenApi } from '@/api/token'
import { pinia, useUserStore } from '@/stores'
import { message as feedbackMessage } from '@/utils/feedback'
import { baseURL, httpConfig, targetBaseUrl } from '@/utils/http-config'

const instance = axios.create(httpConfig)

let refreshing = null
let handlingUnauthorized = false

function redirectToLogin(userType) {
  if (typeof window === 'undefined') return

  const loginPath = userType === 'admin' ? '/admin/login' : '/normal/login'
  const currentPath = `${window.location.pathname}${window.location.search}`

  if (currentPath.startsWith(loginPath)) return

  const redirect = encodeURIComponent(currentPath || '/dashboard')
  window.location.replace(`${loginPath}?redirect=${redirect}`)
}

function handleUnauthorized(message = '登录状态已过期，请重新登录') {
  if (handlingUnauthorized) return
  handlingUnauthorized = true

  const userStore = useUserStore(pinia)
  const userType = userStore.userType

  userStore.clearLogin()
  feedbackMessage.error(message)
  redirectToLogin(userType)
}

function buildResponseError(response) {
  const error = new Error(response?.data?.msg || '登录状态已过期，请重新登录')
  error.config = response?.config
  error.response = response
  return error
}

async function retryAfterRefresh(error) {
  const originalRequest = error?.config
  const userStore = useUserStore(pinia)
  const isUnauthorized =
    error?.response?.status === 401 || error?.response?.data?.code === 401

  if (!isUnauthorized || !originalRequest) {
    return Promise.reject(error)
  }

  if (
    originalRequest._wanlvRetry ||
    userStore.userType !== 'normal' ||
    !userStore.refreshToken
  ) {
    handleUnauthorized(error?.response?.data?.msg)
    return Promise.reject(error)
  }

  originalRequest._wanlvRetry = true

  const requestAuthorization = originalRequest.headers?.Authorization
  const latestAccessToken = userStore.token

  if (requestAuthorization && latestAccessToken && requestAuthorization !== `Bearer ${latestAccessToken}`) {
    // 当前请求仍携带旧 Token，说明其他请求已经刷新完成，直接使用新 Token 重放。
    return instance(originalRequest)
  }

  try {
    const refreshToken = userStore.refreshToken

    // 重点：并发 401 共用一个刷新 Promise，避免已轮换的 refreshToken 被重复提交。
    refreshing ??= refreshNormalUserTokenApi(refreshToken)
      .then((payload) => {
        if (payload?.code !== 200 || !payload?.data) {
          return Promise.reject(payload)
        }

        userStore.updateTokenPair(payload.data)
        return payload.data
      })
      .finally(() => {
        refreshing = null
      })

    await refreshing
    return instance(originalRequest)
  } catch (refreshError) {
    handleUnauthorized(refreshError?.response?.data?.msg || refreshError?.msg)
    return Promise.reject(refreshError)
  }
}

instance.interceptors.request.use((config) => {
  const userStore = useUserStore(pinia)

  if (userStore.isLoggedIn) {
    handlingUnauthorized = false
  }

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
      return retryAfterRefresh(buildResponseError(response))
    }

    if (payload?.code !== 200) {
      const message = payload?.msg || '请求失败'
      feedbackMessage.error(message)
      return Promise.reject(payload)
    }

    return payload.data
  },
  async (error) => {
    if (error?.response?.status === 401 || error?.response?.data?.code === 401) {
      return retryAfterRefresh(error)
    }

    let message = error?.response?.data?.msg || error?.message || '网络异常'

    if (error?.message?.includes('timeout')) {
      message = '请求超时，请稍后重试'
    }

    feedbackMessage.error(message)
    return Promise.reject(error)
  },
)

export default instance
export { baseURL, targetBaseUrl }
