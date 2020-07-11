let usbDevices = [],
  databases = [];

const ipcRenderer = require("electron").ipcRenderer,
  remote = require("electron").remote,
  storage = window.localStorage,
  mcss = require("materialize-css"),
  currWin = remote.getCurrentWindow(),
  storeElm = document.getElementById("storeName"),
  usbElm = document.getElementById("usbDevice"),
  dbElm = document.getElementById("database"),
  colElm = document.getElementById("columns"),
  saveBtn = document.getElementById("saveBtn"),
  closeBtn = document.getElementById("closeBtn");

currWin.webContents.openDevTools();

initSettings();

// save user settings in locale storage
saveBtn.addEventListener("click", () => saveSettings());

// close setting window
closeBtn.addEventListener("click", () => currWin.close());

function fetchUsbDevices() {
  return new Promise((resolve, reject) => {
    ipcRenderer.send("get-usb-list");
    ipcRenderer.on("usb-list", (event, args) => resolve(args));
  });
}

function fetchDatabases() {
  return new Promise((resolve, reject) => {
    ipcRenderer.send("get-database-list");
    ipcRenderer.on("database-list", (event, args) => resolve(args));
  });
}

function initSettings() {
  let settings = JSON.parse(storage.getItem("settings")),
    columnOptions = {
      barcode: "بارکد",
      desc: "توضیحات",
    };

  // set store name
  storeElm.value = settings.storeName;

  // set columns
  Object.keys(columnOptions).forEach((key) => {
    let opt = document.createElement("option");
    opt.value = key;
    opt.innerHTML = columnOptions[key];
    if (settings.columns.includes(key)) opt.selected = true;
    colElm.appendChild(opt);
  });

  // detch databases, fill selectbox
  let p1 = fetchDatabases().then((data) => {
    // fill selectbox
    console.log(data);
    let list = data.recordset;
    databases = list.slice();
    list.forEach((db) => {
      let opt = document.createElement("option");
      let currOpt = settings.databaseName;
      opt.value = db.name;
      opt.innerHTML = db.name;
      if (db.name == currOpt) opt.selected = true;
      dbElm.appendChild(opt);
    });
  });

  // fetch usb devices, fill selectbox
  let p2 = fetchUsbDevices().then((data) => {
    console.log(data);
    // remove redundent elements
    let ids = [...new Set(data.map((d) => d.productId))];
    let currDeviceId = settings.usbDevProductID;
    usbDevices = data.slice();

    ids.forEach((id) => {
      let device = data.find((d) => d.productId === id);
      let opt = document.createElement("option");
      opt.value = id;
      opt.innerHTML = `${device.product}-${id}`;
      if (id == currDeviceId) opt.selected = true;
      usbElm.appendChild(opt);
    });
  });

  Promise.all([p1, p2])
    .then(() => {
      // stop loading screen
      // init select boxes
      mcss.FormSelect.init(document.querySelectorAll("select"));
    })
    .catch((err) => {
      console.log(err);
    });
}

function saveSettings() {
  let selects;

  // get selected barcode reader
  selects = mcss.FormSelect.getInstance(usbElm).dropdownOptions;
  let br = [...selects.children].filter((n) => n.className === "selected")[0];
  if (br) {
    br = usbDevices.find(
      (d) => `<span>${d.product}-${d.productId}</span>` === br.innerHTML
    );
  }

  // get selected barcode reader
  selects = mcss.FormSelect.getInstance(dbElm).dropdownOptions;
  let db = [...selects.children].filter((n) => n.className === "selected")[0];
  if (db) {
    db = databases.find((item) => `<span>${item.name}</span>` === db.innerHTML);
  }

  storage.setItem(
    "settings",
    JSON.stringify({
      usbDevName: br ? br.product : "",
      usbDevVendorID: br ? br.vendorId : "",
      usbDevProductID: br ? br.productId : "",
      databaseName: db ? db.name : "",
      storeName: storeElm.value,
      columns: mcss.FormSelect.getInstance(colElm).getSelectedValues(),
    })
  );

  currWin.close();
}
