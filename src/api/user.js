import request from '@/utils/request'

export function initSuperAdminApi() {
  return request.get('/user/init')
}

export function adminLoginApi(data) {
  return request.post('/user/admin/login', data)
}

export function createAdminApi(data) {
  return request.post('/user/admin/add', data)
}

export function normalRegisterApi(data) {
  return request.post('/user/normal/register', data)
}

export function normalLoginApi(data) {
  return request.post('/user/normal/login', data)
}
