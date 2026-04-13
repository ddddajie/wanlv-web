import axios from 'axios'
import { ElMessage } from 'element-plus'

const targetBaseUrl = import.meta.env.VITE_API_BASE_URL
const baseURL = import.meta.env.DEV ? '/api' : targetBaseUrl

const instance = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

instance.interceptors.response.use(
  (response) => {
    const payload = response.data

    if (payload?.code !== 200) {
      const message = payload?.msg || '请求失败'
      ElMessage.error(message)
      return Promise.reject(payload)
    }

    return payload.data
  },
  (error) => {
    let message = error?.response?.data?.msg || error?.message || '网络异常'

    if (error?.message?.includes('timeout')) {
      message = '请求超时，请稍后重试'
    }

    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export default instance
export { baseURL, targetBaseUrl }
