import request from '@/utils/request'

export function uploadKnowledgeFilesApi(files, scenicAreaId) {
  const formData = new FormData()

  if (scenicAreaId !== undefined && scenicAreaId !== null && scenicAreaId !== '') {
    formData.append('scenicAreaId', String(scenicAreaId))
  }

  files.forEach((file) => {
    formData.append('files', file)
  })

  return request.post('/knowledge/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export function trainKnowledgeApi() {
  return request.post('/knowledge/train')
}
