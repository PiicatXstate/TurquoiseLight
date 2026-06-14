import { app, BrowserWindow } from 'electron'
import path from 'node:path'

const DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178]

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../index.html'))
  } else {
    // 尝试多个端口，找到 Vite 开发服务器
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || await findDevServer()
    console.log('Loading URL:', devServerUrl)
    
    if (devServerUrl) {
      win.loadURL(devServerUrl)
      win.webContents.openDevTools()
    } else {
      console.error('Could not find Vite dev server. Please run `npm run dev` first.')
      win.loadFile(path.join(__dirname, '../index.html'))
    }
  }
}

async function findDevServer(): Promise<string | null> {
  const http = await import('node:http')
  
  for (const port of DEV_PORTS) {
    try {
      const url = `http://localhost:${port}`
      await new Promise<void>((resolve, reject) => {
        const req = http.get(url, { timeout: 1000 }, (res) => {
          if (res.statusCode === 200 || res.statusCode === 304) {
            resolve()
          } else {
            reject(new Error(`Status code: ${res.statusCode}`))
          }
          res.destroy()
        })
        req.on('error', reject)
        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Timeout'))
        })
      })
      return url
    } catch {
      // 继续尝试下一个端口
      continue
    }
  }
  
  return null
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
