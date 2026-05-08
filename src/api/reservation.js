import request from '@/utils/request'

export function listReservationEnabledSpotsApi(params) {
  return request.get('/reservation/spots/enabled', { params })
}

export function listReservationSlotsApi(params) {
  return request.get('/reservation/slots', { params })
}

export function createReservationOrderApi(data) {
  return request.post('/reservation/orders', data)
}

export function pageMyReservationOrdersApi(params) {
  return request.get('/reservation/orders/my', { params })
}

export function cancelReservationOrderApi(reservationNo, data) {
  return request.post(`/reservation/orders/${reservationNo}/cancel`, data)
}

export function enterReservationOrderApi(reservationNo) {
  return request.post(`/reservation/admin/orders/${reservationNo}/enter`)
}

export function createReservationRuleApi(data) {
  return request.post('/reservation/admin/rules', data)
}

export function updateReservationRuleApi(id, data) {
  return request.put(`/reservation/admin/rules/${id}`, data)
}

export function updateReservationRuleStatusApi(id, data) {
  return request.put(`/reservation/admin/rules/${id}/status`, data)
}

export function pageReservationRulesApi(params) {
  return request.get('/reservation/admin/rules', { params })
}

export function generateReservationSlotsApi(data) {
  return request.post('/reservation/admin/slots/generate', data)
}

export function createReservationSlotApi(data) {
  return request.post('/reservation/admin/slots', data)
}

export function updateReservationSlotApi(id, data) {
  return request.put(`/reservation/admin/slots/${id}`, data)
}

export function pageReservationSlotsApi(params) {
  return request.get('/reservation/admin/slots', { params })
}

export function pageReservationOrdersApi(params) {
  return request.get('/reservation/admin/orders', { params })
}

export function getReservationDashboardApi(params) {
  return request.get('/reservation/admin/dashboard', { params })
}
