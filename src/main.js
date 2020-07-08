const os = require("os");
const { app, ipcMain, BrowserWindow } = require("electron");
const { UsbScanner, getDevices } = require("usb-barcode-scanner");
const sql = require("mssql/msnodesqlv8");

let scanner = null;
let dbConnection = null;

function createWindow() {
  let win = new BrowserWindow({
    width: 700,
    height: 900,
    minWidth: 700,
    minHeight: 700,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  win.loadFile("./views/index.html");
}

app.on("window-all-closed", app.quit);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(createWindow);

// fetch connected usb devices list
ipcMain.on("get-usb-list", (event, args) => {
  event.sender.send("usb-list", getDevices());
});

ipcMain.on("get-database-list", (event, args) => {
  let pool = new sql.ConnectionPool({
    server: `${os.hostname()}\\SQLEXPRESS`,
    driver: "msnodesqlv8",
    options: {
      trustedConnection: true,
    },
  });

  pool.connect().then(() => {
    pool.request().query("SELECT name FROM master.sys.databases", (err, result) => {
      if(err) console.log(err);
      else event.sender.send("database-list", result);
    });
  });
  
});

ipcMain.on("start-barcode-scan", (event, args) => {
  startScan(args.vendorId, args.productId);
});

ipcMain.on("stop-barcode-scan", () => {
  stopScan();
});

function startScan(vendorId, productId) {
  try {
    scanner = new UsbScanner({
      vendorId: vendorId,
      productId: productId,
    });

    scanner.on("data", (data) => {
      console.log(data);
    });

    scanner.startScanning();
  } catch (error) {
    console.log(error);
  }
}

function stopScan() {
  scanner.stopScanning();
}
