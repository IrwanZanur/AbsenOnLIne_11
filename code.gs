const WALI_KELAS = [
  "irwanzanur@gmail.com",
  "curriekulum@gmail.com"
];

function isWaliKelas() {
  const email = Session.getActiveUser().getEmail();
  return WALI_KELAS.includes(email);
}

function doGet() {
  if (!isWaliKelas()) {
    return HtmlService.createHtmlOutput("⛔ Akses ditolak: hanya untuk wali kelas.");
  }
  return HtmlService.createHtmlOutputFromFile('formAbsensiMulti')
    .setTitle("Absensi Harian")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSiswaByKelas(kelas) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(kelas);
  if (!sheet) return [];
  return sheet.getRange("A2:A").getValues().map(r => r[0]).filter(n => n && n.trim() !== "");
}

function getAbsensiByTanggalKelas(tanggal, kelas) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Absensi");
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  
  // Konversi format tanggal ke string 'yyyy-mm-dd'
  const inputDate = new Date(tanggal);
  const tglFormatted = Utilities.formatDate(inputDate, Session.getScriptTimeZone(), "yyyy-MM-dd");

  return data
    .filter(r => {
      const sheetDate = typeof r[0] === "object"
        ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : r[0];
      return sheetDate === tglFormatted && r[1] === kelas;
    })
    .map(r => ({ nama: r[2], status: r[3] }));
}


function simpanAbsensiBatch(tanggal, kelas, absensiList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Absensi");
  if (!sheet) sheet = ss.insertSheet("Absensi");

  const tanggalFix = new Date(tanggal).toISOString().slice(0, 10);

  const lastRow = sheet.getLastRow();
  for (let i = lastRow; i >= 2; i--) {
    const row = sheet.getRange(i, 1, 1, 2).getValues()[0];
    const rowTgl = new Date(row[0]).toISOString().slice(0, 10);
    if (rowTgl === tanggalFix && row[1] === kelas) {
      sheet.deleteRow(i);
    }
  }

  absensiList.forEach(item => {
    sheet.appendRow([tanggalFix, kelas, item.nama, item.status || ""]);
  });

  updateRekap();
  return "✅ Absensi berhasil disimpan / diperbarui.";
}

function updateRekap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetAbsensi = ss.getSheetByName("Absensi");
  const sheetRekap = ss.getSheetByName("Rekap") || ss.insertSheet("Rekap");

  const data = sheetAbsensi.getRange(2, 1, sheetAbsensi.getLastRow() - 1, 4).getValues();
  const rekap = {};

  data.forEach(([tanggal, kelas, nama, status]) => {
    const key = `${kelas}-${nama}`;
    if (!rekap[key]) {
      rekap[key] = { kelas, nama, Sakit: 0, Izin: 0, Dispen: 0, Alfa: 0 };
    }
    if (rekap[key][status] !== undefined) {
      rekap[key][status]++;
    }
  });

  const hasil = Object.values(rekap).map(r => [
    r.kelas, r.nama, r.Sakit, r.Izin, r.Dispen, r.Alfa
  ]);

  sheetRekap.clearContents();
  sheetRekap.appendRow(["Kelas", "Nama", "Sakit", "Izin", "Dispen", "Alfa"]);
  if (hasil.length > 0) {
    sheetRekap.getRange(2, 1, hasil.length, 6).setValues(hasil);
  }
}