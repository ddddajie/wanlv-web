export function formatDateTime(value) {
  if (!value) return '暂无'

  return String(value).replace('T', ' ')
}

export function formatStatus(status) {
  return Number(status) === 1 ? '启用' : '禁用'
}

export function formatGender(gender) {
  if (Number(gender) === 1) return '男'
  if (Number(gender) === 2) return '女'
  return '未知'
}

export function parseInterestTags(value) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return String(value)
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

export function stringifyInterestTags(input) {
  const tags = parseInterestTags(input)
  return tags.length ? JSON.stringify(tags) : undefined
}

export function buildDisplayName(userInfo) {
  return userInfo?.displayName || userInfo?.realName || userInfo?.nickname || userInfo?.username || ''
}

export function normalizePageResult(pageResult) {
  return {
    total: Number(pageResult?.total || 0),
    records: Array.isArray(pageResult?.records) ? pageResult.records : [],
  }
}
