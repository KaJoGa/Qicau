# Qicau — Testing Project

Test dibuat **buta**: penulis test hanya boleh membaca [Qicau.md](Qicau.md) (fitur + input/output), bukan kode sumber.
Kalau perilaku app menyimpang dari spec, itu temuan (bug atau spec perlu diperbarui) — bukan alasan menyesuaikan test.

## Isi folder

| File | Untuk siapa | Isi |
|---|---|---|
| `Qicau.md` | Penulis test (buta) | Spesifikasi fitur ber-ID (`AUTH-01`, `HIST-08`, …): aksi → ekspektasi. |
| `README.md` | Semua | Strategi & aturan main (file ini). |
| `OPEN_ISSUES.md` | Pemilik proyek (**jangan** dibaca penulis test buta) | Selisih spec vs implementasi & pertanyaan yang perlu diputuskan. |

## Lapisan test (rencana)

| Lapisan | Cakupan ID | Cara | Catatan |
|---|---|---|---|
| L1 Kontrak API | `API-*` | HTTP ke `server.ts` (`npm run dev`, atau `PORT=<n>` untuk instance terisolasi), Gemini di-mock di level `fetch` (lihat `shared/gemini.ts`) | Deterministik, cepat. Pilih dulu apakah target-nya server Express lokal atau Worker Cloudflare — lihat `OPEN_ISSUES.md` keputusan #5. |
| L2 Kualitas parsing | `PARSE-*` | Gemini asli, ~20–30 kalimat | Non-deterministik → nilai ulang beberapa kali; kunci hanya field wajib (harga, kategori, bayar, confidence). Jalankan manual/nightly, bukan tiap commit. |
| L3 Aturan Firestore | `SEC-*` | Firebase Local Emulator Suite + `@firebase/rules-unit-testing` — `npm run emulators` (project id `demo-qicau-test`, lihat `firebase.json`/`.firebaserc` di root) | **Jangan** pakai project Firebase produksi — sudah tidak perlu, emulator jalan 100% offline tanpa login/billing. |
| L4 UI end-to-end | `AUTH NAV HOME VOICE SAVE LOWC MAN HIST MON PWA TOAST` | Browser otomatis, app dijalankan dengan `VITE_USE_FIREBASE_EMULATOR=true npm run dev` + `npm run emulators` di terminal lain, mikrofon palsu + API AI di-mock | `signInWithPopup` tetap berfungsi lewat layar pilih-akun palsu bawaan Auth Emulator. |
| L5 Sinkron Sheets | `SYNC-*` | Mock endpoint Drive/Sheets, cek isi request | Verifikasi nyata (Google) dilakukan manual satu kali per rilis. |

## Aturan

1. Setiap test menyebut ID spec yang diuji (mis. nama/komentar `HIST-08`).
2. Satu ID boleh punya banyak test; satu test sebaiknya menguji satu ID.
3. Jangan pernah menjalankan test terhadap akun/data pengguna sungguhan.
4. Kunci Gemini nyata hanya dipakai di L2; letakkan di `.env` (tidak di-commit).
5. Ubah perilaku app → ubah `Qicau.md` dulu, baru test.

## Status

- [x] Spesifikasi fitur (`Qicau.md`)
- [x] Firebase Local Emulator Suite terpasang & terverifikasi boot (`firebase.json`, `.firebaserc`, flag `VITE_USE_FIREBASE_EMULATOR`)
- [x] `server.ts` tidak lagi hard-code port 3000 (baca `PORT` env, auto-fallback kalau dipakai) — memudahkan L1 jalan di instance terpisah
- [x] `shared/gemini.ts`: `MODELS_TO_TRY` sudah di-`export`, dan panggilan ke Gemini lewat `fetch` biasa (bukan SDK) — memudahkan mock di level `fetch` untuk L1
- [ ] Pilih tool & pasang dependensi test (belum ada — `package.json` belum memuat test runner)
- [ ] Putuskan target L1/L4: server Express lokal vs Worker Cloudflare (`OPEN_ISSUES.md` keputusan #5)
- [ ] L1 → L3 → L2 → L5 → L4 (urutan disarankan: paling murah & deterministik dulu)
