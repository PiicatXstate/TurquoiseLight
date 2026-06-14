import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import fs from 'fs/promises'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178]

async function createWindow() {
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
    // 开发模式 - 尝试多个端口找到 Vite 开发服务器
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || await findDevServer()
    console.log('Using dev server URL:', devServerUrl)
    
    if (devServerUrl) {
      win.loadURL(devServerUrl)
      win.webContents.openDevTools()
    } else {
      console.error('Could not find Vite dev server. Please run `npm run dev` first.')
      // 尝试加载打包后的文件作为备用
      const fallbackPath = path.join(__dirname, 'dist', 'index.html')
      try {
        win.loadFile(fallbackPath)
      } catch (e) {
        console.error('Could not load fallback file:', e.message)
      }
    }
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

  // PDF 导出
  ipcMain.handle('print-to-pdf', async (event, options = {}) => {
    try {
      const defaultPath = path.join(app.getPath('documents'), options.filename || 'document.pdf')
      
      const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title: '导出为 PDF',
        defaultPath,
        filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
      })
      
      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }
      
      // 创建一个隐藏的浏览器窗口来渲染打印内容
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })
      
      // 加载打印内容
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>打印</title>
          <style>
            @page {
              size: A4;
              margin: ${options.margin || '1in'};
            }
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: ${options.fontSize || '12pt'};
              line-height: 1.8;
              color: #1f2937;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-content {
              white-space: pre-wrap;
              word-break: break-word;
            }
            strong {
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          ${options.header || ''}
          <div class="print-content">${options.content || ''}</div>
          ${options.footer || ''}
        </body>
        </html>
      `
      
      await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))
      
      // 打印为 PDF
      const pdfBuffer = await printWin.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: {
          marginType: 'custom',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        }
      })
      
      // 保存文件
      await fs.writeFile(filePath, pdfBuffer)
      
      // 关闭临时窗口
      printWin.close()
      
      return { success: true, filePath }
    } catch (error) {
      console.error('PDF 导出失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 打印（先转PDF再打开预览）
  ipcMain.handle('print-with-preview', async (event, options = {}) => {
    try {
      // 创建临时PDF文件
      const tempDir = os.tmpdir()
      const timestamp = Date.now()
      const tempPdfPath = path.join(tempDir, `print-${timestamp}.pdf`)
      
      // 创建一个隐藏的浏览器窗口来渲染打印内容
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })
      
      // 加载打印内容
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>打印</title>
          <style>
            @page {
              size: A4;
              margin: ${options.margin || '1in'};
            }
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: ${options.fontSize || '12pt'};
              line-height: 1.8;
              color: #1f2937;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-content {
              white-space: pre-wrap;
              word-break: break-word;
            }
            strong {
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          ${options.header || ''}
          <div class="print-content">${options.content || ''}</div>
          ${options.footer || ''}
        </body>
        </html>
      `
      
      await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))
      
      // 打印为 PDF
      const pdfBuffer = await printWin.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: {
          marginType: 'custom',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        }
      })
      
      // 保存到临时文件
      await fs.writeFile(tempPdfPath, pdfBuffer)
      
      // 关闭临时窗口
      printWin.close()
      
      // 用系统默认PDF阅读器打开
      await shell.openPath(tempPdfPath)
      
      return { success: true, filePath: tempPdfPath }
    } catch (error) {
      console.error('打印失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 移除 start-drag 事件处理，因为 win.startDragging 方法不存在
  // 使用 CSS 的 -webkit-app-region: drag 来实现窗口拖动
}

async function findDevServer() {
  for (const port of DEV_PORTS) {
    try {
      const url = `http://localhost:${port}`
      await new Promise((resolve, reject) => {
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
    } catch (e) {
      // 继续尝试下一个端口
      continue
    }
  }
  
  return null
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
