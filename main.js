import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createWindow() {
  console.log('Creating window...')
  
  // 确定preload.js的路径
  let preloadPath
  if (app.isPackaged) {
    const possiblePreloadPaths = [
      path.join(__dirname, 'electron', 'preload.js'),
      path.join(process.resourcesPath, 'electron', 'preload.js'),
      path.join(process.resourcesPath, 'app', 'electron', 'preload.js')
    ]
    preloadPath = possiblePreloadPaths[0]
    console.log('Preload paths to try:', possiblePreloadPaths)
  } else {
    preloadPath = path.join(__dirname, 'electron', 'preload.js')
  }
  console.log('Using preload path:', preloadPath)
  
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      preload: preloadPath
    }
  })

  console.log('Loading URL...')
  console.log('app.isPackaged:', app.isPackaged)
  console.log('__dirname:', __dirname)
  console.log('process.resourcesPath:', process.resourcesPath)
  
  if (app.isPackaged) {
    // 打包后的路径 - 支持asar和非asar两种方式
    let indexPath
    // 尝试几种可能的路径
    const possiblePaths = [
      path.join(__dirname, 'dist', 'index.html'),
      path.join(process.resourcesPath, 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html')
    ]
    
    for (const p of possiblePaths) {
      console.log('Trying path:', p)
      try {
        win.loadFile(p)
        indexPath = p
        break
      } catch (e) {
        console.log('Path failed:', e.message)
      }
    }
    
    if (!indexPath) {
      console.error('Could not find index.html')
    }
  } else {
    win.loadURL('http://localhost:5174')
    win.webContents.openDevTools()
  }

  // IPC 通信处理
  ipcMain.on('minimize', () => {
    win.minimize()
  })

  ipcMain.on('maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.on('close', () => {
    win.close()
  })

  // 移除 start-drag 事件处理，因为 win.startDragging 方法不存在
  // 使用 CSS 的 -webkit-app-region: drag 来实现窗口拖动
}

app.whenReady().then(() => {
  console.log('App ready...')
  createWindow()

  app.on('activate', () => {
    console.log('App activated...')
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  console.log('All windows closed...')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
