# Open Issues — Spec vs Implementasi

Ditemukan saat membaca kode untuk menyusun `Qicau.md`.
**Bukan untuk penulis test buta.** Setiap butir perlu keputusan: perbaiki app, atau sesuaikan spec/README.

> **Update 2026-09-27:** repo pindah dari `master` ke `main` dan berkembang banyak sejak draft pertama
> file ini (lihat D2/D7-D9 & keputusan #4-#5 baru). `firestore.rules` tidak berubah — bagian §12 `SEC`
> di `Qicau.md` masih akurat.

## Dokumentasi tidak sesuai kode

| # | README / klaim | Kenyataan di kode |
|---|---|---|
| D1 | Fitur "Export → CSV" | Tidak ada UI/logika CSV; hanya kunci teks `exportCSV` di `i18n.ts`. Spec **tidak** memuat CSV. |
| D2 | README: model fallback `gemini-3.5-flash-lite → 3.8 → 3.7 → 3.6 → 3.5 → 3.0-flash → 2.5-flash` | `shared/gemini.ts` (`MODELS_TO_TRY`, sekarang di-`export`) pakai urutan & isi berbeda: `3.5-flash-lite, 3.5-flash, 3.6-flash, 3.7-flash, 3.8-flash, 3.0-flash, 2.5-flash-lite, 2.5-flash` — README hilang `2.5-flash-lite` dan urutannya salah. **Sisi baiknya:** daftar ini kini cuma ada di satu tempat (`shared/gemini.ts`), dipakai `server.ts` *dan* `worker.ts`, jadi tidak ada lagi risiko dua daftar berbeda diam-diam — cuma README yang belum di-refresh. |
| D3 | "service worker stub `public/sw.js`" | Tidak ada `sw.js`; service worker dibuat `vite-plugin-pwa`. |
| D4 | Pintasan manifest "Catat Pengeluaran" → `/?action=record` | `App.tsx` hanya membaca `?tab=`; `action=record` tidak berefek (spec `PWA-10` hanya mencakup pintasan Riwayat/Ringkasan). |
| D5 | `.env.example` memuat `VITE_FIREBASE_*` | Tidak dipakai; konfigurasi Firebase dibaca dari `firebase-applet-config.json`. |
| D6 | README: "Deployment: Currently disabled" & `fix.ts` di root | Deployment sekarang **aktif** lewat Cloudflare Worker (lihat D7). `fix.ts` tetap skrip sekali pakai lama (mengubah kelas warna di `src/`), bukan bagian app — sebaiknya jangan dijalankan/di-test. |
| D7 | Deploy target | `npm run deploy` sekarang men-deploy `worker.ts` sebagai **Cloudflare Worker** (`wrangler.jsonc`). Folder `functions/api/*.ts` (Cloudflare **Pages** Functions — beda produk) masih ada di repo tapi README bilang eksplisit itu **tidak dipakai** untuk deploy Worker. Kode mati yang bisa membingungkan — pertimbangkan dihapus. |
| D8 | `package.json` dependencies: `@google/genai` | `shared/gemini.ts` sudah tidak pakai SDK ini — panggil Gemini lewat `fetch` REST langsung (`v1beta/models/{model}:generateContent`). Kemungkinan dependency sudah tidak terpakai. |
| D9 | Dua runtime backend hidup: `server.ts` (Express, `npm run dev`) dan `worker.ts` (Cloudflare Worker, deployed). Keduanya impor logika yang identik dari `shared/gemini.ts`, tapi **bukan** identik di sekeliling itu: limit payload Express (`express.json({limit:"50mb"})`) vs limit body Cloudflare Workers (beda platform, tidak dikonfigurasi eksplisit di kode), dan header cache HTML (`server.ts` set eksplisit `no-store`; static asset serving Worker lewat `env.ASSETS.fetch()` belum diverifikasi). | Lihat `Qicau.md` §10 catatan lingkungan dan keputusan #5 di bawah. |

## Perilaku yang patut dipertanyakan (kandidat bug)

| # | Perilaku | Dampak | Spec terkait |
|---|---|---|---|
| B1 | Tombol Sync/Reset hanya tampil bila **daftar terfilter** tidak kosong. Filter default = 7 hari → pengguna dengan data lama tapi tanpa data 7 hari terakhir tidak bisa Sync. | Fitur tersembunyi | HIST-02 |
| B2 | Filter kategori dilakukan di klien **setelah** paginasi 30 baris. Halaman bisa berisi <30 baris (atau kosong) sementara masih ada data lebih lama. Indikator `n / total` juga hanya estimasi. | Paginasi tampak rusak | HIST-06, HIST-08 |
| B3 | Hasil AI `medium` dengan `harga = 0` tetap **disimpan** (hanya `low` yang ditolak). | Transaksi Rp 0 sampah | VOICE-08, PARSE-54 |
| B4 | Server hanya memeriksa `textInput` *truthy*; teks spasi saja lolos ke AI (klien memang men-trim). Tidak ada batas panjang di server; klien membatasi 500. | Penyalahgunaan API | API-02 |
| B5 | Endpoint AI tidak memerlukan autentikasi/rate-limit → siapa pun yang tahu URL bisa memakai kuota Gemini. | Biaya/kuota | API-* |
| B6 | Aturan Firestore tidak memvalidasi isi dokumen (harga, kategori, tipe). Batas 999.999.999 & daftar kategori hanya di klien. | Data kotor lewat SDK langsung | SEC-* |
| B7 | Ekspor Sheets mengelompokkan bulan/tahun memakai zona waktu **perangkat**, tetapi menulis jam dengan `Asia/Jakarta` (WIB). Transaksi dekat tengah malam/pergantian bulan bisa masuk tab bulan yang berbeda dari tanggal yang tertulis. | Tab bulan salah | SYNC-05..06 |
| B8 | Gagal menghapus di Riwayat hanya `console.error` (tanpa pesan ke pengguna); gagal simpan/undo/edit di Home memakai `alert`. | UX tidak konsisten | HIST-11 |
| B9 | Kunci ekspor "Kategori"/"Metode" (validasi data & format bersyarat Sheets) dibangun dari **semua** transaksi, bukan per bulan. | Kosmetik | SYNC-07 |
| B10 | `Reset Ekspor` + Sync ulang pada file yang sudah ada **menambah baris ganda** (yang dicegah hanya flag `is_exported`, bukan isi sheet). | Duplikat di Sheets | SYNC-15/16 |
| B11 | Log low-confidence untuk input teks menyimpan `input_text` **sebelum** trim/potong (teks mentah dari state). | Minor | LOWC-04 |

## Pertanyaan keputusan

1. B10 — apakah "Reset Ekspor" memang dimaksudkan menimpa/menambah? Kalau ingin idempoten penuh, spec `SYNC-16` perlu diperjelas.
2. B3 — apakah `medium` dengan harga 0 harus diperlakukan seperti `low`?
3. D1 — CSV: hapus dari README, atau implementasikan (lalu tambahkan ke spec)?
4. ~~Lingkungan test: siap memakai Firebase Emulator?~~ **SELESAI (2026-09-27):** Firebase Local Emulator
   Suite sudah terpasang di root repo — `firebase.json` + `.firebaserc` (project id palsu `demo-qicau-test`,
   port Auth `9099` / Firestore `8080` / UI `4000`, rules dibaca langsung dari `firestore.rules` asli, jadi
   tidak pernah basi), `npm run emulators` untuk menjalankannya, dan flag `VITE_USE_FIREBASE_EMULATOR=true`
   di `.env` yang bikin `src/lib/firebase.ts` menyambung ke emulator alih-alih project asli. Sudah diuji
   coba booting dengan sukses. `signInWithPopup` tetap jalan di emulator (pakai layar pilih-akun palsu
   bawaan emulator, bukan Google sungguhan).
5. **BARU:** L1/L4 harus menguji lawan **server Express lokal** atau **Worker Cloudflare yang di-deploy**?
   Keduanya menjalankan kode Gemini yang sama (`shared/gemini.ts`), tapi beda di limit payload & header
   cache (lihat D9) dan environment: Worker tidak punya mode dev Vite (jadi tidak ada gangguan HMR websocket
   seperti yang ditemukan saat menguji auto-fallback port lokal). Kalau targetnya production real, L4 juga
   perlu tahu project itu **tidak** memakai emulator (Auth/Firestore asli) — jangan jalankan test yang
   menulis data di sana tanpa akun uji yang jelas terpisah.
