import axios from 'axios'
import { httpConfig } from '@/utils/http-config'

// 刷新请求使用独立 Axios 实例，避免刷新接口的 401 再次触发业务请求拦截器。
const refreshRequest = axios.create(httpConfig)

refreshRequest.interceptors.response.use((response) => response.data)

export default refreshRequest
