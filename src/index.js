const _ = require("lodash");
const onscan = require("onscan.js");
const remote = require("electron").remote;
const { ipcRenderer } = require("electron");
const { BrowserWindow } = require("electron").remote;

const DEADLINE = "8/14/2020";
const PRICE_UNIT = "ریال";

const currWin = remote.getCurrentWindow(),
  storage = window.localStorage,
  mcss = require("materialize-css"),
  searchbox = document.getElementById("searchbox"),
  pincodeModal = document.getElementById("pincodeModal"),
  pincodeModalPin = document.getElementById("pincodeModal__pin"),
  //devtoolsBtn = document.getElementById("devtoolsBtn"),
  itemNameElm = document.getElementById("itemName"),
  itemBarcodeElm = document.getElementById("itemBarcode"),
  itemDescElm = document.getElementById("itemDesc"),
  itemPriceElm = document.getElementById("itemPrice"),
  settingsBtn = document.getElementById("settingsBtn"),
  maximizeBtn = document.getElementById("maximizeBtn"),
  closeBtn = document.getElementById("closeBtn"),
  databaseStat = document.getElementById("databaseStatus");

initWindow();

ipcRenderer.on("db-query-result", (event, args) => {
  if (args.recordset.length > 0) showQueryResult(args.recordset[0]);
  else clearCurrentInfo();
});

ipcRenderer.on("apply-settings", (event, args) => loadSettings());

ipcRenderer.on("error-show", (event, error) => {
  console.log(error);
  // show error message for 10 min
  showToastMessage(error, 600000);
});

function initWindow() {
  initLocalStorage();
  let settings = loadSettings();

  timeLock();

  // main window is maximized by default
  currWin.maximize();

  // always keep the focus on searchbox
  searchbox.focus();
  searchbox.addEventListener("blur", () => {
    let modal = mcss.Modal.getInstance(pincodeModal);
    if (!modal.isOpen) searchbox.focus();
  });

  searchbox.addEventListener(
    "keydown",
    _.debounce((e) => {
      if (e.keyCode != 13) queryItem(searchbox.value);
    }, 1000)
  );

  onscan.attachTo(document, {
    timeBeforeScanTest: 200,
    startChar: [120],
    endChar: [13],
    avgTimeByChar: 40,
    reactToPaste: true,
    minLength: 2,
  });
  document.addEventListener("scan", (e) => {
    console.log(`barcode: ${e.detail.scanCode}`);
    searchbox.value = "";
    queryItem(e.detail.scanCode);
  });

  // init help tooltips
  mcss.Tooltip.init(document.querySelectorAll(".tooltipped"));
  // init modals
  mcss.Modal.init(document.querySelectorAll(".modal"), {
    onOpenEnd: () => pincodeModalPin.focus(),
    onCloseEnd: () => {
      searchbox.focus();
      pincodeModalPin.value = "";
    },
  });

  // init window buttons
  // devtoolsBtn.addEventListener("click", () => {
  //   if (currWin.webContents.isDevToolsOpened())
  //     currWin.webContents.closeDevTools();
  //   else currWin.webContents.openDevTools();
  // });
  settingsBtn.addEventListener("click", () => {
    let settingsWin = new BrowserWindow({
      width: 500,
      height: 730,
      frame: false,
      show: false,
      parent: currWin,
      resizable: false,
      webPreferences: {
        devTools: false,
        nodeIntegration: true,
      },
    });

    settingsWin.on("close", () => {
      settingsWin = null;
      console.log(document.getElementById("window-cover"));
      document.getElementById("window-cover").classList.remove("active");
      currWin.focus();
    });
    settingsWin.on("ready-to-show", () => {
      console.log(document.getElementById("window-cover"));
      document.getElementById("window-cover").classList.add("active");
      settingsWin.show();
    });
    settingsWin.loadFile("./views/setting.html");
  });
  maximizeBtn.addEventListener("click", () => {
    if (currWin.isMaximized()) {
      currWin.unmaximize();
    } else {
      currWin.maximize();
    }
  });
  closeBtn.addEventListener("click", () => {
    if (settings.pincode)
      getUserPin()
        .then((pin) => {
          if (pin === settings.pincode) {
            let childs = currWin.getChildWindows();
            childs.forEach((c) => c.close());
            currWin.close();
          }
        })
        .catch(() => {});
    else {
      let childs = currWin.getChildWindows();
      childs.forEach((c) => c.close());
      currWin.close();
    }
  });
}

// initialize settings field in local storage
function initLocalStorage() {
  if (!storage.getItem("settings")) {
    storage.setItem(
      "settings",
      JSON.stringify({
        pincode: "",
        dbUsername: "",
        dbPassword: "",
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
      connectToDatabase({
        username: userSettings.dbUsername,
        password: userSettings.dbPassword,
        server: userSettings.serverName,
        database: userSettings.databaseName,
      })
        .then(() => {
          databaseStat.classList.replace("disconnected", "connected");
        })
        .catch(() => {
          databaseStat.classList.replace("connected", "disconnected");
        });
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

    return userSettings;
  } catch (error) {
    showToastMessage(error, 600000);
  }
}

function connectToDatabase(config) {
  return new Promise((resolve, reject) => {
    ipcRenderer.send("db-connect", config);
    ipcRenderer.on("db-connect-result", (event, res) => {
      if (res) resolve();
      else reject();
    });
  });
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

function getUserPin() {
  document
    .getElementById("pincodeModal__ok")
    .replaceWith(document.getElementById("pincodeModal__ok").cloneNode(true));
  document
    .getElementById("pincodeModal__cancel")
    .replaceWith(
      document.getElementById("pincodeModal__cancel").cloneNode(true)
    );

  let pincodeModalOk = document.getElementById("pincodeModal__ok");
  let pincodeModalCancel = document.getElementById("pincodeModal__cancel");

  return new Promise((resolve, reject) => {
    let modal = mcss.Modal.getInstance(pincodeModal);
    modal.open();

    pincodeModalOk.addEventListener("click", () => {
      resolve(pincodeModalPin.value);
      modal.close();
    });
    pincodeModalCancel.addEventListener("click", () => {
      reject();
      modal.close();
    });
  });
}

function timeLock() {
  let now = new Date(),
    deadline = new Date(DEADLINE),
    isLocked = storage.getItem("locked");

  if (!isLocked) {
    if (now >= deadline) {
      storage.setItem("locked", true);
      ipcRenderer.send("terminate");
    }
    return;
  } else {
    ipcRenderer.send("terminate");
  }
}
