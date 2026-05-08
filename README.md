# QR Cafe Order System

Aplikasi web self-service ordering untuk kafe dengan alur pelanggan, dapur, dan kasir yang tersinkronisasi secara real-time.

## Fitur
- Mapping meja via token QR unik.
- Menu digital interaktif untuk pelanggan di ponsel.
- Ringkasan pesanan transparan dengan total otomatis.
- Dashboard dapur untuk antrean pesanan berurutan.
- Dashboard kasir untuk sinkronisasi pesanan tanpa input manual.
- Simulasi real-time menggunakan `BroadcastChannel` dan `localStorage`.

## Cara Pakai
1. Buka `index.html` di browser.
2. Masukkan token QR, misalnya `T01-7F3A`.
3. Pilih menu dan jumlah.
4. Kirim pesanan.
5. Pindah ke tab dapur atau kasir untuk melihat sinkronisasi data.

## Arsitektur Logika
- **Meja**: setiap meja punya `qrToken` unik.
- **Pesanan**: sistem membuat order code otomatis dan menghitung subtotal, pajak, dan total.
- **Dapur**: menerima antrean order berdasarkan status.
- **Kasir**: melihat pesanan yang sama tanpa input ulang.

## Catatan Teknis
- Karena environment ini tidak menyediakan Node.js, proyek dibuat sebagai web statis yang bisa dijalankan langsung di browser.
- Jika ingin dikembangkan menjadi stack penuh, proyek ini siap dipindahkan ke Next.js atau backend Express/NestJS.
