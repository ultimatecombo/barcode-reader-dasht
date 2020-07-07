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

// ask main process for usb devices list
// // ipcRenderer.send("get-usb-list");
// // ipcRenderer.on("usb-list", (event, args) => {
// //   console.log(args);
// //   try {
// //     // remove redundent elements
// //     let ids = [...new Set(args.map((d) => d.productId))];
// //     let currDeviceId = JSON.parse(storage.getItem("settings")).usbDevProductID;
// //     usbDevices = args.slice();

// //     ids.forEach((id) => {
// //       let device = args.find((d) => d.productId === id);
// //       let opt = document.createElement("option");
// //       opt.value = id;
// //       opt.innerHTML = `${device.product}-${id}`;
// //       if (id == currDeviceId) opt.selected = true;
// //       usbElm.appendChild(opt);
// //     });
// //     mcss.FormSelect.init(document.querySelectorAll("select"));
// //   } catch (error) {
// //     usbDevices = [];
// //     console.log(error);
// //   }
// // });

// ask main process for database list
// // ipcRenderer.send("get-database-list");
// // ipcRenderer.on("database-list", (event, args) => {
// //   console.log(args);
// //   try {
// //     let list = args.recordset;
// //     databases = list.slice();
// //     list.forEach((db) => {
// //       let opt = document.createElement("option");
// //       let currOpt = JSON.parse(storage.getItem("settings")).databaseName;
// //       opt.value = db.name;
// //       opt.innerHTML = db.name;
// //       if (db.name == currOpt) opt.selected = true;
// //       dbElm.appendChild(opt);
// //     });
// //     mcss.FormSelect.init(document.querySelectorAll("select"));
// //   } catch (error) {
// //     console.log(error);
// //   }
// // });

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
  br = usbDevices.find(
    (d) => `<span>${d.product}-${d.productId}</span>` === br.innerHTML
  );

  // get selected barcode reader
  selects = mcss.FormSelect.getInstance(dbElm).dropdownOptions;
  let db = [...selects.children].filter((n) => n.className === "selected")[0];
  db = databases.find((item) => `<span>${item.name}</span>` === db.innerHTML);

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
