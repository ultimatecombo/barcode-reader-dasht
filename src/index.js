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
  closeBtn = document.getElementById("closeBtn");

initSettings();
let settings = loadSettings();

currWin.title = document.getElementById(
  "titlebar__title"
).innerHTML = `استعلام قیمت - ${settings.storeName}`;

// main window is maximized by default
currWin.maximize();

ipcRenderer.send("db-create-connection", "Dasht01");

ipcRenderer.on("db-query-result", (event, args) => {
  console.log(args);
  if (args.recordset.length > 0) showQueryResult(args.recordset[0]);
  else clearCurrentInfo();
});

// open browser dev tools
devtoolsBtn.addEventListener("click", () => {
  if (currWin.webContents.isDevToolsOpened())
    currWin.webContents.closeDevTools();
  else currWin.webContents.openDevTools();
});

searchbox.addEventListener(
  "keydown",
  _.debounce(() => queryItem(searchbox.value), 1200)
);

// always keep the focus on searchbox
searchbox.focus();
searchbox.addEventListener('blur', ()=>{
  searchbox.focus();
});

// create settings window
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

// close the main window and quit the app
closeBtn.addEventListener("click", () => {
  let childs = currWin.getChildWindows();
  childs.forEach((c) => c.close());
  currWin.close();
});

// minimize app window
minimizeBtn.addEventListener("click", () => currWin.minimize());

// initialize settings field in local storage
function initSettings() {
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
  return JSON.parse(storage.getItem("settings"));
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
    let item = `%${value.trim().replace(" ", "%")}%`
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
