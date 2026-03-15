// ============================================================
//  WA SHEET SENDER — LIBRARY
//  Upload file ini ke GitHub repo: guna64/sheet-sender
//  Semua fungsi di-assign ke globalThis agar eval() bisa expose ke scope global GAS
// ============================================================

const DEFAULTS = {
  API_KEY      : "H7XXCRM",
  NO_HP_NOTIF  : "082313228875",
  JAM_TRIGGER  : "8",
  DELAY_MIN    : "20",
  DELAY_MAX    : "60",
  API_URL_TEXT : "https://wuzapi.aza.biz.id/chat/send/text",
  API_URL_IMAGE: "https://wuzapi.aza.biz.id/chat/send/image",
  TEMPLATE_PESAN: "Halo [NAMA], kami ada penawaran spesial untuk Anda. Hubungi [NAMA_SALES] di [HP_SALES].",
};

const SHEET_EXCLUDE = ["FLP", "SETTING", "LOG"];

const DATA_SAMPLING = [
  { nama: "Eko Adiguna", hp: "6282313228875" },
];

// ─── 1. MENU ──────────────────────────────────────────────────
globalThis.onOpen_lib = function() {
  SpreadsheetApp.getUi()
    .createMenu("⚙️ Setting WA")
    .addItem("⚙️ Pengaturan Global",         "openFormGlobal")
    .addItem("📋 Pengaturan Per Sheet",       "openFormPerSheet")
    .addItem("🚀 Kirim Semua Sheet Hari Ini", "sendSemuaSheet")
    .addToUi();
};

// ─── 2. DAFTAR SHEET ──────────────────────────────────────────
globalThis.getDataSheets_lib = function() {
  return SpreadsheetApp.getActiveSpreadsheet()
    .getSheets()
    .filter(s => !SHEET_EXCLUDE.includes(s.getName()))
    .map(s => s.getName());
};

// ─── 3. PENGATURAN GLOBAL ─────────────────────────────────────
globalThis.openFormGlobal_lib = function() {
  const props = PropertiesService.getDocumentProperties();
  const apiKey  = props.getProperty("API_KEY_WUZAPI") || DEFAULTS.API_KEY;
  const noNotif = props.getProperty("NO_HP_NOTIF")    || DEFAULTS.NO_HP_NOTIF;

  const html = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:sans-serif;padding:16px;color:#333}
    label{font-weight:bold;font-size:13px;display:block;margin-top:12px;margin-bottom:4px}
    input{width:100%;padding:8px;box-sizing:border-box;border:1px solid #ccc;border-radius:4px}
    button{background:#008CBA;color:white;padding:11px;border:none;cursor:pointer;border-radius:4px;margin-top:16px;font-weight:bold;width:100%;font-size:14px}
    button:hover{background:#007B9E}
    button:disabled{background:#ccc;cursor:not-allowed}
    #status{text-align:center;margin-top:10px;font-weight:bold;color:green}
  </style>
</head>
<body>
  <label>API Key WuzAPI:</label>
  <input type="text" id="apiKey" value="${apiKey}" placeholder="Token WuzAPI">
  <label>Nomor HP Admin (Notifikasi):</label>
  <input type="text" id="noNotif" value="${noNotif}" placeholder="Contoh: 082313228875">
  <button id="btn" onclick="simpan()">Simpan Pengaturan Global</button>
  <div id="status"></div>
  <script>
    function simpan() {
      var btn = document.getElementById('btn');
      btn.disabled = true; btn.innerText = '⏳ Menyimpan...';
      google.script.run
        .withSuccessHandler(function(msg) {
          document.getElementById('status').innerText = msg;
          btn.innerText = '✅ Berhasil!';
          setTimeout(function(){ google.script.host.close(); }, 1500);
        })
        .withFailureHandler(function(e) {
          alert('Error: ' + e);
          btn.disabled = false; btn.innerText = 'Simpan Pengaturan Global';
        })
        .simpanPengaturanGlobal({
          apiKey : document.getElementById('apiKey').value.trim(),
          noNotif: document.getElementById('noNotif').value.trim(),
        });
    }
  <\/script>
</body>
</html>`;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(460).setHeight(260),
    "Pengaturan Global WuzAPI"
  );
};

globalThis.simpanPengaturanGlobal_lib = function(data) {
  const props = PropertiesService.getDocumentProperties();
  props.setProperty("API_KEY_WUZAPI", data.apiKey);
  props.setProperty("NO_HP_NOTIF",    data.noNotif);
  return "Pengaturan global berhasil disimpan!";
};

// ─── 4. PENGATURAN PER SHEET ──────────────────────────────────
globalThis.openFormPerSheet_lib = function() {
  const daftarSheet     = JSON.stringify(getDataSheets_lib());
  const allConfig       = JSON.stringify(getAllSheetConfig_lib());
  const defaultPesan    = DEFAULTS.TEMPLATE_PESAN.replace(/'/g, "\\'");
  const defaultDelayMin = DEFAULTS.DELAY_MIN;
  const defaultDelayMax = DEFAULTS.DELAY_MAX;

  const html = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}
    body{font-family:sans-serif;padding:12px;color:#333;font-size:13px;margin:0}
    .tab-bar{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #008CBA}
    .tab-btn{padding:6px 14px;border:1px solid #ccc;background:#f0f0f0;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;color:#555}
    .tab-btn.active{background:#008CBA;color:white;border-color:#008CBA}
    .tab-panel{display:none}
    .tab-panel.active{display:block}
    label{font-weight:bold;display:block;margin-top:10px;margin-bottom:3px;color:#444}
    input[type="text"],select,textarea{width:100%;padding:7px;border:1px solid #ccc;border-radius:4px;font-family:sans-serif;font-size:13px}
    input[type="number"]{padding:7px;border:1px solid #ccc;border-radius:4px;font-family:sans-serif;font-size:13px}
    textarea{height:105px;resize:none}
    .toggle-wrap{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px;background:#f0f8ff;border-radius:4px;border:1px solid #c8e6fa}
    .toggle-wrap input[type="checkbox"]{width:16px;height:16px;cursor:pointer}
    .toggle-wrap span{font-weight:bold;color:#006494}
    .delay-wrap{display:flex;align-items:center;gap:8px;margin-top:4px}
    .delay-wrap input[type="number"]{width:72px}
    .delay-wrap span{color:#555}
    .info{font-size:11px;color:#555;background:#f9f9f9;padding:6px 8px;border-left:3px solid #008CBA;margin-bottom:4px;line-height:1.5}
    .info-delay{font-size:11px;color:#666;background:#fffbe6;padding:5px 8px;border-left:3px solid #f0a500;margin-top:4px;line-height:1.5;border-radius:2px}
    code{background:#e0e0e0;padding:1px 4px;border-radius:3px;color:#c62828;font-weight:bold}
    .btn-simpan{background:#008CBA;color:white;padding:11px;border:none;cursor:pointer;border-radius:4px;margin-top:14px;font-weight:bold;width:100%;font-size:14px}
    .btn-simpan:hover{background:#007B9E}
    .btn-simpan:disabled{background:#ccc;cursor:not-allowed}
    #status{text-align:center;margin-top:8px;font-weight:bold;color:green}
  </style>
</head>
<body>
<div class="tab-bar" id="tabBar"></div>
<div id="tabContent"></div>
<button class="btn-simpan" id="btnSimpan" onclick="simpanSemua()">💾 Simpan Semua Konfigurasi</button>
<div id="status"></div>
<script>
  var daftarSheet   = ${daftarSheet};
  var allConfig     = ${allConfig};
  var defaultPesan  = '${defaultPesan}';
  var defaultDelMin = ${defaultDelayMin};
  var defaultDelMax = ${defaultDelayMax};
  var tabBar        = document.getElementById('tabBar');
  var tabContent    = document.getElementById('tabContent');

  daftarSheet.forEach(function(name, idx) {
    var cfg       = allConfig[name] || { aktif:true, pesan:defaultPesan, imageUrl:'', jam:'8', delayMin:defaultDelMin, delayMax:defaultDelMax };
    var cfgDelMin = (cfg.delayMin !== undefined && cfg.delayMin !== '') ? parseInt(cfg.delayMin) : defaultDelMin;
    var cfgDelMax = (cfg.delayMax !== undefined && cfg.delayMax !== '') ? parseInt(cfg.delayMax) : defaultDelMax;

    var btn = document.createElement('button');
    btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
    btn.innerText = name;
    btn.onclick   = (function(i){ return function(){ switchTab(i); }; })(idx);
    tabBar.appendChild(btn);

    var jamOptions = '';
    for (var j = 0; j < 24; j++) {
      var sel = (j == parseInt(cfg.jam)) ? 'selected' : '';
      jamOptions += '<option value="' + j + '" ' + sel + '>' + (j < 10 ? '0'+j : j) + ':00</option>';
    }

    var panel = document.createElement('div');
    panel.className = 'tab-panel' + (idx === 0 ? ' active' : '');
    panel.id = 'panel_' + idx;
    panel.innerHTML =
      '<div class="toggle-wrap">' +
        '<input type="checkbox" id="aktif_'+idx+'" '+(cfg.aktif?'checked':'')+'>'+
        '<span>Aktifkan pengiriman untuk sheet ini</span>'+
      '</div>'+
      '<label>⏰ Jam Kirim Otomatis:</label>'+
      '<select id="jam_'+idx+'">'+jamOptions+'</select>'+
      '<label>⏱️ Delay Antar Pesan (detik):</label>'+
      '<div class="delay-wrap">'+
        '<input type="number" id="delayMin_'+idx+'" value="'+cfgDelMin+'" min="1" max="300"> '+
        '<span>s/d</span> '+
        '<input type="number" id="delayMax_'+idx+'" value="'+cfgDelMax+'" min="1" max="300"> '+
        '<span>detik</span>'+
      '</div>'+
      '<div class="info-delay">⚠️ Delay acak antara min–max. Jika kontak banyak & delay besar, pengiriman lanjut otomatis setelah timeout (±5 menit).</div>'+
      '<label>Link Gambar (kosongkan = kirim teks saja):</label>'+
      '<input type="text" id="img_'+idx+'" value="'+(cfg.imageUrl||'')+'" placeholder="https://...promo.jpg">'+
      '<label>Template Pesan:</label>'+
      '<div class="info">Variabel: <code>[NAMA]</code> &nbsp;<code>[NAMA_SALES]</code> &nbsp;<code>[HP_SALES]</code></div>'+
      '<textarea id="pesan_'+idx+'">'+(cfg.pesan||defaultPesan)+'</textarea>';
    tabContent.appendChild(panel);
  });

  function switchTab(idx) {
    document.querySelectorAll('.tab-btn').forEach(function(b,i){ b.classList.toggle('active', i===idx); });
    document.querySelectorAll('.tab-panel').forEach(function(p,i){ p.classList.toggle('active', i===idx); });
  }

  function simpanSemua() {
    var btn = document.getElementById('btnSimpan');
    btn.disabled = true; btn.innerText = '⏳ Menyimpan...';
    var valid = true;
    daftarSheet.forEach(function(name, idx) {
      var mn = parseInt(document.getElementById('delayMin_'+idx).value);
      var mx = parseInt(document.getElementById('delayMax_'+idx).value);
      if (isNaN(mn)||isNaN(mx)||mn<1||mx<1||mn>mx) {
        alert('Sheet "'+name+'": Delay min harus ≥ 1 dan min ≤ max!');
        valid = false;
      }
    });
    if (!valid) { btn.disabled=false; btn.innerText='💾 Simpan Semua Konfigurasi'; return; }

    var result = {};
    daftarSheet.forEach(function(name, idx) {
      result[name] = {
        aktif   : document.getElementById('aktif_'+idx).checked,
        jam     : document.getElementById('jam_'+idx).value,
        delayMin: parseInt(document.getElementById('delayMin_'+idx).value),
        delayMax: parseInt(document.getElementById('delayMax_'+idx).value),
        imageUrl: document.getElementById('img_'+idx).value.trim(),
        pesan   : document.getElementById('pesan_'+idx).value,
      };
    });
    google.script.run
      .withSuccessHandler(function(msg){
        document.getElementById('status').innerText = msg;
        btn.innerText = '✅ Berhasil!';
        setTimeout(function(){ google.script.host.close(); }, 1500);
      })
      .withFailureHandler(function(e){
        alert('Error: '+e);
        btn.disabled=false; btn.innerText='💾 Simpan Semua Konfigurasi';
      })
      .simpanKonfigurasiSheet(JSON.stringify(result));
  }
<\/script>
</body>
</html>`;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(520).setHeight(700),
    "Pengaturan Pesan Per Sheet"
  );
};

globalThis.getAllSheetConfig_lib = function() {
  const props  = PropertiesService.getDocumentProperties();
  const sheets = getDataSheets_lib();
  const result = {};
  sheets.forEach(name => {
    const raw = props.getProperty("SHEET_CFG_" + name);
    result[name] = raw ? JSON.parse(raw) : {
      aktif   : true,
      pesan   : DEFAULTS.TEMPLATE_PESAN,
      imageUrl: "",
      jam     : DEFAULTS.JAM_TRIGGER,
      delayMin: parseInt(DEFAULTS.DELAY_MIN),
      delayMax: parseInt(DEFAULTS.DELAY_MAX),
    };
  });
  return result;
};

globalThis.simpanKonfigurasiSheet_lib = function(dataJson) {
  const props  = PropertiesService.getDocumentProperties();
  const config = JSON.parse(dataJson);
  Object.keys(config).forEach(name => {
    props.setProperty("SHEET_CFG_" + name, JSON.stringify(config[name]));
  });
  setupTriggerHarian_lib();
  return "Konfigurasi per sheet berhasil disimpan!";
};

// ─── 5. KIRIM SEMUA SHEET ─────────────────────────────────────
globalThis.sendSemuaSheet_lib = function() {
  const startTime   = new Date().getTime();
  const props       = PropertiesService.getDocumentProperties();
  const apiKey      = props.getProperty("API_KEY_WUZAPI") || DEFAULTS.API_KEY;
  const noHpNotif   = props.getProperty("NO_HP_NOTIF")    || "";
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const sheetFLP    = ss.getSheetByName("FLP");
  const mapSales    = sheetFLP ? _buildSalesMap_lib(sheetFLP) : {};
  const timezone    = Session.getScriptTimeZone();
  const todayStr    = Utilities.formatDate(new Date(), timezone, "dd/MM/yyyy");
  const jamSekarang = new Date().getHours();
  const isManual    = _isManualRun_lib();

  const dataSheets = getDataSheets_lib();
  const allConfig  = getAllSheetConfig_lib();

  // ── Counter dengan breakdown per-sheet ──────────────────────
  const savedCounterRaw = props.getProperty("RESUME_COUNTER");
  let totalCounter = savedCounterRaw
    ? JSON.parse(savedCounterRaw)
    : { success: 0, failed: 0, sheets: {} };

  const resumeRaw       = props.getProperty("RESUME_STATE");
  let   resumeState     = resumeRaw ? JSON.parse(resumeRaw) : null;
  let   skipUntilResume = !!resumeState;
  let   adaYangDiproses = false;

  for (const sheetName of dataSheets) {
    const cfg = allConfig[sheetName] || {};
    if (!cfg.aktif) continue;

    const jamSheet = parseInt(cfg.jam || DEFAULTS.JAM_TRIGGER, 10);
    if (!isManual && jamSheet !== jamSekarang) continue;

    if (skipUntilResume && resumeState.sheetName !== sheetName) continue;

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    adaYangDiproses = true;

    // Inisialisasi counter per-sheet
    if (!totalCounter.sheets[sheetName]) {
      totalCounter.sheets[sheetName] = { success: 0, failed: 0, sampling: false };
    }

    // ── Sampling per-sheet: cek apakah sheet ini sudah kirim sampling hari ini ──
    const lastSamplingSheet    = props.getProperty("LAST_SAMPLING_" + sheetName);
    let   samplingSudahDikirim = (lastSamplingSheet === todayStr);

    const rows     = _getSheetData_lib(sheet);
    const template = cfg.pesan    || DEFAULTS.TEMPLATE_PESAN;
    const imageUrl = cfg.imageUrl || "";
    const delayMin = (parseInt(cfg.delayMin) || parseInt(DEFAULTS.DELAY_MIN)) * 1000;
    const delayMax = (parseInt(cfg.delayMax) || parseInt(DEFAULTS.DELAY_MAX)) * 1000;

    const startRow = (skipUntilResume && resumeState.sheetName === sheetName)
      ? resumeState.rowIndex : 0;
    skipUntilResume = false;

    for (let i = startRow; i < rows.length; i++) {

      // ── CEK SISA WAKTU: buffer 30 detik sebelum batas 5 menit ──
      if (new Date().getTime() - startTime > 270000) {
        props.setProperty("RESUME_STATE",   JSON.stringify({ sheetName, rowIndex: i }));
        props.setProperty("RESUME_COUNTER", JSON.stringify(totalCounter));
        _createResumptionTrigger_lib();
        SpreadsheetApp.flush();
        return;
      }

      const row          = rows[i];
      const tanggalStr   = _formatTanggal_lib(row[0], timezone);
      const namaKonsumen = row[1] ? row[1].toString().trim() : "";
      const noHP         = row[2] ? row[2].toString().trim() : "";
      const namaSales    = row[3] ? row[3].toString().trim() : "";
      const statusKirim  = row[4] ? row[4].toString().trim().toUpperCase() : "";

      if (tanggalStr !== todayStr || !noHP || statusKirim === "TERKIRIM") continue;

      const phone      = formatPhoneNumber_lib(noHP);
      const hpSales    = mapSales[namaSales] || "-";
      const pesanFinal = template
        .replace(/\[NAMA\]/g,       namaKonsumen)
        .replace(/\[NAMA_SALES\]/g, namaSales)
        .replace(/\[HP_SALES\]/g,   hpSales);

      const ok = imageUrl
        ? _sendImage_lib(phone, pesanFinal, imageUrl, apiKey)
        : _sendText_lib(phone, pesanFinal, apiKey);

      if (ok) {
        totalCounter.success++;
        totalCounter.sheets[sheetName].success++;
        sheet.getRange(2 + i, 5).setValue("TERKIRIM");
        SpreadsheetApp.flush();

        // ── Sampling per-sheet: kirim sekali per hari per sheet ──
        if (!samplingSudahDikirim) {
          DATA_SAMPLING.forEach((sample, si) => {
            const pesanSample = template
              .replace(/\[NAMA\]/g,       sample.nama)
              .replace(/\[NAMA_SALES\]/g, namaSales)
              .replace(/\[HP_SALES\]/g,   hpSales);
            imageUrl
              ? _sendImage_lib(sample.hp, pesanSample, imageUrl, apiKey)
              : _sendText_lib(sample.hp, pesanSample, apiKey);
            if (si < DATA_SAMPLING.length - 1) Utilities.sleep(3000);
          });
          props.setProperty("LAST_SAMPLING_" + sheetName, todayStr);
          samplingSudahDikirim = true;
          totalCounter.sheets[sheetName].sampling = true;
        }

        // ── Delay random antar pesan ────────────────────────────
        const delayMs = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
        Utilities.sleep(delayMs);

      } else {
        totalCounter.failed++;
        totalCounter.sheets[sheetName].failed++;
      }
    }
  }

  props.deleteProperty("RESUME_STATE");
  props.deleteProperty("RESUME_COUNTER");
  _deleteAllTriggers_lib();
  setupTriggerHarian_lib();
  _sendNotifikasi_lib(noHpNotif, totalCounter, apiKey);

  const ui = _getUi_lib();
  if (adaYangDiproses) {
    _showResult_lib(ui, totalCounter);
  } else if (ui) {
    ui.alert("Tidak ada sheet yang dijadwalkan pada jam " + jamSekarang + ":00");
  }
};

globalThis._isManualRun_lib = function() {
  try { SpreadsheetApp.getUi(); return true; } catch(e) { return false; }
};

// ─── 6. TRIGGER ───────────────────────────────────────────────
globalThis.setupTriggerHarian_lib = function() {
  _deleteAllTriggers_lib();
  const allConfig      = getAllSheetConfig_lib();
  const jamSudahDibuat = new Set();
  Object.keys(allConfig).forEach(name => {
    const cfg = allConfig[name];
    if (!cfg.aktif) return;
    const jam = parseInt(cfg.jam || DEFAULTS.JAM_TRIGGER, 10);
    if (jamSudahDibuat.has(jam)) return;
    ScriptApp.newTrigger("sendSemuaSheet").timeBased().atHour(jam).everyDays(1).create();
    jamSudahDibuat.add(jam);
  });
};

globalThis._createResumptionTrigger_lib = function() {
  _deleteAllTriggers_lib();
  ScriptApp.newTrigger("sendSemuaSheet").timeBased().after(60000).create();
};

globalThis._deleteAllTriggers_lib = function() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "sendSemuaSheet") ScriptApp.deleteTrigger(t);
  });
};

// ─── 7. HELPERS ───────────────────────────────────────────────
globalThis._getUi_lib = function() {
  try { return SpreadsheetApp.getUi(); } catch(e) { return null; }
};

globalThis._buildSalesMap_lib = function(sheet) {
  const map = {};
  sheet.getRange("A:B").getValues().forEach(([n, p]) => {
    if (n) map[n.toString().trim()] = p.toString().trim();
  });
  return map;
};

globalThis._getSheetData_lib = function(sheet) {
  const last = sheet.getLastRow();
  return last < 2 ? [] : sheet.getRange(2, 1, last - 1, 5).getValues();
};

globalThis._formatTanggal_lib = function(raw, tz) {
  return (raw instanceof Date)
    ? Utilities.formatDate(raw, tz, "dd/MM/yyyy")
    : (raw ? raw.toString().trim() : "");
};

globalThis._sendText_lib = function(phone, body, apiKey) {
  return _callApi_lib(DEFAULTS.API_URL_TEXT, { Phone: phone, Body: body }, apiKey);
};

globalThis._sendImage_lib = function(phone, caption, imageUrl, apiKey) {
  return _callApi_lib(DEFAULTS.API_URL_IMAGE, { Phone: phone, Caption: caption, Image: imageUrl }, apiKey);
};

globalThis._callApi_lib = function(url, payload, apiKey) {
  try {
    const res = UrlFetchApp.fetch(url, {
      method            : "post",
      contentType       : "application/json",
      headers           : { token: apiKey },
      payload           : JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    return res.getResponseCode() === 200 || res.getResponseCode() === 201;
  } catch(e) { return false; }
};

globalThis._sendNotifikasi_lib = function(no, counter, apiKey) {
  if (!no) return;
  const sheetKeys = counter.sheets ? Object.keys(counter.sheets) : [];
  let lines = ["*📋 LAPORAN HARIAN MULTI-SHEET*"];

  if (sheetKeys.length > 0) {
    sheetKeys.forEach(sheetName => {
      const s           = counter.sheets[sheetName];
      const samplingTag = s.sampling ? " _(sampling ✅)_" : "";
      lines.push(`\n*Sheet: ${sheetName}*${samplingTag}\n  ✅ Berhasil : ${s.success}\n  ❌ Gagal    : ${s.failed}`);
    });
    lines.push(`\n────────────────\n*Total*\n  ✅ Berhasil : ${counter.success}\n  ❌ Gagal    : ${counter.failed}`);
  } else {
    lines.push(`ℹ️ Tidak ada sheet yang diproses hari ini.`);
  }

  _sendText_lib(formatPhoneNumber_lib(no), lines.join("\n"), apiKey);
};

globalThis._showResult_lib = function(ui, counter) {
  if (ui) ui.alert(`Proses Selesai!\nBerhasil: ${counter.success}\nGagal: ${counter.failed}`);
};

globalThis.formatPhoneNumber_lib = function(phone) {
  if (!phone) return null;
  const d = phone.toString().replace(/\D/g, "");
  if (d.startsWith("62")) return d;
  if (d.startsWith("0"))  return "62" + d.slice(1);
  return "62" + d;
};