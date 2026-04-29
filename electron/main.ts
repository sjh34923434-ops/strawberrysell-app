import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { networkInterfaces } from 'os'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import Store from 'electron-store'
import { setupUpdater } from './updater'

const isDev = process.env.NODE_ENV === 'development'

// dev 모드는 설치본과 별도의 userData 폴더 사용 (데이터 격리)
// 설치본: %APPDATA%/딸기셀/
// dev:    %APPDATA%/딸기셀-dev/
if (isDev) {
  app.setPath('userData', join(app.getPath('appData'), '딸기셀-dev'))
}

const store = new Store()

// ─── MAC 주소 조회 ─────────────────────────────────────────────────────────────

function getMacAddress(): string {
  const interfaces = networkInterfaces()
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue
    for (const alias of iface) {
      if (
        alias.family === 'IPv4' &&
        alias.mac &&
        alias.mac !== '00:00:00:00:00:00' &&
        !alias.internal
      ) {
        return alias.mac
      }
    }
  }
  return '00:00:00:00:00:00'
}

// ─── 윈도우 생성 ───────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const iconPath = isDev
    ? join(process.cwd(), 'public', 'icon.png')
    : join(__dirname, '../dist/icon.png')

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#0A0F1E',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  })

  // 외부 링크는 기본 브라우저에서 열기
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL('http://localhost:5200')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
    setupUpdater(win)
  }

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // 프리셋 시드: 페이지 로드 완료 후 main 프로세스에서 직접 localStorage에 주입
  win.webContents.on('did-finish-load', () => {
    const seedPath = join(app.getPath('userData'), 'preset-seed.json')
    if (!existsSync(seedPath)) return
    try {
      const seedJson = readFileSync(seedPath, 'utf-8')
      unlinkSync(seedPath)
      const escaped = JSON.stringify(seedJson)
      win.webContents.executeJavaScript(`
        (function() {
          try {
            var cur = localStorage.getItem('strawberrysell-settings');
            var curPresets = cur ? (JSON.parse(cur).state.mappingPresets.length || 0) : 0;
            var seedPresets = JSON.parse(${escaped}).state.mappingPresets.length || 0;
            if (seedPresets > curPresets) {
              localStorage.setItem('strawberrysell-settings', ${escaped});
              return true;
            }
          } catch(e) {}
          return false;
        })();
      `).then((applied: boolean) => {
        if (applied) win.webContents.reload()
      }).catch(() => {})
    } catch { /* ignore */ }
  })

  return win
}

// ─── IPC 핸들러 등록 ──────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // electron-store 브릿지
  ipcMain.handle('store-get', (_event, key: string) => store.get(key))
  ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
    store.set(key, value)
  })
  ipcMain.handle('store-delete', (_event, key: string) => {
    store.delete(key)
  })
  ipcMain.handle('store-clear', () => store.clear())

  // 시스템 정보
  ipcMain.handle('get-mac-address', () => getMacAddress())
  ipcMain.handle('get-app-version', () => app.getVersion())

  // 버전 + 업데이트 날짜 (현재 버전 vs 저장된 버전 비교 → 다르면 오늘 날짜 갱신)
  ipcMain.handle('get-update-info', () => {
    const currentVersion = app.getVersion()
    const stored         = (store.get('versionInfo') as { version?: string; updatedAt?: string } | undefined) ?? {}
    if (stored.version !== currentVersion) {
      const updatedAt = new Date().toISOString()
      store.set('versionInfo', { version: currentVersion, updatedAt })
      return { version: currentVersion, updatedAt }
    }
    return { version: currentVersion, updatedAt: stored.updatedAt ?? new Date().toISOString() }
  })

  // userData 경로 반환 (디버그/복원용)
  ipcMain.handle('get-user-data-path', () => app.getPath('userData'))

  // 프리셋 시드 파일 가져오기 (1회성 마이그레이션)
  ipcMain.handle('get-preset-seed', () => {
    const userDataPath = app.getPath('userData')
    const seedPath = join(userDataPath, 'preset-seed.json')
    console.log('[seed] userData:', userDataPath, '| seedPath:', seedPath, '| exists:', existsSync(seedPath))
    if (!existsSync(seedPath)) return null
    try {
      const data = readFileSync(seedPath, 'utf-8')
      unlinkSync(seedPath) // 읽은 후 삭제 (1회만 실행)
      console.log('[seed] 복원 성공, 파일 삭제됨')
      return data
    } catch (e) {
      console.error('[seed] 읽기 실패:', e)
      return null
    }
  })
}

// ─── 앱 초기화 ────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
