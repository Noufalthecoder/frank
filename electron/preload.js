import { ipcRenderer, contextBridge } from 'electron'

// Expose ipcRenderer
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// Expose high-level api methods
contextBridge.exposeInMainWorld('api', {
  // Shop Profile
  getShopProfile: () => ipcRenderer.invoke('getShopProfile'),
  updateShopProfile: (p) => ipcRenderer.invoke('updateShopProfile', p),

  // Items
  getItems: () => ipcRenderer.invoke('getItems'),
  searchItems: (q) => ipcRenderer.invoke('searchItems', q),
  getOutOfStockItems: () => ipcRenderer.invoke('getOutOfStockItems'),
  addItem: (item) => ipcRenderer.invoke('addItem', item),
  updateItem: (item) => ipcRenderer.invoke('updateItem', item),
  deleteItem: (id) => ipcRenderer.invoke('deleteItem', id),
  bulkImportItems: (items) => ipcRenderer.invoke('bulkImportItems', items),

  // Racks & Bins
  getRacks: () => ipcRenderer.invoke('getRacks'),
  addRack: (rack) => ipcRenderer.invoke('addRack', rack),
  deleteRack: (code) => ipcRenderer.invoke('deleteRack', code),
  updateRack: (rack) => ipcRenderer.invoke('updateRack', rack),
  moveItemToBin: (itemId, binCode) => ipcRenderer.invoke('moveItemToBin', itemId, binCode),

  // Invoices & POS
  getInvoices: () => ipcRenderer.invoke('getInvoices'),
  getInvoicesPage: (opts) => ipcRenderer.invoke('getInvoicesPage', opts),
  createInvoice: (inv) => ipcRenderer.invoke('createInvoice', inv),
  returnInvoice: (id) => ipcRenderer.invoke('returnInvoice', id),

  // Vendors & Purchase Orders
  getPurchaseOrders: () => ipcRenderer.invoke('getPurchaseOrders'),
  getPurchaseOrdersPage: (opts) => ipcRenderer.invoke('getPurchaseOrdersPage', opts),
  createPurchaseOrder: (po) => ipcRenderer.invoke('createPurchaseOrder', po),
  updatePurchaseOrder: (po) => ipcRenderer.invoke('updatePurchaseOrder', po),
  updatePurchaseOrderStatus: (id, status, received) => ipcRenderer.invoke('updatePurchaseOrderStatus', { id, status, received }),
  deletePurchaseOrder: (id) => ipcRenderer.invoke('deletePurchaseOrder', id),
  getVendors: () => ipcRenderer.invoke('getVendors'),
  addVendor: (v) => ipcRenderer.invoke('addVendor', v),
  deleteVendor: (id) => ipcRenderer.invoke('deleteVendor', id),

  // Finance & Expenses
  getExpenses: () => ipcRenderer.invoke('getExpenses'),
  getExpensesPage: (opts) => ipcRenderer.invoke('getExpensesPage', opts),
  addExpense: (exp) => ipcRenderer.invoke('addExpense', exp),
  deleteExpense: (id) => ipcRenderer.invoke('deleteExpense', id),
  getDayClosings: () => ipcRenderer.invoke('getDayClosings'),
  recordDayClosing: (dc) => ipcRenderer.invoke('recordDayClosing', dc),

  // Database Management
  getDatabasePath: () => ipcRenderer.invoke('getDatabasePath'),
  backupDatabase: () => ipcRenderer.invoke('backupDatabase'),
  restoreDatabase: () => ipcRenderer.invoke('restoreDatabase'),
  seedDemoData: () => ipcRenderer.invoke('seedDemoData'),
  resetDatabase: () => ipcRenderer.invoke('resetDatabase'),

  // Printing & PDF Export
  getPrinters: () => ipcRenderer.invoke('getPrinters'),
  printInvoice: (opts) => ipcRenderer.invoke('printInvoice', opts),
  exportInvoicePdf: (opts) => ipcRenderer.invoke('exportInvoicePdf', opts),
})
