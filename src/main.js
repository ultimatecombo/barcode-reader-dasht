const sql = require("mssql/msnodesqlv8");
const { app, ipcMain, BrowserWindow } = require("electron");

let mainWindow = null,
  dbConnection = null;

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (dbConnection) {
    dbConnection.close();
  }
  app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
            pool.close();
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
    dbConnection
      .connect()
      .then(() => {
        dbConnection.request().query(
          `
          SELECT CASE
          WHEN ItemBarCode IS NULL AND ItemIranCode IS NULL THEN ItemCode
          WHEN ItemBarCode IS NULL AND ItemIranCode IS NOT NULL THEN ItemCode + ' - ' + ItemIranCode
          WHEN ItemBarCode IS NOT NULL AND ItemIranCode IS NULL THEN ItemCode + ' - ' + ItemBarCode
          WHEN ItemBarCode IS NOT NULL AND ItemIranCode IS NOT NULL THEN ItemCode + ' - ' + ItemBarCode + ' - ' + ItemIranCode
          ELSE '' END ForSearch, 'هر ' + UnitTitle + '، ' + ItemTitle ItemName, ItemBarCode, ISNULL(DefaultPrice, 0) DefaultPrice, ISNULL(item.[Description], '') ItemDesc
          FROM POS.vwItemSalePrice
          LEFT JOIN POS.Item item ON item.ItemID = ItemRef
          WHERE ItemSubUnitRef IS NULL AND 
          (ItemCode LIKE '${args}' OR ItemBarCode LIKE '${args}' OR itemIranCode LIKE '${args}' OR ItemTitle LIKE '${args}')`,
          (error, result) => {
            if (error) handleError(error);
            else event.sender.send("db-query-result", result);
          }
        );
      })
      .catch((error) => handleError(error));
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
