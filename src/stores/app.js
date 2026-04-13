import { defineStore } from 'pinia'

const HOME_VIEW = {
  title: '游客报表中心',
  path: '/visitor-report',
  fullPath: '/visitor-report',
}

export const useAppStore = defineStore('wanlv-app', {
  state: () => ({
    sidebarCollapsed: false,
    visitedViews: [HOME_VIEW],
  }),
  actions: {
    setSidebarCollapsed(value) {
      this.sidebarCollapsed = value
    },
    addVisitedView(route) {
      if (!route?.meta?.title || route.meta.hiddenInTags) {
        return
      }

      const view = {
        title: route.meta.title,
        path: route.path,
        fullPath: route.fullPath,
      }

      const exists = this.visitedViews.some((item) => item.fullPath === view.fullPath)
      if (!exists) {
        this.visitedViews.push(view)
      }
    },
    removeVisitedView(fullPath) {
      if (fullPath === HOME_VIEW.fullPath) {
        return
      }
      this.visitedViews = this.visitedViews.filter((item) => item.fullPath !== fullPath)
    },
    resetVisitedViews() {
      this.visitedViews = [HOME_VIEW]
    },
  },
})
