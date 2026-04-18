import { defineStore } from 'pinia'

export const useUserStore = defineStore('wanlv-user', {
  state: () => ({
    userInfo: null,
    isLogin: false,
  }),
  getters: {
    isLoggedIn: (state) => state.isLogin && Boolean(state.userInfo),
    userId: (state) => state.userInfo?.id ?? '',
    username: (state) => state.userInfo?.username ?? '',
    displayName: (state) => state.userInfo?.displayName ?? '',
    role: (state) => state.userInfo?.role ?? '',
    userType: (state) => state.userInfo?.userType ?? '',
    isAdmin: (state) => state.userInfo?.userType === 'admin',
    isSuperAdmin: (state) =>
      state.userInfo?.userType === 'admin' && state.userInfo?.role === 'super_admin',
  },
  actions: {
    normalizeUserInfo(userInfo) {
      if (!userInfo) return null

      return {
        ...userInfo,
        displayName:
          userInfo.displayName ||
          userInfo.realName ||
          userInfo.nickname ||
          userInfo.username ||
          '',
      }
    },
    setLogin(userInfo) {
      this.userInfo = this.normalizeUserInfo(userInfo)
      this.isLogin = Boolean(this.userInfo)
    },
    patchUserInfo(partial) {
      if (!this.userInfo) return

      this.userInfo = this.normalizeUserInfo({
        ...this.userInfo,
        ...partial,
      })
    },
    clearLogin() {
      this.userInfo = null
      this.isLogin = false
    },
  },
  persist: {
    key: 'wanlv-user-auth',
    storage: localStorage,
    paths: ['userInfo', 'isLogin'],
  },
})
