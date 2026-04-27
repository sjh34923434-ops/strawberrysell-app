import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import { ipcMain, shell } from 'electron'

const RELEASES_URL = 'https://github.com/sjh34923434-ops/strawberrysell-app/releases/latest'

export function setupUpdater(win: BrowserWindow): void {
  // 다운로드는 자동, 설치는 사용자 클릭으로 (코드사이닝 미적용 환경에서 안정적)
  autoUpdater.autoDownload          = true
  autoUpdater.autoInstallOnAppQuit  = false
  autoUpdater.allowDowngrade        = false

  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('updater:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    win.webContents.send('updater:status', {
      status: 'downloading',
      version: info.version,
      progress: 0,
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    win.webContents.send('updater:status', { status: 'idle', version: info.version })
  })

  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    win.webContents.send('updater:status', {
      status: 'downloading',
      progress: Math.round(p.percent),
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    win.webContents.send('updater:status', {
      status: 'ready',
      version: info.version,
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[업데이터] 오류:', err.message)
    win.webContents.send('updater:status', {
      status: 'error',
      error: err.message,
    })
  })

  // ─── IPC 핸들러 ─────────────────────────────────────────────────────────────

  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { ok: true, version: result?.updateInfo.version }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : '알 수 없는 오류' }
    }
  })

  // 사용자 클릭으로 설치 — quitAndInstall(isSilent=false, isForceRunAfter=true)
  // 코드사이닝 없는 환경에서도 정상 동작 (Windows UAC 통과)
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // 자동 다운로드 실패 시 수동 다운로드 페이지 열기
  ipcMain.handle('open-download-page', () => {
    shell.openExternal(RELEASES_URL)
  })

  // 앱 시작 5초 후 자동 확인
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[업데이터] 확인 실패:', err.message)
    })
  }, 5_000)

  // 6시간마다 재확인 (장시간 켜놓는 사용자 대응)
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 6 * 60 * 60 * 1000)
}
