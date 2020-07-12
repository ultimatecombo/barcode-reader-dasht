const sql = require("mssql/msnodesqlv8");
const { app, ipcMain, BrowserWindow } = require("electron");
const { UsbScanner, getDevices } = require("usb-barcode-scanner");

let mainWindow = null,
  scanner = null,
  dbConnection = null;

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (scanner) {
    scannerStop();
    scanner = null;
  }

  if (dbConnection) {
    dbConnection.close();
  }

  app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// get connected usb devices list
ipcMain.on("usb-get-list", (event) => {
  try {
    let list = getDevices();
    event.sender.send("usb-list", list);
  } catch (error) {
    handleError(error);
  }
});

ipcMain.on("scanner-start", () => scannerStart());
ipcMain.on("scanner-stop", () => scannerStop());
ipcMain.on("scanner-create", (event, args) => {
  let result = createUsbScanner(args.vendorId, args.productId);
  event.sender.send("scanner-create-result", result);
});

ipcMain.on("db-get-list", (event, server) => {
  try {
    let pool = new sql.ConnectionPool({
      server: server,
      driver: "msnodesqlv8",
      options: {
        trustedConnection: true,
      },
    });

    pool
      .connect()
      .then(() => {
        pool
          .request()
          .query("SELECT name FROM MASTER.sys.databases", (error, result) => {
            if (error) handleError(error);
            else event.sender.send("db-list", result);
          });
      })
      .catch((error) => {
        handleError(error);
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
        (error, result) => {
          if (error) handleError(error);
          else event.sender.send("db-query-result", result);
        }
      );
    });
  } catch (error) {
    handleError(error);
  }
});

ipcMain.on("db-connection-test", (event) => {
  try {
    dbConnection
      .connect()
      .then(() => {
        event.sender.send("db-test-result", true);
      })
      .catch((error) => {
        event.sender.send("db-test-result", false);
        handleError(error);
      });
  } catch (error) {
    event.sender.send("db-test-result", false);
    handleError(error);
  }
});

ipcMain.on("db-create-connection", (event, args) => {
  try {
    let config = {
      server: args.server,
      database: args.database,
      driver: "msnodesqlv8",
      options: {
        trustedConnection: true,
      },
    };
    dbConnection = createConnectionPool(config);
    dbConnection.on("error", (error) => handleError(error));
  } catch (error) {
    handleError(error);
  }
});

ipcMain.on("settings-updated", () => {
  mainWindow.webContents.send("apply-settings");
});

// get error reports from renderes
ipcMain.on("error-report", (event, error) => handleError(error));

function createWindow() {
  mainWindow = new BrowserWindow({
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
  mainWindow.webContents.openDevTools();
}

function createUsbScanner(vendorId, productId) {
  try {
    scanner = new UsbScanner({
      vendorId: vendorId,
      productId: productId,
    });

    scanner.on("data", (data) => {
      mainWindow.webContents.send("scanner-data", data);
    });

    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

function scannerStart() {
  try {
    scanner.startScanning();
  } catch (error) {
    handleError(error);
  }
}

function scannerStop() {
  try {
    scanner.stopScanning();
  } catch (error) {
    handleError(error);
  }
}

function createConnectionPool(config) {
  try {
    return new sql.ConnectionPool(config);
  } catch (error) {
    handleError(error);
  }
}

function handleError(error) {
  // send error messages to main window to
  // show them to user.
  mainWindow.webContents.send("error-show", error);
}
