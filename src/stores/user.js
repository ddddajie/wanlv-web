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
    setLogin(userInfo) {
      this.userInfo = userInfo || null
      this.isLogin = Boolean(userInfo)
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
