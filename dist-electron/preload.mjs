"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});
electron.contextBridge.exposeInMainWorld("api", {
  // Shop Profile
  getShopProfile: () => electron.ipcRenderer.invoke("getShopProfile"),
  updateShopProfile: (p) => electron.ipcRenderer.invoke("updateShopProfile", p),
  // Items
  getItems: () => electron.ipcRenderer.invoke("getItems"),
  searchItems: (q) => electron.ipcRenderer.invoke("searchItems", q),
  getOutOfStockItems: () => electron.ipcRenderer.invoke("getOutOfStockItems"),
  addItem: (item) => electron.ipcRenderer.invoke("addItem", item),
  updateItem: (item) => electron.ipcRenderer.invoke("updateItem", item),
  deleteItem: (id) => electron.ipcRenderer.invoke("deleteItem", id),
  bulkImportItems: (items) => electron.ipcRenderer.invoke("bulkImportItems", items),
  // Racks & Bins
  getRacks: () => electron.ipcRenderer.invoke("getRacks"),
  addRack: (rack) => electron.ipcRenderer.invoke("addRack", rack),
  deleteRack: (code) => electron.ipcRenderer.invoke("deleteRack", code),
  // Invoices & POS
  getInvoices: () => electron.ipcRenderer.invoke("getInvoices"),
  createInvoice: (inv) => electron.ipcRenderer.invoke("createInvoice", inv),
  returnInvoice: (id) => electron.ipcRenderer.invoke("returnInvoice", id),
  // Vendors & Purchase Orders
  getPurchaseOrders: () => electron.ipcRenderer.invoke("getPurchaseOrders"),
  createPurchaseOrder: (po) => electron.ipcRenderer.invoke("createPurchaseOrder", po),
  updatePurchaseOrderStatus: (id, status) => electron.ipcRenderer.invoke("updatePurchaseOrderStatus", { id, status }),
  deletePurchaseOrder: (id) => electron.ipcRenderer.invoke("deletePurchaseOrder", id),
  getVendors: () => electron.ipcRenderer.invoke("getVendors"),
  addVendor: (v) => electron.ipcRenderer.invoke("addVendor", v),
  deleteVendor: (id) => electron.ipcRenderer.invoke("deleteVendor", id),
  // Finance & Expenses
  getExpenses: () => electron.ipcRenderer.invoke("getExpenses"),
  addExpense: (exp) => electron.ipcRenderer.invoke("addExpense", exp),
  deleteExpense: (id) => electron.ipcRenderer.invoke("deleteExpense", id),
  getDayClosings: () => electron.ipcRenderer.invoke("getDayClosings"),
  recordDayClosing: (dc) => electron.ipcRenderer.invoke("recordDayClosing", dc),
  // Database Management
  getDatabasePath: () => electron.ipcRenderer.invoke("getDatabasePath"),
  backupDatabase: () => electron.ipcRenderer.invoke("backupDatabase"),
  restoreDatabase: () => electron.ipcRenderer.invoke("restoreDatabase"),
  seedDemoData: () => electron.ipcRenderer.invoke("seedDemoData"),
  resetDatabase: () => electron.ipcRenderer.invoke("resetDatabase"),
  // Printing & PDF Export
  getPrinters: () => electron.ipcRenderer.invoke("getPrinters"),
  printInvoice: (opts) => electron.ipcRenderer.invoke("printInvoice", opts),
  exportInvoicePdf: (opts) => electron.ipcRenderer.invoke("exportInvoicePdf", opts)
});
