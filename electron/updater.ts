import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'

export function setupUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', () => {
    win.webContents.send('update-available')
  })

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update-downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.error('[업데이터] 오류:', err.message)
  })

  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates())
  ipcMain.handle('install-update',    () => autoUpdater.quitAndInstall())

  // 앱 시작 5초 후 자동 확인
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[업데이터] 확인 실패:', err.message)
    })
  }, 5_000)
}
