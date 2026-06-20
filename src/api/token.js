import refreshRequest from '@/utils/refresh-request'

export function refreshNormalUserTokenApi(refreshToken) {
  return refreshRequest.post('/user/normal/token/refresh', { refreshToken })
}
