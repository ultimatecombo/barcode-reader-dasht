const sql = require("mssql");
const { app, ipcMain, BrowserWindow } = require("electron");

let mainWindow = null;
let listPool = null;
let queryPool = null;

sql.on("error", (error) => handleError(error));
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  sql.close().then(() => app.quit());
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on("db-get-list", (event, args) => {
  try {
    let config = {
      user: args.username,
      password: args.password,
      server: args.server,
      database: "master",
      encrypt: false,
    };

    if (!listPool) {
      listPool.close();
      listPool = new sql.ConnectionPool(config);
    }

    listPool
      .connect()
      .then((pool) => {
        return pool.request().query("SELECT name FROM MASTER.sys.databases");
      })
      .then((result) => event.sender.send("db-list", result))
      .catch((error) => handleError(error));
  } catch (error) {
    handleError(error);
  }
});

ipcMain.on("db-query-item", (event, args) => {
  try {
    queryPool
      .connect()
      .then((pool) => {
        return pool.request().query(`
          SELECT CASE
          WHEN ItemBarCode IS NULL AND ItemIranCode IS NULL THEN ItemCode
          WHEN ItemBarCode IS NULL AND ItemIranCode IS NOT NULL THEN ItemCode + ' - ' + ItemIranCode
          WHEN ItemBarCode IS NOT NULL AND ItemIranCode IS NULL THEN ItemCode + ' - ' + ItemBarCode
          WHEN ItemBarCode IS NOT NULL AND ItemIranCode IS NOT NULL THEN ItemCode + ' - ' + ItemBarCode + ' - ' + ItemIranCode
          ELSE '' END ForSearch, 'هر ' + UnitTitle + '، ' + ItemTitle ItemName, ItemBarCode, ISNULL(DefaultPrice, 0) DefaultPrice, ISNULL(item.[Description], '') ItemDesc
          FROM POS.vwItemSalePrice
          LEFT JOIN POS.Item item ON item.ItemID = ItemRef
          WHERE ItemSubUnitRef IS NULL AND 
          (ItemCode LIKE '${args}' OR ItemBarCode LIKE '${args}' OR itemIranCode LIKE '${args}' OR ItemTitle LIKE '${args}')`);
      })
      .then((result) => event.sender.send("db-query-result", result))
      .catch((error) => handleError(error));
  } catch (error) {
    handleError(error);
  }
});

ipcMain.on("db-connect", (event, args) => {
  try {
    let config = {
      user: args.username,
      password: args.password,
      server: args.server,
      database: args.database,
      encrypt: false,
    };

    if (!queryPool) {
      queryPool.close();
      queryPool = new sql.ConnectionPool(config);
    }

    queryPool
      .connect()
      .then(() => {
        event.sender.send("db-connect-result", true);
      })
      .catch((error) => {
        event.sender.send("db-connect-result", false);
        handleError(error);
      });
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

function handleError(error) {
  // send error messages to main window to
  // show them to user.
  mainWindow.webContents.send("error-show", error);
}
