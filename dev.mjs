/**
 * 딸기셀 개발 서버 실행 스크립트
 * 1. Electron main/preload TypeScript 컴파일
 * 2. Vite 렌더러 개발 서버 시작 (ready 감지)
 * 3. Electron 앱 실행
 */

import { spawn, execSync } from 'child_process'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)

// ─── 1. Electron 파일 컴파일 ─────────────────────────────────────────────────

console.log('\x1b[36m[딸기셀] Electron 컴파일 중...\x1b[0m')
try {
  execSync('npx tsc -p tsconfig.electron.json --noEmit false', {
    stdio: 'inherit',
    cwd: __dirname,
  })
  console.log('\x1b[32m[딸기셀] 컴파일 완료 ✓\x1b[0m')
} catch {
  console.error('\x1b[31m[딸기셀] 컴파일 실패 — 위 TypeScript 오류를 확인하세요\x1b[0m')
  process.exit(1)
}

// ─── 2. Vite 렌더러 서버 시작 ────────────────────────────────────────────────

console.log('\x1b[36m[딸기셀] Vite 개발 서버 시작 중...\x1b[0m')

const vite = spawn('npx', ['vite'], {
  cwd: __dirname,
  env: { ...process.env, FORCE_COLOR: '1' },
  shell: true,   // Windows .cmd 실행에 필요
})

// Vite stdout 출력 + "ready" 감지
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Vite 시작 타임아웃 (30초)')), 30_000)

  vite.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk)
    if (chunk.toString().includes('ready in') || chunk.toString().includes('Local:')) {
      clearTimeout(timeout)
      resolve()
    }
  })

  vite.stderr?.on('data', (chunk) => process.stderr.write(chunk))

  vite.on('error', (err) => { clearTimeout(timeout); reject(err) })
  vite.on('close', (code) => {
    if (code !== 0) { clearTimeout(timeout); reject(new Error(`Vite 종료 (${code})`)) }
  })
})

console.log('\x1b[32m[딸기셀] Vite 서버 준비 완료 ✓\x1b[0m')

// ─── 3. Electron 실행 ────────────────────────────────────────────────────────

const electronBin = require('electron')
console.log('\x1b[35m[딸기셀] Electron 앱 실행 중...\x1b[0m\n')

// ELECTRON_RUN_AS_NODE 제거 필수 — 설정 시 Electron이 Node.js 모드로 실행됨
const { ELECTRON_RUN_AS_NODE: _removed, ...safeEnv } = process.env

const electron = spawn(String(electronBin), ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...safeEnv,
    NODE_ENV: 'development',
    FORCE_COLOR: '1',
  },
})

// Vite stdout는 이제 inherit 모드로 전환
vite.stdout?.pipe(process.stdout)

electron.on('close', (code) => {
  console.log(`\n\x1b[33m[딸기셀] 앱 종료 (코드: ${code})\x1b[0m`)
  vite.kill()
  process.exit(0)
})

process.on('SIGINT', () => {
  electron.kill()
  vite.kill()
  process.exit(0)
})
