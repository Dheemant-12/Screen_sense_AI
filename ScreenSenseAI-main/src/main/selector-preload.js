const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selectorApi', {
  submitRegion: (region) => ipcRenderer.send('selector:submit', region),
  cancel: () => ipcRenderer.send('selector:cancel'),
  onInit: (cb) => ipcRenderer.on('selector:init', (_, payload) => cb(payload))
});
