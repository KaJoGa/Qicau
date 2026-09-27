# Qicau — Spesifikasi Fitur untuk Testing

> Dokumen ini adalah **satu-satunya sumber** untuk menulis test (black-box / "buta").
> Isinya hanya: fitur → input/aksi → output/ekspektasi. Tidak ada detail implementasi.
> Setiap baris punya ID stabil (mis. `HOME-03`) agar test bisa merujuk balik ke spec.

**Qicau** — PWA pencatat pengeluaran berbasis suara untuk pengguna Indonesia. *"Say it, Save it."*
Ucapkan/ketik pengeluaran (Indonesia, Inggris, atau campuran) → AI menguraikan → tersimpan.
Seluruh UI berbahasa Indonesia. Mata uang IDR (Rupiah, tanpa desimal).

## Konvensi

- **Kategori** (tetap, 6): `Makan`, `Jajan`, `Transport`, `Belanja`, `Tagihan`, `Lainnya`.
- **Metode bayar** (tetap, 9): `QRIS`, `Cash`, `Transfer`, `GoPay`, `OVO`, `DANA`, `ShopeePay`, `Kartu`, `Paylater`. Default: `QRIS`.
- **Confidence**: `high` | `medium` | `low`. Hanya `low` yang **tidak** disimpan.
- **Format uang** di UI: gaya `id-ID` (titik sebagai pemisah ribuan), mis. `Rp 25.000`.
- **Batas harga** transaksi: 1 s.d. 999.999.999.
- Output parser AI bersifat probabilistik → test parsing memakai **toleransi** (lihat §6).
- "Hari ini / minggu ini / bulan ini" mengikuti zona waktu perangkat pengguna.

---

## 1. Autentikasi & Sesi  `AUTH`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| AUTH-01 | Buka app tanpa login | Tampil halaman sambutan: logo, judul "Qicau: Say it, Save it.", 3 poin fitur, tombol **"Lanjutkan dengan Google"**. Tidak ada navigasi tab. |
| AUTH-02 | Sedang memuat status login | Tampil skeleton/placeholder, bukan halaman login maupun halaman utama. |
| AUTH-03 | Login Google berhasil | Masuk ke tab **Catat**; header + navigasi bawah (Catat / Riwayat / Bulanan) tampil. |
| AUTH-04 | Popup login ditutup pengguna | Tidak ada error/alert; tetap di halaman login. |
| AUTH-05 | Login gagal (error lain) | Muncul alert "Gagal login: …". |
| AUTH-06 | Pengaturan → **Keluar** | Sesi berakhir, kembali ke halaman login, modal pengaturan tertutup. |
| AUTH-07 | Data antar pengguna | Pengguna A tidak pernah melihat/mengubah data pengguna B (lihat juga §10). |

## 2. Navigasi & Pengaturan  `NAV`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| NAV-01 | Buka `/` setelah login | Tab aktif = Catat. |
| NAV-02 | Buka `/?tab=history` / `/?tab=monthly` / `/?tab=home` | Tab yang bersangkutan aktif. |
| NAV-03 | `?tab=` bernilai tidak dikenal | Tab Catat aktif, tanpa error. |
| NAV-04 | Klik tab Catat/Riwayat/Bulanan | Konten berganti; tab aktif ditandai. |
| NAV-05 | Ikon ⚙ Pengaturan | Modal "Pengaturan": pilihan Tema (Sistem/Terang/Gelap), tombol pasang aplikasi, **Keluar**, **Tutup**. |
| NAV-06 | Pilih tema Gelap / Terang | Tampilan berubah seketika; pilihan tetap setelah reload. |
| NAV-07 | Pilih tema Sistem | Mengikuti preferensi gelap/terang OS, dan ikut berubah saat OS berubah. |
| NAV-08 | Layar desktop lebar | Konten dibatasi lebar tengah (tidak melebar penuh). |

## 3. Catat — Tampilan Utama (Home)  `HOME`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| HOME-01 | Buka tab Catat | Tampil "Pengeluaran Hari Ini" (total), tombol mikrofon besar, teks "Ketuk untuk Bicara", tombol "Input Manual", daftar "Baru Saja". |
| HOME-02 | Total hari ini | = jumlah `harga` semua transaksi milik pengguna sejak 00:00 hari ini. Tanpa transaksi → `Rp 0`. |
| HOME-03 | Daftar "Baru Saja" | Maksimal **3** transaksi hari ini, terbaru di atas. Tiap baris: ikon kategori, platform (atau nama kategori jika platform kosong), `Kategori • Metode`, jumlah bertanda `-`. |
| HOME-04 | Belum ada transaksi hari ini | Tampil "Belum ada transaksi hari ini."; tanpa tautan "Lihat Semua". |
| HOME-05 | Ada transaksi → klik **Lihat Semua** | Pindah ke tab Riwayat. |
| HOME-06 | Transaksi baru masuk / dihapus | Total & daftar ter-update otomatis tanpa reload. |
| HOME-07 | Buka di dua tab/perangkat | Perubahan di satu sisi muncul di sisi lain. |

## 4. Input Suara  `VOICE`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| VOICE-01 | Ketuk mikrofon (online, izin diberikan) | Mulai merekam: teks "Mendengarkan...", tombol berubah jadi "berhenti", bunyi beep mulai (+ getar bila didukung). |
| VOICE-02 | Ketuk tombol saat merekam | Berhenti merekam, beep berhenti, teks "Memproses...", tombol nonaktif selama proses. |
| VOICE-03 | Hening ≥ 2 detik | Rekaman berhenti otomatis, lalu diproses seperti VOICE-02. |
| VOICE-04 | Merekam terus (tanpa hening) | Berhenti otomatis di **60 detik**. |
| VOICE-05 | Rekaman < 0,8 detik (tidak sengaja) | Diabaikan: tidak ada request, tidak ada transaksi, tidak ada error; UI kembali normal. |
| VOICE-06 | Izin mikrofon ditolak | Alert "Membutuhkan akses mikrofon."; UI kembali ke keadaan siap. |
| VOICE-07 | Offline | Alert bahwa perekaman AI butuh internet dan menyarankan "Input Manual"; rekaman tidak dimulai. |
| VOICE-08 | Hasil parse `high`/`medium` | Transaksi **tersimpan**; muncul toast sukses (lihat §5). |
| VOICE-09 | Hasil parse `low` | Transaksi **tidak** tersimpan; muncul modal "Suara Kurang Jelas" (lihat §5b); kejadian dicatat sebagai log low-confidence (`source = voice`). |
| VOICE-10 | Server/AI gagal | Alert "Gagal memproses suara. …pesan…"; tidak ada transaksi tersimpan; tombol aktif kembali. |
| VOICE-11 | Mulai merekam saat toast sukses masih tampil | Toast lama ditutup. |

## 5. Setelah Tersimpan: Toast, Edit, Undo  `SAVE`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| SAVE-01 | Transaksi tersimpan | Toast: "Tersimpan: {platform atau kategori}", baris `Kategori • Rp …`, baris detail; tombol **Edit Transaksi** & **Batal**. |
| SAVE-02 | Toast dibiarkan | Hilang otomatis setelah ±5 detik. |
| SAVE-03 | Klik ✕ pada toast | Toast hilang; transaksi tetap tersimpan. |
| SAVE-04 | Klik **Batal** (undo) | Toast hilang; transaksi **terhapus**; total hari ini berkurang. |
| SAVE-05 | Klik **Edit Transaksi** | Toast hilang; modal edit terbuka terisi data transaksi tsb. |
| SAVE-06 | Edit: kolom Platform | Wajib diisi, maks 50 karakter (ada penghitung `n/50`). |
| SAVE-07 | Edit: Kategori / Metode bayar | Kotak pilih-sambil-ketik; hanya nilai dari daftar tetap yang bisa dipilih (ketik sebagian, mis. "pay" → `Paylater`, lalu Enter/klik luar). Teks tak cocok apa pun → kembali ke nilai sebelumnya. |
| SAVE-08 | Edit: Harga | Angka wajib diisi; input ≥ 10 digit atau > 999.999.999 dibatasi menjadi 999.999.999; nilai negatif tidak diterima. |
| SAVE-09 | Edit: Catatan | Opsional, maks 200 karakter (`n/200`). |
| SAVE-10 | **Simpan Perubahan** | Modal tertutup; perubahan tampil di Home/Riwayat/Bulanan. |
| SAVE-11 | Tutup modal edit (✕) | Perubahan dibuang. |

### 5b. Modal Low-Confidence  `LOWC`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| LOWC-01 | Muncul | Judul "Suara Kurang Jelas" + penjelasan; tombol **Input Manual** dan **Tutup**. |
| LOWC-02 | **Tutup** | Modal hilang; tidak ada transaksi baru. |
| LOWC-03 | **Input Manual** | Modal hilang; modal Input Manual terbuka. |
| LOWC-04 | Log tercatat | Satu dokumen log per kejadian berisi: transkrip mentah, output AI yang ditolak, sumber (`voice`/`text`), dan `input_text` **hanya** bila sumbernya teks. |

## 6. Input Manual  `MAN`

Modal "Input Manual" punya 2 mode: **Teks AI** dan **Formulir Langsung**.

### 6a. Teks AI

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| MAN-01 | Buka modal saat online | Mode "Teks AI" aktif; textarea kosong (placeholder contoh), penghitung `0/500`. |
| MAN-02 | Ketik > 500 karakter | Dipotong di 500; penghitung merah pada 500/500. |
| MAN-03 | Kirim teks berisi transaksi jelas | Modal tutup, "Memproses...", lalu transaksi tersimpan + toast (§5); textarea dikosongkan. |
| MAN-04 | Kirim teks kosong / hanya spasi | Tidak ada request, tidak ada transaksi. |
| MAN-05 | Hasil `low` | Sama seperti VOICE-09 tetapi `source = text` dan `input_text` terisi. |
| MAN-06 | Offline saat kirim | Alert bahwa pemrosesan teks AI butuh internet dan menyarankan "Formulir Langsung"; tidak ada transaksi. |
| MAN-07 | Server/AI gagal | Alert "Gagal memproses teks. …"; tidak ada transaksi. |
| MAN-08 | Tombol **Batal** / ✕ | Modal tertutup, tidak ada transaksi. |

### 6b. Formulir Langsung (tanpa AI, bisa offline)

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| MAN-10 | Buka saat offline | Langsung di mode "Formulir Langsung" (dengan label "(Offline)"); tersedia dan berfungsi. |
| MAN-11 | Nilai awal | Kategori = `Makan`, Metode = `QRIS`, lainnya kosong. |
| MAN-12 | Ketik harga | Hanya digit diterima; tampil berformat ribuan (`25000` → `25.000`); dibatasi maks 999.999.999. |
| MAN-13 | Simpan dengan harga kosong / 0 | Ditolak; alert "Harap masukkan jumlah pengeluaran."; tidak ada transaksi. |
| MAN-14 | Simpan dengan harga valid saja | Tersimpan: kategori `Makan`, metode `QRIS`, platform kosong, detail = nama kategori; toast sukses. |
| MAN-15 | Simpan dengan semua kolom terisi | Tersimpan persis sesuai isian; detail = catatan yang diisi. |
| MAN-16 | Catatan kosong, platform terisi | Detail = nama platform. |
| MAN-17 | Setelah simpan | Modal tutup; harga/platform/catatan dikosongkan untuk pemakaian berikutnya. |
| MAN-18 | Transaksi hasil formulir | Dianggap `high` confidence; tidak pernah menghasilkan log low-confidence. |

## 7. Riwayat  `HIST`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| HIST-01 | Buka tab Riwayat | Judul "Riwayat Transaksi"; filter default **7 Hari Terakhir** + **Semua Kategori**; loading skeleton lalu daftar. |
| HIST-02 | Tanpa transaksi (pada filter aktif) | Tampil "Belum ada riwayat transaksi."; tombol Sync/Reset tidak tampil selama daftar kosong. |
| HIST-03 | Pengelompokan | Dikelompokkan per hari, terbaru di atas. Label: "Hari Ini", "Kemarin", selain itu `D NamaBulan YYYY` (mis. "5 Mei 2026"). |
| HIST-04 | Isi baris | Ikon kategori, platform (atau kategori), `Kategori • Metode`, catatan (jika ada), jumlah `-…`, tombol hapus. |
| HIST-05 | Filter waktu | Opsi: Semua Waktu / 7 Hari Terakhir / 30 Hari Terakhir / Bulan Ini. Hanya transaksi dalam rentang yang tampil. "Bulan Ini" = sejak tanggal 1 pukul 00:00. |
| HIST-06 | Filter kategori | Opsi "Semua Kategori" + 6 kategori; hanya kategori itu yang tampil. |
| HIST-07 | Ganti filter | Kembali ke halaman 1. |
| HIST-08 | Paginasi | **30 transaksi per halaman**; tombol ◀ ▶ dan indikator `halaman / total`. ◀ nonaktif di halaman 1; ▶ nonaktif bila tidak ada data lagi. Klik ▶ memuat halaman berikutnya (data lebih lama) tanpa duplikat/kehilangan baris. |
| HIST-09 | Klik baris | Modal "Detail Pengeluaran": platform, jumlah penuh, kategori, metode, waktu (format lengkap id-ID), catatan (jika ada), tombol **Hapus Transaksi**. |
| HIST-10 | Klik ikon hapus / Hapus Transaksi | Dialog konfirmasi "Hapus Transaksi?" (tak dapat dibatalkan) dengan **Batal** & **Hapus**. |
| HIST-11 | Konfirmasi **Hapus** | Transaksi hilang dari daftar (dan dari total Home & Bulanan); modal detail (jika terbuka) ikut tertutup. |
| HIST-12 | **Batal** pada konfirmasi | Tidak ada yang terhapus. |
| HIST-13 | Transaksi baru dari tab/perangkat lain | Muncul otomatis di halaman pertama. |

## 8. Bulanan / Mingguan  `MON`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| MON-01 | Buka tab Bulanan | Judul "Ringkasan Bulan Ini"; kartu "Total Pengeluaran"; diagram donat; daftar per kategori. |
| MON-02 | Total bulanan | = jumlah semua transaksi sejak tanggal 1 bulan berjalan pukul 00:00. |
| MON-03 | Klik **Mingguan** | Judul "Ringkasan Minggu Ini"; tombol berubah jadi "Bulanan"; total = sejak **Senin** 00:00 minggu berjalan (Minggu masih termasuk minggu yang sama). |
| MON-04 | Per kategori | Hanya kategori yang punya transaksi; urut dari nominal terbesar; tiap baris: ikon, nama, nominal, bar proporsi = nominal ÷ total. |
| MON-05 | Diagram donat | Satu irisan per kategori dengan warna tetap per kategori; tooltip menampilkan nominal Rupiah. Disembunyikan bila tidak ada data. |
| MON-06 | Tanpa data | Total `Rp 0`; teks "Belum ada riwayat transaksi." (mingguan: "Belum ada riwayat transaksi minggu ini."). |
| MON-07 | Data berubah (tambah/edit/hapus) | Ringkasan ter-update otomatis. |
| MON-08 | Transaksi bulan lalu | Tidak ikut dihitung. |

## 9. Ekspor ke Google Sheets  `SYNC`

Tombol **Sync ke Sheets** dan **Reset Ekspor** ada di tab Riwayat (hanya bila ada transaksi).

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| SYNC-01 | Klik Sync saat offline | Toast error bahwa sinkronisasi butuh internet; tidak ada request Google. |
| SYNC-02 | Klik Sync, belum ada token/token kedaluwarsa | Muncul popup login Google untuk izin Sheets & Drive; token dipakai ulang ±50 menit. |
| SYNC-03 | Popup ditutup pengguna | Tanpa toast error; tombol kembali normal. |
| SYNC-04 | Selama sinkron | Tombol berubah "Menyinkronkan..." + spinner; Sync **dan** Reset nonaktif — tetap begitu walau pindah tab. |
| SYNC-05 | Sync pertama tahun T | Dibuat spreadsheet `Qicau_Export_T` bila belum ada; tab **Summary** + satu tab per bulan (`Mei 2026`, dst.). |
| SYNC-06 | Tab bulanan | Header baris 1 (beku): Hari · Tanggal & Waktu (WIB) · Platform / Toko · Kategori · Metode Pembayaran · Harga (Rp) · Catatan. Baris data urut waktu naik, satu baris per transaksi; nama hari hanya di baris pertama tiap tanggal. |
| SYNC-07 | Tabel samping tab bulanan | Tabel "Statistik {Bulan Tahun}" (Total Hari, Total Transaksi, Total Pengeluaran, Rata-rata Transaksi Harian, Rata-rata Pengeluaran Harian) dan "Kategori {Bulan Tahun}" (total per kategori). Angka konsisten dengan baris data. |
| SYNC-08 | Tab Summary | Agregat lintas bulan (Total Hari, Total Transaksi, rata-rata, Total Pengeluaran, per kategori) + diagram pie "Alokasi Pengeluaran (%)"; tanpa baris beku. |
| SYNC-09 | Berhasil | Toast sukses "Berhasil menyinkronkan N transaksi baru!"; N = jumlah transaksi yang benar-benar baru dikirim. |
| SYNC-10 | Sync ulang tanpa data baru | Toast "Semua data sudah tersinkronisasi…"; **tidak ada baris ganda** di Sheets. |
| SYNC-11 | Sync ulang dengan transaksi baru | Hanya transaksi baru yang ditambahkan; statistik & Summary ikut diperbarui. |
| SYNC-12 | Tidak ada transaksi sama sekali | Toast "Tidak ada data untuk disinkronkan."; tidak ada file dibuat. |
| SYNC-13 | Transaksi lintas tahun | Satu spreadsheet per tahun. |
| SYNC-14 | API Google error | Toast error "Gagal sinkronisasi: …"; token tersimpan dibuang (sync berikutnya minta login lagi); transaksi **tidak** ditandai terekspor. |
| SYNC-15 | **Reset Ekspor** (online) | Konfirmasi dulu; **Batal** → tidak ada perubahan. |
| SYNC-16 | Konfirmasi Reset | Semua transaksi ditandai belum-terekspor; toast "Berhasil mereset status N transaksi!…"; sync berikutnya mengirim ulang semuanya. |
| SYNC-17 | Reset saat offline | Toast error butuh internet; tidak ada perubahan. |
| SYNC-18 | File Sheets tahun itu sudah dihapus pengguna | Sync membuat file baru dan mengirim **semua** transaksi tahun itu (meski sebelumnya ditandai terekspor). |

## 10. Layanan AI (API Server)  `API`

Dua endpoint JSON. Kunci AI tidak pernah dikirim ke klien.

### `POST /api/parse-audio` — body `{ audioBase64, mimeType? }`
### `POST /api/parse-text` — body `{ textInput }`

> **Catatan lingkungan:** dua target menjawab kontrak yang sama — server Express lokal (`npm run dev`)
> dan Worker Cloudflare yang di-deploy (`npm run deploy`). API-01 s.d. API-08 berlaku sama di keduanya.
> API-09 (batas payload) dan API-10 (cache header) ditulis berdasarkan server Express lokal dan **belum**
> diverifikasi ulang di Worker Cloudflare, yang menangani ukuran body & cache secara berbeda — lihat
> `OPEN_ISSUES.md`.

| ID | Input | Ekspektasi |
|---|---|---|
| API-01 | `parse-audio` tanpa `audioBase64` | HTTP 400, `{ error: "Missing audio" }`. |
| API-02 | `parse-text` tanpa `textInput` / string kosong | HTTP 400, `{ error: "Missing text input" }`. |
| API-03 | Kunci AI belum dikonfigurasi | HTTP 500, `{ error }` yang menyebut kunci hilang. |
| API-04 | Input valid | HTTP 200, `{ result }` — `result` adalah **string JSON** dengan field: `kategori`, `platform`, `harga`, `detail`, `payment_method`, `confidence`, `raw_transcript` (semua wajib ada). |
| API-05 | Isi `result` | `kategori` ∈ 6 kategori; `payment_method` ∈ 9 metode; `confidence` ∈ {high, medium, low}; `harga` angka bulat ≥ 0. |
| API-06 | `parse-audio` tanpa `mimeType` | Tetap diproses (dianggap webm). |
| API-07 | Model AI utama tidak tersedia / kuota habis / error server | Otomatis dicoba model cadangan berikutnya; klien tetap mendapat hasil jika ada model yang berhasil. |
| API-08 | Semua model gagal | HTTP 500, `{ error }` berisi pesan ramah (mis. akses ditolak / model tak ditemukan / input diblokir kebijakan). |
| API-09 | Payload besar (audio hingga puluhan MB) | Diterima tanpa ditolak karena ukuran (batas 50 MB). |
| API-10 | Route non-API di produksi | Menyajikan halaman app (SPA) dengan `Cache-Control: no-store` untuk HTML. |

## 11. Aturan Parsing AI  `PARSE`

Berlaku sama untuk suara (setelah transkripsi) dan teks. Kolom "Ekspektasi" = nilai yang **wajib** benar;
`platform` & `detail` dinilai longgar (huruf besar/kecil & variasi kecil diterima).

### 11a. Contoh kalimat

| ID | Input | Kategori | Platform | Harga | Bayar | Confidence |
|---|---|---|---|---|---|---|
| PARSE-01 | "Beli kopi goceng di Starbucks pakai gopay" | Jajan | Starbucks | 5000 | GoPay | high |
| PARSE-02 | "Nasi padang 25rb" | Makan | (kosong) | 25000 | QRIS (default) | medium/high |
| PARSE-03 | "Bayar listrik cepego transfer" | Tagihan | (kosong) | 100000 | Transfer | high |
| PARSE-04 | "Lunch at Warmindo 30 thousand cash" | Makan | Warmindo | 30000 | Cash | high |
| PARSE-05 | "Makan ceban di Depot Jeng Tutie" | Makan | Depot Jeng Tutie | 10000 | QRIS | high |
| PARSE-06 | "Halo apa kabar" | — | (kosong) | 0 | — | **low** |
| PARSE-07 | "Kopi 20rb sama roti 15rb" | Jajan | — | 35000 (dijumlah) | QRIS | ≥ medium; **satu** transaksi |
| PARSE-08 | "Naik gojek 18 ribu pakai ovo" | Transport | Gojek | 18000 | OVO | high |
| PARSE-09 | "Belanja bulanan di Indomaret 150k kartu" | Belanja | Indomaret | 150000 | Kartu | high |
| PARSE-10 | "Beli pulsa 50rb dana" | Tagihan | — | 50000 | DANA | ≥ medium |

### 11b. Angka & slang uang

| ID | Ucapan | Harga |
|---|---|---|
| PARSE-20 | cepe / cepek | 100 |
| PARSE-21 | gocap | 50 |
| PARSE-22 | ceceng | 1.000 |
| PARSE-23 | goceng | 5.000 |
| PARSE-24 | ceban | 10.000 |
| PARSE-25 | goban | 50.000 |
| PARSE-26 | noban | 90.000 |
| PARSE-27 | cepego | 100.000 |
| PARSE-28 | gopego | 500.000 |
| PARSE-29 | nopego | 900.000 |
| PARSE-30 | cetiaw / cetiau | 1.000.000 |
| PARSE-31 | "25 ribu", "25rb", "25k", "lima belas ribu" | 25.000 / 25.000 / 25.000 / 15.000 |
| PARSE-32 | "2 juta", "2jt" | 2.000.000 |

### 11c. Platform & merek

| ID | Aturan | Contoh → Platform |
|---|---|---|
| PARSE-40 | Merek dikenal ditulis dengan nama resmi; kata pemicu (Restoran, Cafe, Warung, Minimarket, dll.) dibuang | "Makan di Restoran Solaria 50rb" → `Solaria` |
| PARSE-41 | Salah dengar dikoreksi secara fonetik ke merek dikenal | "Restoran Salaria 30rb" → `Solaria`; "Restoran kaku 80rb" → `Gyu-Kaku`; "sabwey" → `Subway`; "minimaret" → `Indomaret` |
| PARSE-42 | Tempat lokal tak dikenal ditulis apa adanya **dengan** kata pemicu | "Ngopi di Cafe Nako goceng" → `Cafe Nako` |
| PARSE-43 | Kata pemicu tidak pernah berdiri sendiri sebagai platform | Platform ≠ "Restoran" / "Warung" / "Minimarket" saja |
| PARSE-44 | Nama aplikasi bayar tidak pernah jadi platform | "…pakai gopay" → platform bukan `GoPay`; masuk ke metode bayar |
| PARSE-45 | Tak ada tempat/merek disebut | Platform = `""` (bukan null/hilang) |

### 11d. Kategori, bayar, confidence

| ID | Aturan | Ekspektasi |
|---|---|---|
| PARSE-50 | Pemetaan kategori | makan/nasi/sarapan/warteg → Makan; kopi/boba/gorengan/cemilan → Jajan; ojek/grab/bensin/parkir → Transport; Indomaret/Alfamart/mall/belanja → Belanja; listrik/internet/pulsa/paket data/langganan → Tagihan; lainnya (obat, hadiah, hiburan) → Lainnya |
| PARSE-51 | Metode bayar tidak disebut | `QRIS` |
| PARSE-52 | Bahasa campur (ID + EN) | Tetap terurai benar; kategori tetap berbahasa Indonesia. |
| PARSE-53 | Kata isian/ocehan ("eh", "anu") | Diabaikan dalam hasil terstruktur. |
| PARSE-54 | Sinyal transaksi minimal 2 dari (harga, item, platform) | Tidak boleh `low`; field diisi sebisanya. |
| PARSE-55 | Tanpa sinyal transaksi (sapaan/obrolan) | `low`, harga 0. |
| PARSE-56 | `raw_transcript` | Selalu ada; untuk teks = input persis apa adanya. |
| PARSE-57 | Input berupa satu kalimat berisi banyak item | Dijumlahkan menjadi **satu** transaksi; item digabung di `detail`. |

## 12. Keamanan Data (Aturan Basis Data)  `SEC`

Dua koleksi utama + profil pengguna. "Pemilik" = pengguna yang login dengan `user_id` sama.

| ID | Aksi | Ekspektasi |
|---|---|---|
| SEC-01 | Tanpa login: baca/tulis apa pun | Ditolak. |
| SEC-02 | Buat transaksi dengan `user_id` = diri sendiri | Diizinkan. |
| SEC-03 | Buat transaksi dengan `user_id` orang lain | Ditolak. |
| SEC-04 | Baca / ubah / hapus transaksi milik sendiri | Diizinkan. |
| SEC-05 | Baca / ubah / hapus transaksi milik orang lain | Ditolak. |
| SEC-06 | Ubah `user_id` transaksi ke orang lain | Ditolak. |
| SEC-07 | Log low-confidence: buat / baca / hapus milik sendiri | Diizinkan. |
| SEC-08 | Log low-confidence: **ubah** (update) | Ditolak (log bersifat append-only). |
| SEC-09 | Log low-confidence milik orang lain | Ditolak (baca/hapus/buat atas nama orang lain). |
| SEC-10 | Profil pengguna `users/{uid}` | Hanya pemilik `uid` yang boleh baca/tulis. |
| SEC-11 | Login pertama / berikutnya | Profil (email, nama, foto, `last_login`) disimpan/diperbarui. |
| SEC-12 | Koleksi lain yang tidak didefinisikan | Ditolak. |

## 13. Offline & PWA  `PWA`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| PWA-01 | Koneksi putus | Banner "Mode Offline: Data tersimpan lokal & siap sync." muncul di atas. |
| PWA-02 | Koneksi kembali | Banner hijau "Kembali Online…" tampil ±4 detik, lalu hilang. |
| PWA-03 | Catat via Formulir Langsung saat offline | Transaksi tampil langsung di app; otomatis tersinkron ke server saat online kembali. |
| PWA-04 | Fitur yang butuh internet saat offline (suara, Teks AI, Sync, Reset) | Ditolak dengan pesan jelas, tanpa crash (lihat VOICE-07, MAN-06, SYNC-01, SYNC-17). |
| PWA-05 | Kunjungan ulang setelah rilis baru | Muncul prompt pembaruan; menerimanya memuat versi baru. |
| PWA-06 | Belum terpasang & browser mendukung | Tombol "pasang" tersedia (header & pengaturan); berhasil → toast "Aplikasi berhasil dipasang…" dan tombol hilang. |
| PWA-07 | Sudah berjalan sebagai app terpasang | Tombol pasang tidak tampil. |
| PWA-08 | iOS / browser tanpa prompt bawaan | Tombol pasang menampilkan panduan manual (mis. Bagikan → Tambah ke Layar Utama). |
| PWA-09 | Manifest | Nama "Qicau - Pencatat Pengeluaran Suara", ikon 192/512 + maskable, mode standalone, potret, tema `#0a0a0a`, 3 pintasan (Catat, Riwayat, Ringkasan). |
| PWA-10 | Pintasan "Riwayat" / "Ringkasan" | Membuka tab Riwayat / Bulanan (`?tab=history` / `?tab=monthly`). |
| PWA-11 | Halaman HTML | Tidak di-cache oleh server (`no-store`) agar rilis baru langsung terpakai. |

## 14. Notifikasi Global  `TOAST`

| ID | Aksi / Kondisi | Ekspektasi |
|---|---|---|
| TOAST-01 | Toast sukses/gagal dari aksi global (Sync, Reset, pasang app) | Tampil di semua tab (dan halaman login), hijau=sukses / merah=error, hilang ±5 detik, bisa ditutup dengan ✕. |
| TOAST-02 | Toast baru saat toast lama masih tampil | Diganti toast baru. |
