try {
  const { app } = require('electron/main')
  console.log('electron/main app:', typeof app)
  app.whenReady().then(() => {
    console.log('OK!')
    app.quit()
  })
} catch(e) {
  console.log('electron/main 실패:', e.message)
  // fallback
  const m = require('electron')
  console.log('electron type:', typeof m, 'keys:', typeof m === 'object' ? Object.keys(m).slice(0,5) : m)
  process.exit(1)
}
