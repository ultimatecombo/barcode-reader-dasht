const _ = require("lodash");
const remote = require("electron").remote;
const { ipcRenderer } = require("electron");
const { BrowserWindow } = require("electron").remote;

const currWin = remote.getCurrentWindow(),
  storage = window.localStorage,
  mcss = require("materialize-css"),
  searchbox = document.getElementById("searchbox"),
  devtoolsBtn = document.getElementById("devtoolsBtn"),
  itemNameElm = document.getElementById("itemName"),
  itemBarcodeElm = document.getElementById("itemBarcode"),
  itemDescElm = document.getElementById("itemDesc"),
  itemPriceElm = document.getElementById("itemPrice"),
  settingsBtn = document.getElementById("settingsBtn"),
  minimizeBtn = document.getElementById("minimizeBtn"),
  closeBtn = document.getElementById("closeBtn"),
  scannerStat = document.getElementById("scannerStatus"),
  databaseStat = document.getElementById("databaseStatus"),
  statusMsgElm = document.getElementById("statusMsg");

initWindow();

ipcRenderer.on("db-query-result", (event, args) => {
  console.log(args);
  if (args.recordset.length > 0) showQueryResult(args.recordset[0]);
  else clearCurrentInfo();
});

ipcRenderer.on("db-test-result", (event, result) => {
  console.log(`database: ${result}`)
  if (result) {
    databaseStat.classList.replace("disconnected", "connected");
    statusMsgElm.innerHTML = "";
  } else {
    databaseStat.classList.replace("connected", "disconnected");
    statusMsgElm.innerHTML = 'خطا در اتصال به داده';
  }
});

ipcRenderer.on("scanner-create-result", (event, result) => {
  console.log(`scanner: ${result}`)
  if (result) {
    ipcRenderer.send("scanner-start");
    scannerStat.classList.replace("disconnected", "connected");
    statusMsgElm.innerHTML = "";
  } else {
    scannerStat.classList.replace("connected", "disconnected");
    statusMsgElm.innerHTML = 'خطا در اتصال به بارکدخوان';
  }
});

ipcRenderer.on("apply-settings", (event, args) => loadSettings());

ipcRenderer.on("error-show", (event, error) => {
  console.log(error);
  // show error message for 10 min
  showToastMessage(error, 600000);
});

function initWindow() {
  initLocalStorage();
  loadSettings();

  // main window is maximized by default
  currWin.maximize();

  // always keep the focus on searchbox
  searchbox.focus();
  searchbox.addEventListener("blur", () => {
    searchbox.focus();
  });
  searchbox.addEventListener(
    "keydown",
    _.debounce(() => queryItem(searchbox.value), 1200)
  );

  // init window buttons
  devtoolsBtn.addEventListener("click", () => {
    if (currWin.webContents.isDevToolsOpened())
      currWin.webContents.closeDevTools();
    else currWin.webContents.openDevTools();
  });
  settingsBtn.addEventListener("click", () => {
    let settingsWin = new BrowserWindow({
      width: 500,
      height: 630,
      frame: false,
      parent: currWin,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
      },
    });

    settingsWin.on("close", () => {
      settingsWin = null;
      currWin.focus();
    });
    settingsWin.on("ready-to-show", () => settingsWin.show());
    settingsWin.loadFile("./views/setting.html");
  });
  closeBtn.addEventListener("click", () => {
    let childs = currWin.getChildWindows();
    childs.forEach((c) => c.close());
    currWin.close();
  });
  minimizeBtn.addEventListener("click", () => currWin.minimize());
}

// initialize settings field in local storage
function initLocalStorage() {
  if (!storage.getItem("settings")) {
    storage.setItem(
      "settings",
      JSON.stringify({
        usbDevName: "",
        usbDevVendorID: "",
        usbDevProductID: "",
        databaseName: "",
        storeName: "",
        columns: [],
      })
    );
  }
}

// load user settings
function loadSettings() {
  let userSettings = JSON.parse(storage.getItem("settings"));

  // show store name in title
  currWin.title = document.getElementById(
    "titlebar__title"
  ).innerHTML = `استعلام قیمت${
    userSettings.storeName ? " - " + userSettings.storeName : ""
  }`;

  if (userSettings.databaseName) {
    ipcRenderer.send("db-create-connection", userSettings.databaseName);
    ipcRenderer.send("db-connection-test");
  }

  if (userSettings.usbDevName) {
    ipcRenderer.send("scanner-create", {
      vendorId: userSettings.usbDevVendorID,
      productId: userSettings.usbDevProductID,
    });    
  }
}

// seperate item price with comma
function seperateWith(price, seperator = ",") {
  let chars = price.split(""),
    count = 0;

  for (let i = chars.length - 1; i > -1; i--) {
    if (count === 2 && chars[i - 1] != undefined) {
      chars.splice(i, 0, seperator);
      count = 0;
    } else count++;
  }

  return chars.join("");
}

// search database for seach string
function queryItem(value = "") {
  if (value) {
    let item = `%${value.trim().replace(" ", "%")}%`;
    ipcRenderer.send("db-query-item", item);
  } else clearCurrentInfo();
}

// show item query result
function showQueryResult(item) {
  // show item name, barcode, desc and price
  itemNameElm.value = item.ItemName;
  itemBarcodeElm.value = item.ItemBarCode;
  itemDescElm.value = item.ItemTitle;
  itemPriceElm.innerHTML = seperateWith(`${item.Price1}`);
  mcss.updateTextFields();
  mcss.textareaAutoResize(itemDescElm);
}

// clear current item information
function clearCurrentInfo() {
  itemNameElm.value = "";
  itemBarcodeElm.value = "";
  itemDescElm.value = "";
  itemPriceElm.innerHTML = "";
  mcss.updateTextFields();
}

function showToastMessage(msg, delay = 400) {
  let id = `class-${getUID()}`;
  mcss.toast({
    html: `<span>${msg}</span><button onclick="dismissToast('${id}')" class="btn-flat toast-action">Dismiss</button>`,
    classes: id,
    displayLength: delay,
  });
}

function dismissToast(id) {
  let toastElm = document.getElementsByClassName(id)[0];
  var toastInstance = M.Toast.getInstance(toastElm);
  toastInstance.dismiss();
}

function getUID() {
  return Math.floor(Math.random() * 1000000000).toString(16);
}
