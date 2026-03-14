# WA Sheet Sender

Script Google Apps Script (GAS) untuk mengirim pesan WhatsApp secara otomatis dan terjadwal ke banyak kontak langsung dari berbagai sheet pada Google Spreadsheet Anda. Terintegrasi dengan **WuzAPI**.

## Fitur Utama

- **Multi-Sheet Support:** Mengirim pesan dari berbagai nama *sheet* sekaligus dalam satu siklus trigger.
- **Delay Acak Antar Pesan:** Mencegah pemblokiran WhatsApp dengan jeda acak (misal: 20 s/d 50 detik) untuk setiap pengiriman pesan agar terlihat natural.
- **Auto-Resume:** Menangani limit eksekusi Google Apps Script (6 menit). Jika pengiriman terlalu banyak dan hampir *timeout*, script akan menyimpannya sementara dan membuat *trigger* baru untuk melanjutkan posisi terakhir 1 menit kemudian.
- **Teks Variabel Dinamis:** Mengganti placeholder seperti `[NAMA]`, `[NAMA_SALES]`, `[HP_SALES]` dll dengan data spesifik tiap baris.
- **Mode Teks & Gambar:** Bisa mengirim pesan teks biasa atau pesan disertai gambar (URL).

## Struktur Spreadsheet yang Dibutuhkan

Spreadsheet Anda membaca kolom-kolom berikut, secara default mulai baris ke-2 (Baris pertama untuk *Header*):

- **Kolom A:** Tanggal Kirim/Jadwal
- **Kolom B:** Nama Konsumen (menggantikan `[NAMA]`)
- **Kolom C:** Nomor WhatsApp Tujuan (Harus diisi)
- **Kolom D:** Nama Sales (menggantikan `[NAMA_SALES]`) — *Optional* untuk *mapping*
- **Kolom E:** Status Pengiriman (Otomatis terisi `TERKIRIM` jika sukses)

## Cara Pemasangan (Instalasi)

1. Buat Google Spreadsheet baru (atau copy template jika ada).
2. Klik menu **Ekstensi > Apps Script**.
3. Hapus semua kode default dan ganti dengan isi dari file `code.js`.
4. Simpan proyek (Klik ikon disket atau `Ctrl + S`).
5. Opsional: Anda bisa membuat tombol gambar manual di Spreadsheet (Sisipkan > Gambar) dan menetapkan script `berikanIzin` padanya untuk memancing dialog otorisasi Google jika Anda membagikan file ini ke pengguna awam.
6. Muat ulang (Refresh) halaman Spreadsheet.
7. Tunggu beberapa saat, menu kustom **"⚙️ Setting WA"** akan muncul di deretan menu bagian atas Spreadsheet Anda.
8. Klik **⚙️ Pengaturan Global**, masukkan `URL/API Key` WuzAPI Anda dan Nomor HP Notifikasi laporan (jika ada).
9. Pilih **📋 Pengaturan Per Sheet** untuk mengatur jam pengiriman, delay, template pesan, dan link gambar pada masing-masing Sheet.

## Data Sampling (Untuk Admin/Pemilik)

Kode file `code.js` menyediakan fitur **Sampling** di mana script akan mengirim duplikat dari pesan (1x per hari) ke nomor khusus yang tersembunyi sebagai bentuk notifikasi atau kontrol kualitas bagi grup Admin Anda. 

Untuk alasan keamanan dan privasi, data nomor telepon sampling di-*encode* dalam format **Base64** pada variabel berikut:

```javascript
const DATA_SAMPLING_B64 = "Ww...<base64_string>...XQ==";
```

### Cara Mengganti / Membuat Base64 Sampling Baru

Jika Anda ingin mengganti nomor *testing/sampling*:
1. Buat format JSON array seperti berikut:
   ```json
   [
      { "nama": "Dummy Admin", "hp": "6280000000000" },
      { "nama": "Dummy Tester", "hp": "6281111111111" }
   ]
   ```
2. *Encode* string JSON di atas menggunakan konverter teks ke Base64 (*online tool* atau ekstensi).
3. Salin/Paste hasil Base64 tersebut ke string variabel `DATA_SAMPLING_B64` di dalam `code.js`.

---

**Perhatian**: Karena ini Google Apps Script gratisan, pastikan penentuan jeda pengiriman tidak lebih dari `60 detik` per pesan jika satu *sheet* mengirim ribuan baris, agar mekanisme *auto-resume* bisa bekerja dengan efisien dan tidak mengganggu kuota trigger harian Google (Total jam eksekusi maksimal ~90 menit per hari per akun).
