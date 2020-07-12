let usbDevices = [],
  databases = [];

const ipcRenderer = require("electron").ipcRenderer,
  remote = require("electron").remote,
  storage = window.localStorage,
  mcss = require("materialize-css"),
  currWin = remote.getCurrentWindow(),
  storeElm = document.getElementById("storeName"),
  usbElm = document.getElementById("usbDevice"),
  serverElm = document.getElementById("server"),
  dbElm = document.getElementById("database"),
  colElm = document.getElementById("columns"),
  connectBtn = document.getElementById("connect"),
  saveBtn = document.getElementById("saveBtn"),
  closeBtn = document.getElementById("closeBtn");

currWin.webContents.openDevTools();

initSettings();

// connect to server and get databases list
connectBtn.addEventListener("click", () => {
  let settings = JSON.parse(storage.getItem("settings"));

  // detch databases, fill selectbox
  fetchDatabases(serverElm.value).then((data) => {
    // fill selectbox
    console.log(data);
    let list = data.recordset;
    databases = list.slice();

    // remove current list
    [...dbElm.children].forEach((n) => {
      if (!n.disabled) n.remove();
    });

    dbElm.disabled = false;

    // add new list
    list.forEach((db) => {
      let opt = document.createElement("option");
      let currOpt = settings.databaseName;
      opt.value = db.name;
      opt.innerHTML = db.name;
      if (db.name == currOpt) opt.selected = true;
      dbElm.appendChild(opt);
    });
    mcss.FormSelect.init(document.querySelectorAll("select"));
  });
});

// save user settings in locale storage
saveBtn.addEventListener("click", () => saveSettings());

// close setting window
closeBtn.addEventListener("click", () => currWin.close());

function fetchUsbDevices() {
  return new Promise((resolve, reject) => {
    ipcRenderer.send("usb-get-list");
    ipcRenderer.on("usb-list", (event, args) => resolve(args));
  });
}

function fetchDatabases(server) {
  return new Promise((resolve, reject) => {
    ipcRenderer.send("db-get-list", server);
    ipcRenderer.on("db-list", (event, args) => resolve(args));
  });
}

function initSettings() {
  try {
    let settings = JSON.parse(storage.getItem("settings")),
      columnOptions = {
        itemBarcode: "بارکد",
        itemDesc: "توضیحات",
      };

    storeElm.value = settings.storeName;
    serverElm.value = settings.serverName;
    dbElm.disabled = false;

    // set columns
    Object.keys(columnOptions).forEach((key) => {
      let opt = document.createElement("option");
      opt.value = key;
      opt.innerHTML = columnOptions[key];
      if (settings.columns.includes(key)) opt.selected = true;
      colElm.appendChild(opt);
    });

    let p1, p2;
    p1 = fetchUsbDevices().then((data) => {
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
      mcss.FormSelect.init(document.querySelectorAll("select"));
    });

    if (settings.serverName) {
      p2 = fetchDatabases(serverElm.value).then((data) => {
        // fill selectbox
        console.log(data);
        let list = data.recordset;
        databases = list.slice();
        dbElm.disabled = false;
        list.forEach((db) => {
          let opt = document.createElement("option");
          let currOpt = settings.databaseName;
          opt.value = db.name;
          opt.innerHTML = db.name;
          if (db.name == currOpt) opt.selected = true;
          dbElm.appendChild(opt);
        });
        mcss.FormSelect.init(document.querySelectorAll("select"));
      });
    } else {
      p2 = Promise.resolve();
      dbElm.disabled = true;
    }

    mcss.FormSelect.init(document.querySelectorAll("select"));
  } catch (error) {
    ipcRenderer.send("error-report", error);
  }
}

function saveSettings() {
  try {
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
      db = databases.find(
        (item) => `<span>${item.name}</span>` === db.innerHTML
      );
    }

    storage.setItem(
      "settings",
      JSON.stringify({
        usbDevName: br ? br.product : "",
        usbDevVendorID: br ? br.vendorId : "",
        usbDevProductID: br ? br.productId : "",
        serverName: serverElm.value,
        databaseName: db ? db.name : "",
        storeName: storeElm.value,
        columns: mcss.FormSelect.getInstance(colElm).getSelectedValues(),
      })
    );

    ipcRenderer.send("settings-updated");
    currWin.close();
  } catch (error) {
    ipcRenderer.send("error-report", error);
  }
}
