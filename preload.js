const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 发送消息到主进程
  sendMessage: (message) => ipcRenderer.send('message-from-tab', message),
  
  // 监听来自主进程的直接回复
  onMessageResponse: (callback) => 
    ipcRenderer.on('message-response', (event, response) => callback(response)),
    
  // 监听来自主进程的广播消息
  onBroadcastMessage: (callback) =>
    ipcRenderer.on('broadcast-message', (event, message) => callback(message)),
    
  // 移除事件监听器
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('message-response');
    ipcRenderer.removeAllListeners('broadcast-message');
  },

  // 添加标签页相关 API
  createNewTab: () => ipcRenderer.send('new-tab'),
  switchTab: (viewId) => ipcRenderer.send('switch-tab', viewId),
  closeTab: (viewId) => ipcRenderer.send('close-tab', viewId),
  onTabCreated: (callback) => ipcRenderer.on('tab-created', callback),
  onTabClosed: (callback) => ipcRenderer.on('tab-closed', callback),

  // 添加标签限制提示的监听器
  onTabLimit: (callback) => ipcRenderer.on('tab-limit', (event, message) => callback(message)),

  // 添加加载状态监听
  onTabLoading: (callback) => 
    ipcRenderer.on('tab-loading', (event, viewId, isLoading) => callback(viewId, isLoading)),

  // 添加标题更新监听
  onTabTitleUpdated: (callback) => 
    ipcRenderer.on('tab-title-updated', (event, viewId, title) => callback(viewId, title))
}); 