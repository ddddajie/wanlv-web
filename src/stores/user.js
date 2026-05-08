import { defineStore } from 'pinia'

export const useUserStore = defineStore('wanlv-user', {
  state: () => ({
    userInfo: null,
    isLogin: false,
  }),
  getters: {
    token: (state) => state.userInfo?.token || '',
    isLoggedIn: (state) => state.isLogin && Boolean(state.userInfo?.token),
    userId: (state) => state.userInfo?.id ?? '',
    username: (state) => state.userInfo?.username ?? '',
    displayName: (state) => state.userInfo?.displayName ?? '',
    role: (state) => state.userInfo?.role ?? '',
    userType: (state) => state.userInfo?.userType ?? '',
    isAdmin: (state) => state.userInfo?.userType === 'admin',
    realNameStatus: (state) => Number(state.userInfo?.realNameStatus ?? 0),
    isRealNameVerified: (state) => Number(state.userInfo?.realNameStatus ?? 0) === 1,
    isSuperAdmin: (state) =>
      state.userInfo?.userType === 'admin' && state.userInfo?.role === 'super_admin',
  },
  actions: {
    normalizeUserInfo(userInfo) {
      if (!userInfo) return null

      return {
        ...userInfo,
        // JWT 是后端校验登录态的凭证，必须跟随用户信息一起持久化。
        token: userInfo.token || '',
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
