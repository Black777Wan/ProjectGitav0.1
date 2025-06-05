const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  getPages: () => ipcRenderer.invoke('db:getPages'),
  getPage: (pageId) => ipcRenderer.invoke('db:getPage', pageId),
  getPageByTitle: (title) => ipcRenderer.invoke('db:getPageByTitle', title),
  createPage: (pageData) => ipcRenderer.invoke('db:createPage', pageData),
  updatePage: (pageId, pageData) => ipcRenderer.invoke('db:updatePage', pageId, pageData),
  
  getBlocks: (pageId) => ipcRenderer.invoke('db:getBlocks', pageId),
  createBlock: (blockData) => ipcRenderer.invoke('db:createBlock', blockData),
  updateBlock: (blockId, blockData) => ipcRenderer.invoke('db:updateBlock', blockId, blockData),
  deleteBlock: (blockId) => ipcRenderer.invoke('db:deleteBlock', blockId),
  
  getDailyNote: (date) => ipcRenderer.invoke('db:getDailyNote', date)
});
