import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  store: {
    get:    (key: string)                  => ipcRenderer.invoke('store-get', key),
    set:    (key: string, value: unknown)  => ipcRenderer.invoke('store-set', key, value),
    delete: (key: string)                  => ipcRenderer.invoke('store-delete', key),
    clear:  ()                             => ipcRenderer.invoke('store-clear'),
  },
  system: {
    getMacAddress:   () => ipcRenderer.invoke('get-mac-address'),
    getAppVersion:   () => ipcRenderer.invoke('get-app-version'),
    getUpdateInfo:   () => ipcRenderer.invoke('get-update-info'),
    getPresetSeed:   () => ipcRenderer.invoke('get-preset-seed'),
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  },
  updater: {
    checkForUpdates:   ()                   => ipcRenderer.invoke('check-for-updates'),
    installUpdate:     ()                   => ipcRenderer.invoke('install-update'),
    onUpdateAvailable: (cb: () => void)     => ipcRenderer.on('update-available', cb),
    onUpdateDownloaded:(cb: () => void)     => ipcRenderer.on('update-downloaded', cb),
  },
})
