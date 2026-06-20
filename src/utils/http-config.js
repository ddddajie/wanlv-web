export const targetBaseUrl = import.meta.env.VITE_API_BASE_URL
export const baseURL = import.meta.env.DEV ? '/api' : targetBaseUrl

export const httpConfig = {
  baseURL,
  timeout: 600000,
  headers: {
    'Content-Type': 'application/json',
  },
}
