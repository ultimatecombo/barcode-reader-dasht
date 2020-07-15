let databases = [];

const ipcRenderer = require("electron").ipcRenderer,
  remote = require("electron").remote,
  storage = window.localStorage,
  mcss = require("materialize-css"),
  currWin = remote.getCurrentWindow(),
  storeElm = document.getElementById("storeName"),
  pincodeElm = document.getElementById("pincode"),
  dbUsernameElm = document.getElementById("dbUsername"),
  dbPasswordElm = document.getElementById("dbPassword"),
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
  let config = {
    username: dbUsernameElm.value,
    password: dbPasswordElm.value,
    server: serverElm.value,
  };

  // disable db list till the
  // list comes back from main
  dbElm.disabled = true;
  mcss.FormSelect.init(document.querySelectorAll("select"));

  document.querySelector(".connectBtn__spinner").classList.add("active");
  
  // detch databases, fill selectbox
  fetchDatabases(config).then((data) => {
    // fill selectbox
    let list = data.recordset;
    databases = list.slice();
    dbElm.disabled = false;
    document.querySelector(".connectBtn__spinner").classList.remove("active");

    // remove current list
    [...dbElm.children].forEach((n) => {
      if (!n.disabled) n.remove();
      else n.selected = true;
    });

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

function fetchDatabases(config) {
  return new Promise((resolve, reject) => {
    ipcRenderer.send("db-get-list", config);
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
    pincodeElm.value = settings.pincode;
    dbUsernameElm.value = settings.dbUsername;
    dbPasswordElm.value = settings.dbPassword;
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

    if (settings.serverName) {
      fetchDatabases({
        username: dbUsernameElm.value,
        password: dbPasswordElm.value,
        server: serverElm.value,
      }).then((data) => {
        // fill selectbox
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

    // get selected database
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
        pincode: pincodeElm.value,
        dbUsername: dbUsernameElm.value,
        dbPassword: dbPasswordElm.value,
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
