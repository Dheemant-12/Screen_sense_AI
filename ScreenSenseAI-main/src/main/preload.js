// Preload — exposes safe IPC API to all renderer windows
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ss', {
  // Orb
  orbClick: () => ipcRenderer.send('orb:click'),
  orbDrag: (payloadOrDx, dy) => {
    const payload = typeof payloadOrDx === 'object'
      ? payloadOrDx
      : { dx: payloadOrDx, dy };
    ipcRenderer.send('orb:drag', payload);
  },
  orbDragEnd: () => ipcRenderer.send('orb:drag-end'),

  // Mode control
  startMode: (mode, taskId = 'default') => ipcRenderer.send('mode:start', { mode, taskId }),
  stopMode: (taskId = 'default') => ipcRenderer.send('mode:stop', { taskId }),

  // Screen capture
  getSources: () => ipcRenderer.invoke('capture:getSources'),
  captureFrame: (sourceId, region) => ipcRenderer.invoke('capture:frame', { sourceId, region }),
  pickRegion: (sourceId) => ipcRenderer.invoke('region:pick', sourceId),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  openSettings: () => ipcRenderer.send('settings:open'),
  ensureLocalWhisper: () => ipcRenderer.invoke('local-whisper:ensure'),
  openWelcome: () => ipcRenderer.send('welcome:open'),
  startFromWelcome: () => ipcRenderer.send('welcome:start'),

  // Transcript / Scene data
  appendTranscript: (entry) => ipcRenderer.send('transcript:append', entry),
  appendScene: (entry) => ipcRenderer.send('scene:append', entry),
  appendFace: (entry) => ipcRenderer.send('face:append', entry),

  // Session
  getSessionData: () => ipcRenderer.invoke('session:getData'),

  // Conversation history
  saveConversationHistory: (record) => ipcRenderer.invoke('history:save', record),
  saveHistoryAudioAsset: (payload) => ipcRenderer.invoke('history:saveAudioAsset', payload),
  listConversationHistory: () => ipcRenderer.invoke('history:list'),
  getConversationHistory: (id) => ipcRenderer.invoke('history:get', id),
  deleteConversationHistory: (id) => ipcRenderer.invoke('history:delete', id),
  clearConversationHistory: () => ipcRenderer.invoke('history:clear'),

  // Activity Insights
  getActivityConsent: () => ipcRenderer.invoke('activity:getConsent'),
  setActivityConsent: (value) => ipcRenderer.invoke('activity:setConsent', value),
  getActivityReport: (dateKey) => ipcRenderer.invoke('activity:getReport', dateKey),
  openActivityInsights: () => ipcRenderer.send('activity:open'),
  setOverlayClickThrough: (value) => ipcRenderer.send('overlay:setClickThrough', Boolean(value)),
  detachTaskWindow: (task) => ipcRenderer.send('task:detach-window', task),
  panelTabDragStart: () => ipcRenderer.send('panel:tab-drag-start'),
  panelTabDragEnd: () => ipcRenderer.send('panel:tab-drag-end'),

  // Export
  exportFile: (opts) => ipcRenderer.invoke('export:file', opts),
  exportBinary: (opts) => ipcRenderer.invoke('export:binary', opts),

  // Window controls
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),

  // Event listeners
  on: (channel, cb) => {
    const allowed = [
      'session:started', 'session:stopped', 'session:active', 'session:finalizing',
      'mode:active', 'transcript:new', 'scene:new', 'face:new', 'settings:updated',
      'window:maximized-state', 'task:detached-init', 'history:updated', 'activity:open'
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => cb(...args));
    }
  },
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb)
});
