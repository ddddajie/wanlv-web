import { createDiscreteApi, lightTheme } from 'naive-ui'

const themeOverrides = {
  common: {
    primaryColor: '#0f8f7f',
    primaryColorHover: '#139f8f',
    primaryColorPressed: '#0a6f63',
    primaryColorSuppl: '#14b8a6',
    infoColor: '#2f80c0',
    successColor: '#2f9f6b',
    warningColor: '#c98917',
    errorColor: '#d64d4d',
    borderRadius: '8px',
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
}

const discrete = createDiscreteApi(['message', 'dialog', 'notification', 'loadingBar'], {
  configProviderProps: {
    theme: lightTheme,
    themeOverrides,
  },
})

const message = discrete.message
const notification = discrete.notification
const loadingBar = discrete.loadingBar

const dialog = {
  confirm(content, title = '请确认', options = {}) {
    return new Promise((resolve, reject) => {
      discrete.dialog.warning({
        title,
        content,
        positiveText: options.confirmButtonText || options.positiveText || '确认',
        negativeText: options.cancelButtonText || options.negativeText || '取消',
        closable: false,
        maskClosable: false,
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => reject(new Error('cancelled')),
        onClose: () => reject(new Error('cancelled')),
      })
    })
  },
  prompt(content, title = '请输入', options = {}) {
    const value = window.prompt(content || title, options.inputValue || '')
    return value === null ? Promise.reject(new Error('cancelled')) : Promise.resolve({ value })
  },
}

export { dialog, loadingBar, message, notification, themeOverrides }
