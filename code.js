// ============================================================
//  WA PENAWARAN SENDER — LIBRARY VERSION
//  Semua HTML embedded, tidak perlu file HTML terpisah
//  v2: Delay per-sheet (random min-max) + Resume setelah timeout
// ============================================================

const DEFAULTS = {
    API_KEY: "XXXXXXXXX",
    NO_HP_NOTIF: "08XXXXXXXXX",
    JAM_TRIGGER: "8",
    DELAY_MIN: "20",
    DELAY_MAX: "50",
    API_URL_TEXT: "https://wuzapi.aza.biz.id/chat/send/text",
    API_URL_IMAGE: "https://wuzapi.aza.biz.id/chat/send/image",
    TEMPLATE_PESAN: "Halo [NAMA], kami ada penawaran spesial untuk Anda. Hubungi [NAMA_SALES] di [HP_SALES].",
};

const SHEET_EXCLUDE = ["FLP", "SETTING", "LOG"];

// Data sampling di-encode menggunakan Base64 agar tidak terbaca langsung oleh user awam
// Format asli: [{ nama: "Eko Adiguna", hp: "628XXXXXXXXX" }]
const DATA_SAMPLING_B64 = "W3sibmFtYSI6IkVrbyBBZGlndW5hIiwgImhwIjoiNjI4MjMxMzIyODg3NSJ9XQ==";

function getSamplingData() {
    try {
        const decoded = Utilities.base64Decode(DATA_SAMPLING_B64);
        const text = Utilities.newBlob(decoded).getDataAsString();
        return JSON.parse(text);
    } catch (e) {
        return [];
    }
}

// ─── 1. MENU ─────────────────────────────────────────────────
function onOpen() {
    try {
        SpreadsheetApp.getUi()
            .createMenu("⚙️ Setting WA")
            .addItem("⚙️ Pengaturan Global", "openFormGlobal")
            .addItem("📋 Pengaturan Per Sheet", "openFormPerSheet")
            .addItem("🚀 Kirim Semua Sheet Hari Ini", "sendSemuaSheet")
            .addToUi();
    } catch (e) {
        // Abaikan jika UI tidak dapat dimuat
    }
}

// Fungsi khusus pancingan otorisasi lewat tombol (Drawing)
function berikanIzin() {
    var ui = SpreadsheetApp.getUi();
    ui.alert("✅ Akses Diizinkan", "Izin script telah berhasil diberikan! Sekarang Anda dapat menggunakan fitur-fitur melalui menu '⚙️ Setting WA' di bagian atas.", ui.ButtonSet.OK);
}

// ─── 2. AMBIL DAFTAR SHEET DATA ──────────────────────────────
function getDataSheets() {
    return SpreadsheetApp.getActiveSpreadsheet()
        .getSheets()
        .filter(s => !SHEET_EXCLUDE.includes(s.getName()))
        .map(s => s.getName());
}

// ─── 3. POPUP PENGATURAN GLOBAL ──────────────────────────────
function openFormGlobal() {
    const props = PropertiesService.getDocumentProperties();
    const apiKey = props.getProperty("API_KEY_WUZAPI") || DEFAULTS.API_KEY;
    const noNotif = props.getProperty("NO_HP_NOTIF") || DEFAULTS.NO_HP_NOTIF;

    const html = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: sans-serif; padding: 16px; color: #333; }
    label { font-weight: bold; font-size: 13px; display: block; margin-top: 12px; margin-bottom: 4px; }
    input { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
    button {
      background: #008CBA; color: white; padding: 11px; border: none;
      cursor: pointer; border-radius: 4px; margin-top: 16px;
      font-weight: bold; width: 100%; font-size: 14px;
    }
    button:hover { background: #007B9E; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    #status { text-align: center; margin-top: 10px; font-weight: bold; color: green; }
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
      btn.disabled = true;
      btn.innerText = '⏳ Menyimpan...';
      google.script.run
        .withSuccessHandler(function(msg) {
          document.getElementById('status').innerText = msg;
          btn.innerText = '✅ Berhasil!';
          setTimeout(function() { google.script.host.close(); }, 1500);
        })
        .withFailureHandler(function(e) {
          alert('Error: ' + e);
          btn.disabled = false;
          btn.innerText = 'Simpan Pengaturan Global';
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
}

function simpanPengaturanGlobal(data) {
    const props = PropertiesService.getDocumentProperties();
    props.setProperty("API_KEY_WUZAPI", data.apiKey);
    props.setProperty("NO_HP_NOTIF", data.noNotif);
    return "Pengaturan global berhasil disimpan!";
}

// ─── 4. POPUP PENGATURAN PER SHEET ───────────────────────────
function openFormPerSheet() {
    const daftarSheet = JSON.stringify(getDataSheets());
    const allConfig = JSON.stringify(getAllSheetConfig());
    const defaultPesan = DEFAULTS.TEMPLATE_PESAN.replace(/'/g, "\\'");
    const defaultDelayMin = DEFAULTS.DELAY_MIN;
    const defaultDelayMax = DEFAULTS.DELAY_MAX;

    const html = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; padding: 12px; color: #333; font-size: 13px; margin: 0; }
    .tab-bar {
      display: flex; flex-wrap: wrap; gap: 4px;
      margin-bottom: 12px; padding-bottom: 8px;
      border-bottom: 2px solid #008CBA;
    }
    .tab-btn {
      padding: 6px 14px; border: 1px solid #ccc;
      background: #f0f0f0; border-radius: 4px;
      cursor: pointer; font-size: 12px; font-weight: bold; color: #555;
    }
    .tab-btn.active { background: #008CBA; color: white; border-color: #008CBA; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    label { font-weight: bold; display: block; margin-top: 10px; margin-bottom: 3px; color: #444; }
    input[type="text"], select, textarea {
      width: 100%; padding: 7px; border: 1px solid #ccc;
      border-radius: 4px; font-family: sans-serif; font-size: 13px;
    }
    input[type="number"] {
      padding: 7px; border: 1px solid #ccc;
      border-radius: 4px; font-family: sans-serif; font-size: 13px;
    }
    textarea { height: 105px; resize: none; }
    .toggle-wrap {
      display: flex; align-items: center; gap: 8px;
      margin-top: 10px; padding: 8px;
      background: #f0f8ff; border-radius: 4px; border: 1px solid #c8e6fa;
    }
    .toggle-wrap input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
    .toggle-wrap span { font-weight: bold; color: #006494; }
    .delay-wrap {
      display: flex; align-items: center; gap: 8px; margin-top: 4px;
    }
    .delay-wrap input[type="number"] { width: 72px; }
    .delay-wrap span { color: #555; }
    .info {
      font-size: 11px; color: #555; background: #f9f9f9;
      padding: 6px 8px; border-left: 3px solid #008CBA;
      margin-bottom: 4px; line-height: 1.5;
    }
    .info-delay {
      font-size: 11px; color: #666; background: #fffbe6;
      padding: 5px 8px; border-left: 3px solid #f0a500;
      margin-top: 4px; line-height: 1.5; border-radius: 2px;
    }
    code { background: #e0e0e0; padding: 1px 4px; border-radius: 3px; color: #c62828; font-weight: bold; }
    .btn-simpan {
      background: #008CBA; color: white; padding: 11px; border: none;
      cursor: pointer; border-radius: 4px; margin-top: 14px;
      font-weight: bold; width: 100%; font-size: 14px;
    }
    .btn-simpan:hover { background: #007B9E; }
    .btn-simpan:disabled { background: #ccc; cursor: not-allowed; }
    #status { text-align: center; margin-top: 8px; font-weight: bold; color: green; }
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

  var tabBar     = document.getElementById('tabBar');
  var tabContent = document.getElementById('tabContent');

  daftarSheet.forEach(function(name, idx) {
    var cfg        = allConfig[name] || { aktif: true, pesan: defaultPesan, imageUrl: '', jam: '8', delayMin: defaultDelMin, delayMax: defaultDelMax };
    var cfgDelMin  = (cfg.delayMin !== undefined && cfg.delayMin !== '') ? parseInt(cfg.delayMin) : defaultDelMin;
    var cfgDelMax  = (cfg.delayMax !== undefined && cfg.delayMax !== '') ? parseInt(cfg.delayMax) : defaultDelMax;

    var btn       = document.createElement('button');
    btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
    btn.innerText = name;
    btn.onclick   = (function(i) { return function() { switchTab(i); }; })(idx);
    tabBar.appendChild(btn);

    var jamOptions = '';
    for (var j = 0; j < 24; j++) {
      var sel = (j == parseInt(cfg.jam)) ? 'selected' : '';
      jamOptions += '<option value="' + j + '" ' + sel + '>' + (j < 10 ? '0' + j : j) + ':00</option>';
    }

    var panel       = document.createElement('div');
    panel.className = 'tab-panel' + (idx === 0 ? ' active' : '');
    panel.id        = 'panel_' + idx;
    panel.innerHTML =
      '<div class="toggle-wrap">' +
        '<input type="checkbox" id="aktif_' + idx + '" ' + (cfg.aktif ? 'checked' : '') + '>' +
        '<span>Aktifkan pengiriman untuk sheet ini</span>' +
      '</div>' +

      '<label>⏰ Jam Kirim Otomatis:</label>' +
      '<select id="jam_' + idx + '">' + jamOptions + '</select>' +

      '<label>⏱️ Delay Antar Pesan (detik):</label>' +
      '<div class="delay-wrap">' +
        '<input type="number" id="delayMin_' + idx + '" value="' + cfgDelMin + '" min="1" max="300"> ' +
        '<span>s/d</span> ' +
        '<input type="number" id="delayMax_' + idx + '" value="' + cfgDelMax + '" min="1" max="300"> ' +
        '<span>detik</span>' +
      '</div>' +
      '<div class="info-delay">⚠️ Delay acak antara min–max. Jika total kontak banyak & delay besar, pengiriman dilanjutkan otomatis setelah timeout AppScript (±5 menit).</div>' +

      '<label>Link Gambar (kosongkan = kirim teks saja):</label>' +
      '<input type="text" id="img_' + idx + '" value="' + (cfg.imageUrl || '') + '" placeholder="https://...promo.jpg">' +

      '<label>Template Pesan:</label>' +
      '<div class="info">Variabel: <code>[NAMA]</code> &nbsp;<code>[NAMA_SALES]</code> &nbsp;<code>[HP_SALES]</code></div>' +
      '<textarea id="pesan_' + idx + '">' + (cfg.pesan || defaultPesan) + '</textarea>';

    tabContent.appendChild(panel);
  });

  function switchTab(idx) {
    document.querySelectorAll('.tab-btn').forEach(function(b, i) {
      b.classList.toggle('active', i === idx);
    });
    document.querySelectorAll('.tab-panel').forEach(function(p, i) {
      p.classList.toggle('active', i === idx);
    });
  }

  function simpanSemua() {
    var btn = document.getElementById('btnSimpan');
    btn.disabled = true;
    btn.innerText = '⏳ Menyimpan...';

    // Validasi delay
    var valid = true;
    daftarSheet.forEach(function(name, idx) {
      var mn = parseInt(document.getElementById('delayMin_' + idx).value);
      var mx = parseInt(document.getElementById('delayMax_' + idx).value);
      if (isNaN(mn) || isNaN(mx) || mn < 1 || mx < 1 || mn > mx) {
        alert('Sheet "' + name + '": Delay min harus ≥ 1 dan min ≤ max!');
        valid = false;
      }
    });
    if (!valid) {
      btn.disabled = false;
      btn.innerText = '💾 Simpan Semua Konfigurasi';
      return;
    }

    var result = {};
    daftarSheet.forEach(function(name, idx) {
      result[name] = {
        aktif   : document.getElementById('aktif_'    + idx).checked,
        jam     : document.getElementById('jam_'      + idx).value,
        delayMin: parseInt(document.getElementById('delayMin_' + idx).value),
        delayMax: parseInt(document.getElementById('delayMax_' + idx).value),
        imageUrl: document.getElementById('img_'      + idx).value.trim(),
        pesan   : document.getElementById('pesan_'    + idx).value,
      };
    });

    google.script.run
      .withSuccessHandler(function(msg) {
        document.getElementById('status').innerText = msg;
        btn.innerText = '✅ Berhasil!';
        setTimeout(function() { google.script.host.close(); }, 1500);
      })
      .withFailureHandler(function(e) {
        alert('Error: ' + e);
        btn.disabled = false;
        btn.innerText = '💾 Simpan Semua Konfigurasi';
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
}

function getAllSheetConfig() {
    const props = PropertiesService.getDocumentProperties();
    const sheets = getDataSheets();
    const result = {};
    sheets.forEach(name => {
        const raw = props.getProperty("SHEET_CFG_" + name);
        result[name] = raw ? JSON.parse(raw) : {
            aktif: true,
            pesan: DEFAULTS.TEMPLATE_PESAN,
            imageUrl: "",
            jam: DEFAULTS.JAM_TRIGGER,
            delayMin: parseInt(DEFAULTS.DELAY_MIN),
            delayMax: parseInt(DEFAULTS.DELAY_MAX),
        };
    });
    return result;
}

function simpanKonfigurasiSheet(dataJson) {
    const props = PropertiesService.getDocumentProperties();
    const config = JSON.parse(dataJson);
    Object.keys(config).forEach(sheetName => {
        props.setProperty("SHEET_CFG_" + sheetName, JSON.stringify(config[sheetName]));
    });
    setupTriggerHarian();
    return "Konfigurasi per sheet berhasil disimpan!";
}

// ─── 5. KIRIM SEMUA SHEET ────────────────────────────────────
function sendSemuaSheet() {
    const startTime = new Date().getTime();
    const props = PropertiesService.getDocumentProperties();
    const apiKey = props.getProperty("API_KEY_WUZAPI") || DEFAULTS.API_KEY;
    const noHpNotif = props.getProperty("NO_HP_NOTIF") || "";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetFLP = ss.getSheetByName("FLP");
    const mapSales = sheetFLP ? _buildSalesMap(sheetFLP) : {};
    const timezone = Session.getScriptTimeZone();
    const todayStr = Utilities.formatDate(new Date(), timezone, "dd/MM/yyyy");
    const jamSekarang = new Date().getHours();
    const isManual = _isManualRun();

    const lastSamplingDate = props.getProperty("LAST_SAMPLING_DATE");
    let samplingSudahDikirim = (lastSamplingDate === todayStr);

    const dataSheets = getDataSheets();
    const allConfig = getAllSheetConfig();

    // ── Baca counter yang sudah tersimpan (untuk resume) ──────────
    const savedCounterRaw = props.getProperty("RESUME_COUNTER");
    let totalCounter = savedCounterRaw
        ? JSON.parse(savedCounterRaw)
        : { success: 0, failed: 0 };

    // ── Baca resume state ──────────────────────────────────────────
    // resumeState = { sheetName: "...", rowIndex: N }
    const resumeRaw = props.getProperty("RESUME_STATE");
    let resumeState = resumeRaw ? JSON.parse(resumeRaw) : null;

    // Tandai: apakah kita sedang dalam mode lanjut (resume)?
    let skipUntilResume = !!resumeState;
    let adaYangDiproses = false;

    for (const sheetName of dataSheets) {
        const cfg = allConfig[sheetName] || {};
        if (!cfg.aktif) continue;

        const jamSheet = parseInt(cfg.jam || DEFAULTS.JAM_TRIGGER, 10);
        if (!isManual && jamSheet !== jamSekarang) continue;

        // Saat resume: lewati sheet yang sudah selesai sebelumnya
        if (skipUntilResume && resumeState.sheetName !== sheetName) continue;

        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) continue;

        adaYangDiproses = true;

        const rows = _getSheetData(sheet);
        const template = cfg.pesan || DEFAULTS.TEMPLATE_PESAN;
        const imageUrl = cfg.imageUrl || "";

        // Delay dalam milidetik — ambil dari config, fallback ke DEFAULTS
        const delayMin = (parseInt(cfg.delayMin) || parseInt(DEFAULTS.DELAY_MIN)) * 1000;
        const delayMax = (parseInt(cfg.delayMax) || parseInt(DEFAULTS.DELAY_MAX)) * 1000;

        // Tentukan baris awal: kalau ini sheet yang di-resume, mulai dari rowIndex tersimpan
        const startRow = (skipUntilResume && resumeState.sheetName === sheetName)
            ? resumeState.rowIndex
            : 0;
        skipUntilResume = false; // setelah sheet resume ditemukan, proses normal lagi

        for (let i = startRow; i < rows.length; i++) {

            // ── CEK SISA WAKTU: buffer 30 detik sebelum batas 6 menit ──
            if (new Date().getTime() - startTime > 270000) {
                // Simpan posisi & counter lalu buat trigger resume
                props.setProperty("RESUME_STATE", JSON.stringify({ sheetName, rowIndex: i }));
                props.setProperty("RESUME_COUNTER", JSON.stringify(totalCounter));
                _createResumptionTrigger();
                return; // keluar, otomatis lanjut 1 menit kemudian
            }

            const row = rows[i];
            const tanggalStr = _formatTanggal(row[0], timezone);
            const namaKonsumen = row[1] ? row[1].toString().trim() : "";
            const noHP = row[2] ? row[2].toString().trim() : "";
            const namaSales = row[3] ? row[3].toString().trim() : "";
            const statusKirim = row[4] ? row[4].toString().trim() : "";

            if (tanggalStr !== todayStr || !noHP || statusKirim === "TERKIRIM") continue;

            const phone = formatPhoneNumber(noHP);
            const hpSales = mapSales[namaSales] || "-";
            const pesanFinal = template
                .replace(/\[NAMA\]/g, namaKonsumen)
                .replace(/\[NAMA_SALES\]/g, namaSales)
                .replace(/\[HP_SALES\]/g, hpSales);

            const ok = imageUrl
                ? _sendImage(phone, pesanFinal, imageUrl, apiKey)
                : _sendText(phone, pesanFinal, apiKey);

            if (ok) {
                totalCounter.success++;
                sheet.getRange(2 + i, 5).setValue("TERKIRIM");

                // Kirim sampling satu kali per hari
                if (!samplingSudahDikirim) {
                    getSamplingData().forEach(sample => {
                        const pesanSample = template
                            .replace(/\[NAMA\]/g, sample.nama)
                            .replace(/\[NAMA_SALES\]/g, namaSales)
                            .replace(/\[HP_SALES\]/g, hpSales);
                        imageUrl
                            ? _sendImage(sample.hp, pesanSample, imageUrl, apiKey)
                            : _sendText(sample.hp, pesanSample, apiKey);
                    });
                    props.setProperty("LAST_SAMPLING_DATE", todayStr);
                    samplingSudahDikirim = true;
                }

                // ── DELAY RANDOM antar pesan ────────────────────────────
                const delayMs = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                Utilities.sleep(delayMs);

            } else {
                totalCounter.failed++;
            }
        }
    }

    // ── Semua selesai: bersihkan state resume & atur ulang trigger ──
    props.deleteProperty("RESUME_STATE");
    props.deleteProperty("RESUME_COUNTER");
    _deleteAllTriggers();
    setupTriggerHarian();
    _sendNotifikasi(noHpNotif, totalCounter, apiKey);

    const ui = _getUi();
    if (adaYangDiproses) {
        _showResult(ui, totalCounter);
    } else if (ui) {
        ui.alert("Tidak ada sheet yang dijadwalkan pada jam " + jamSekarang + ":00");
    }
}

function _isManualRun() {
    try { SpreadsheetApp.getUi(); return true; } catch (e) { return false; }
}

// ─── 6. TRIGGER MANAGEMENT ───────────────────────────────────
function setupTriggerHarian() {
    _deleteAllTriggers();
    const allConfig = getAllSheetConfig();
    const jamSudahDibuat = new Set();

    Object.keys(allConfig).forEach(sheetName => {
        const cfg = allConfig[sheetName];
        if (!cfg.aktif) return;
        const jam = parseInt(cfg.jam || DEFAULTS.JAM_TRIGGER, 10);
        if (jamSudahDibuat.has(jam)) return;
        ScriptApp.newTrigger("sendSemuaSheet").timeBased().atHour(jam).everyDays(1).create();
        jamSudahDibuat.add(jam);
    });
}

function resumeSendSemuaSheet() {
    sendSemuaSheet();
}

function _createResumptionTrigger() {
    // Hapus trigger resume lama (kalau ada), lalu buat yang baru
    ScriptApp.getProjectTriggers().forEach(t => {
        if (t.getHandlerFunction() === "resumeSendSemuaSheet") {
            try { ScriptApp.deleteTrigger(t); } catch (e) { }
        }
    });
    ScriptApp.newTrigger("resumeSendSemuaSheet").timeBased().after(60000).create();
}

function _deleteAllTriggers() {
    ScriptApp.getProjectTriggers().forEach(t => {
        if (t.getHandlerFunction() === "sendSemuaSheet" || t.getHandlerFunction() === "resumeSendSemuaSheet") {
            try { ScriptApp.deleteTrigger(t); } catch (e) { }
        }
    });
}

// ─── 7. HELPERS ──────────────────────────────────────────────
function _getUi() { try { return SpreadsheetApp.getUi(); } catch (e) { return null; } }

function _buildSalesMap(sheet) {
    const map = {};
    sheet.getRange("A:B").getValues().forEach(([n, p]) => {
        if (n) map[n.toString().trim()] = p.toString().trim();
    });
    return map;
}

function _getSheetData(sheet) {
    const last = sheet.getLastRow();
    return last < 2 ? [] : sheet.getRange(2, 1, last - 1, 5).getValues();
}

function _formatTanggal(raw, tz) {
    return (raw instanceof Date)
        ? Utilities.formatDate(raw, tz, "dd/MM/yyyy")
        : (raw ? raw.toString().trim() : "");
}

function _sendText(phone, body, apiKey) {
    return _callApi(DEFAULTS.API_URL_TEXT, { Phone: phone, Body: body }, apiKey);
}

function _sendImage(phone, caption, imageUrl, apiKey) {
    return _callApi(DEFAULTS.API_URL_IMAGE, { Phone: phone, Caption: caption, Image: imageUrl }, apiKey);
}

function _callApi(url, payload, apiKey) {
    try {
        const res = UrlFetchApp.fetch(url, {
            method: "post",
            contentType: "application/json",
            headers: { token: apiKey },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true,
        });
        return res.getResponseCode() === 200 || res.getResponseCode() === 201;
    } catch (e) { return false; }
}

function _sendNotifikasi(no, counter, apiKey) {
    if (!no) return;
    _sendText(
        formatPhoneNumber(no),
        `*[LAPORAN HARIAN MULTI-SHEET]*\n✅ Berhasil: ${counter.success}\n❌ Gagal: ${counter.failed}`,
        apiKey
    );
}

function _showResult(ui, counter) {
    if (ui) ui.alert(`Proses Selesai!\nBerhasil: ${counter.success}\nGagal: ${counter.failed}`);
}

function formatPhoneNumber(phone) {
    if (!phone) return null;
    const d = phone.toString().replace(/\D/g, "");
    if (!d) return null;
    if (d.startsWith("62")) return d;
    if (d.startsWith("0")) return "62" + d.slice(1);
    return "62" + d;
}