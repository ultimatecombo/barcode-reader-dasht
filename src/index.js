const remote = require("electron").remote;
const { BrowserWindow } = require("electron").remote;

const currWin = remote.getCurrentWindow(),
  storage = window.localStorage,
  devtoolsBtn = document.getElementById("devtoolsBtn"),
  settingsBtn = document.getElementById("settingsBtn"),
  minimizeBtn = document.getElementById("minimizeBtn"),
  closeBtn = document.getElementById("closeBtn");

initSettings();
let settings = loadSettings();

currWin.title = document.getElementById(
  "titlebar__title"
).innerHTML = `استعلام قیمت - ${settings.storeName}`;

// open browser dev tools
devtoolsBtn.addEventListener("click", () => {
  if (currWin.webContents.isDevToolsOpened())
    currWin.webContents.closeDevTools();
  else currWin.webContents.openDevTools();
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

function loadSettings() {
  return JSON.parse(storage.getItem("settings"));
}
