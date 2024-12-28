const { app, BrowserWindow, BrowserView, ipcMain, webContents } = require('electron');
const path = require('path');

let mainWindow;
let views = new Map();
let activeViewId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // 创建第一个标签页
  createNewTab();
}

function createNewTab() {
  // 如果已经有10个标签，则不再创建
  if (views.size >= 10) {
    // 通知渲染进程显示提示
    mainWindow.webContents.send('tab-limit', '最多只能创建10个标签页');
    return null;
  }

  const viewId = Date.now().toString();
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: `persist:${viewId}`, // 实现存储隔离
      preload: path.join(__dirname, 'preload.js') // 添加 preload 脚本
    }
  });

  mainWindow.addBrowserView(view);
  views.set(viewId, view);
  
  // ��置视图的边界
  const [width, height] = mainWindow.getContentSize();
  view.setBounds({ x: 0, y: 40, width, height: height - 40 });
  
  // 发送新标签页信息给渲染进程
  mainWindow.webContents.send('tab-created', viewId);
  
  // 监听页面标题变化
  view.webContents.on('page-title-updated', (event, title) => {
    mainWindow.webContents.send('tab-title-updated', viewId, title);
  });

  // 监听页面加载状态
  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('tab-loading', viewId, true);
  });

  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('tab-loading', viewId, false);
  });

  // 添加导航完成事件监听，确保页面完全加载后移除加载状态
  view.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('tab-loading', viewId, false);
  });

  // 添加加载失败事件监听
  view.webContents.on('did-fail-load', () => {
    mainWindow.webContents.send('tab-loading', viewId, false);
  });

  view.webContents.loadURL('https://www.baidu.com');
  setActiveTab(viewId);
  return viewId;
}

function setActiveTab(viewId) {
  views.forEach((view, id) => {
    if (id === viewId) {
      view.setBounds({ x: 0, y: 40, width: mainWindow.getBounds().width, height: mainWindow.getBounds().height - 40 });
    } else {
      view.setBounds({ x: 0, y: 40, width: 0, height: 0 });
    }
  });
  activeViewId = viewId;
}

// 监听标签页相关的事件
ipcMain.on('new-tab', () => {
  createNewTab();
});

ipcMain.on('switch-tab', (event, viewId) => {
  setActiveTab(viewId);
});

ipcMain.on('close-tab', (event, viewId) => {
  const view = views.get(viewId);
  // 修改判断条件，添加标签数量检查
  if (view && views.size > 1) {
    mainWindow.removeBrowserView(view);
    views.delete(viewId);
    
    if (activeViewId === viewId) {
      const lastViewId = Array.from(views.keys())[views.size - 1];
      setActiveTab(lastViewId);
    }
    
    mainWindow.webContents.send('tab-closed', viewId);
  } else {
    // 通知渲染进程显示提示
    mainWindow.webContents.send('tab-limit', '至少需要保留1个标签页');
  }
});

// 添加以下函数来广播消息给所有标签
function broadcastToAllTabs(channel, ...args) {
  views.forEach((view) => {
    view.webContents.send(channel, ...args);
  });
}

// 示例：主进程向所有标签发送消息
ipcMain.on('message-from-tab', (event, message) => {
  // 获取发送消息的标签ID
  const sender = event.sender;
  const senderView = Array.from(views.entries()).find(([_, view]) => 
    view.webContents.id === sender.id
  );
  
  if (senderView) {
    const [viewId] = senderView;
    // 只回复发送消息的标签
    sender.send('message-response', `回复标签 ${viewId}: 收到消息 "${message}"`);
    
    // 向所有标签广播通知
    broadcastToAllTabs('broadcast-message', `标签 ${viewId} 发送了消息: "${message}"`);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 