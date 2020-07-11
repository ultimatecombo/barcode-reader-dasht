const os = require("os");
const sql = require("mssql/msnodesqlv8");
const { app, ipcMain, BrowserWindow } = require("electron");
const { UsbScanner, getDevices } = require("usb-barcode-scanner");

let mainWindow = null,
  scanner = null,
  dbConnection = null;

app.whenReady().then(createWindow);
app.on("window-all-closed", app.quit);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// fetch connected usb devices list
ipcMain.on("usb-get-list", (event, args) => {
  try {
    let list = getDevices();
    event.sender.send("usb-list", list);
  } catch (error) {
    handleError(error);
  }
});

ipcMain.on("usb-start-scan", (event, args) => {
  startScan(args.vendorId, args.productId);
});

ipcMain.on("usb-stop-scan", () => {
  stopScan();
});

ipcMain.on("db-get-list", (event, args) => {
  try {
    let pool = new sql.ConnectionPool({
      server: `${os.hostname()}\\SQLEXPRESS`,
      driver: "msnodesqlv8",
      options: {
        trustedConnection: true,
      },
    });

    pool.connect().then(() => {
      pool
        .request()
        .query("SELECT name FROM master.sys.databases", (err, result) => {
          if (err) console.log(err);
          else event.sender.send("db-list", result);
        });
    });
  } catch (error) {
    handleError(error);
  }
});

ipcMain.on("db-query-item", (event, args) => {
  try {
    dbConnection.connect().then(() => {
      dbConnection.request().query(
        `
          SELECT CASE
          WHEN ItemBarCode IS NULL AND ItemIranCode IS NULL THEN ItemCode+' '+ItemTitle
          WHEN ItemBarCode IS NULL AND ItemIranCode IS NOT NULL THEN ItemCode+' - '+ItemIranCode+' - '+ItemTitle
          WHEN ItemBarCode IS NOT NULL AND ItemIranCode IS NULL THEN ItemCode+' - '+ItemBarCode+' - '+ItemTitle
          WHEN ItemBarCode IS NOT NULL AND ItemIranCode IS NOT NULL THEN ItemCode+' - '+ItemBarCode+' - '+ItemIranCode+' - '+ItemTitle
          ELSE '' END ForSearch,'هر '+UnitTitle+'، '+ItemTitle ItemName
          ,ItemCode,ItemBarCode,ItemIranCode,ItemTitle,UnitTitle,DefaultPrice,Price1,
          CASE WHEN Price1-DefaultPrice >0 THEN Price1-DefaultPrice ELSE 0 END Dicount
          FROM POS.vwItemSalePrice
          WHERE ItemSubUnitRef IS NULL AND 
          (ItemBarCode LIKE '${args}' OR itemIranCode LIKE '${args}' OR ItemTitle LIKE '${args}') `,
        (err, result) => {
          if (err) handleError(err);
          else event.sender.send("db-query-result", result);
        }
      );
    });
  } catch (error) {
    handleError(error);
  }
});

ipcMain.on("db-connection-test", (event, args) => {
  try {
    dbConnection
      .connect()
      .then(() => {
        event.sender.send("db-connection-success");
      })
      .catch((err) => {
        event.sender.send("db-connection-failed", err);
      });
  } catch (error) {
    event.sender.send("db-connection-failed", err);
  }
});

ipcMain.on("db-create-connection", (event, dbName) => {
  try {
    let config = {
      database: dbName,
      server: `${os.hostname()}\\SQLEXPRESS`,
      driver: "msnodesqlv8",
      options: {
        trustedConnection: true,
      },
    };
    dbConnection = createConnectionPool(config);
  } catch (error) {
    handleError(error);
  }
});

// get error reports from renderes
ipcMain.on("error-report", (event, error) => handleError(error));

function createWindow() {
  let mainWindow = new BrowserWindow({
    width: 700,
    height: 900,
    minWidth: 700,
    minHeight: 700,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadFile("./views/index.html");
}

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
    handleError(error);
  }
}

function stopScan() {
  scanner.stopScanning();
}

function createConnectionPool(config) {
  try {
    let pool = new sql.ConnectionPool(config);
    pool.on("error", (error) => handleError(error));
    return pool;
  } catch (error) {
    handleError(error);
  }
}

function handleError(error) {
  // send error messages to main window to
  // show them to user.
  mainWindow.webContents.send("error-show", error);
}
