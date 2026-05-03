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

export function updateAdminUserApi(data) {
  return request.put('/user/admin/update', data)
}

export function updateNormalUserApi(data) {
  return request.put('/user/normal/update', data)
}

export function getAdminUserApi(id) {
  return request.get(`/user/admin/${id}`)
}

export function deleteAdminUserApi(id) {
  return request.delete(`/user/admin/${id}`)
}

export function getNormalUserApi(id) {
  return request.get(`/user/normal/${id}`)
}

export function deleteNormalUserApi(id) {
  return request.delete(`/user/normal/${id}`)
}

export function pageAdminUsersApi(params) {
  return request.get('/user/admin/page', { params })
}

export function pageNormalUsersApi(params) {
  return request.get('/user/normal/page', { params })
}
