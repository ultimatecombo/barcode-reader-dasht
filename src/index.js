const _ = require("lodash");
const remote = require("electron").remote;
const { ipcRenderer } = require("electron");
const { BrowserWindow } = require("electron").remote;
const onscan = require("onscan.js");

const PRICE_UNIT = "ریال";
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
  maximizeBtn = document.getElementById("maximizeBtn"),
  closeBtn = document.getElementById("closeBtn"),
  databaseStat = document.getElementById("databaseStatus");

initWindow();

ipcRenderer.on("db-query-result", (event, args) => {
  if (args.recordset.length > 0) showQueryResult(args.recordset[0]);
  else clearCurrentInfo();
});

ipcRenderer.on("db-test-result", (event, result) => {
  console.log(`database: ${result}`);
  if (result) {
    databaseStat.classList.replace("disconnected", "connected");
  } else {
    databaseStat.classList.replace("connected", "disconnected");
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
    _.debounce(() => {
      console.log("keydown");
      queryItem(searchbox.value);
    }, 1000)
  );

  onscan.attachTo(document, {    
    timeBeforeScanTest: 200,    
    startChar: [120],    
    endChar: [13],   
    avgTimeByChar: 40,
    reactToPaste: true,
    onKeyDetect: function (iKeyCode) {      
      console.log("Pressed: " + iKeyCode);
    }
  });
  document.addEventListener("scan", (e) => {
    console.log(`barcode: ${e.detail.scanCode}`);
    searchbox.value = e.detail.scanCode;
    queryItem(e.detail.scanCode);
  });

  // init help tooltips
  mcss.Tooltip.init(document.querySelectorAll(".tooltipped"));

  // init window buttons
  devtoolsBtn.addEventListener("click", () => {
    if (currWin.webContents.isDevToolsOpened())
      currWin.webContents.closeDevTools();
    else currWin.webContents.openDevTools();
  });
  settingsBtn.addEventListener("click", () => {
    let settingsWin = new BrowserWindow({
      width: 500,
      height: 620,
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
  maximizeBtn.addEventListener("click", () => {
    if (currWin.isMaximized()) {
      currWin.unmaximize();
    } else {
      currWin.maximize();
    }
  });
}

// initialize settings field in local storage
function initLocalStorage() {
  if (!storage.getItem("settings")) {
    storage.setItem(
      "settings",
      JSON.stringify({
        serverName: "",
        databaseName: "",
        storeName: "",
        columns: [],
      })
    );
  }
}

// load user settings
function loadSettings() {
  try {
    let userSettings = JSON.parse(storage.getItem("settings"));

    // show store name in title
    currWin.title = document.getElementById(
      "titlebar__title"
    ).innerHTML = `استعلام قیمت${
      userSettings.storeName ? " - " + userSettings.storeName : ""
    }`;

    if (userSettings.serverName && userSettings.databaseName) {
      ipcRenderer.send("db-create-connection", {
        server: userSettings.serverName,
        database: userSettings.databaseName,
      });
      ipcRenderer.send("db-connection-test");
    } else {
      databaseStat.classList.replace("connected", "disconnected");
    }

    if (userSettings.columns) {
      ["itemBarcode", "itemDesc"].forEach((col) => {
        let elm = document.getElementById(col).parentElement;
        if (userSettings.columns.includes(col)) elm.style.display = "block";
        else elm.style.display = "none";
      });
    }
  } catch (error) {
    showToastMessage(error, 600000);
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
  itemDescElm.value = item.ItemDesc;
  itemPriceElm.innerHTML =
    item.DefaultPrice > 0 &&
    item.DefaultPrice != null &&
    item.DefaultPrice != undefined
      ? `${seperateWith(`${item.DefaultPrice}`)}  ${PRICE_UNIT}`
      : "تعریف نشده";
  mcss.updateTextFields();
  mcss.textareaAutoResize(itemDescElm);
}

// clear current item information
function clearCurrentInfo() {
  itemNameElm.value = "";
  itemBarcodeElm.value = "";
  itemDescElm.value = "";
  itemPriceElm.innerHTML = "--";
  mcss.updateTextFields();
}

function showToastMessage(msg, delay = 400) {
  let id = `class-${getUID()}`;
  mcss.toast({
    html: `<span>${msg}</span><button onclick="dismissToast('${id}')" class="btn-flat toast-action toast-close"><i class="fas fa-times"></i></button>`,
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
