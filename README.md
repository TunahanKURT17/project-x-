# Vakit — Gerçek Web Uygulaması

Bu sürüm frontend + Node.js backend olarak çalışır.

## 1. Gereksinim
Node.js 18+.

## 2. Diyanet API hesabı
Diyanet Awqat Salah API kullanıcı adı/şifresi gerekir. Bunları `.env` veya ortam değişkeni olarak sunucuda tutun. Tarayıcıya koymayın.

Windows PowerShell:
$env:DIYANET_EMAIL="..."
$env:DIYANET_PASSWORD="..."
node server.js

Windows CMD:
set DIYANET_EMAIL=...
set DIYANET_PASSWORD=...
node server.js

Sonra Chrome'da http://localhost:3000 açın.

## 3. Akış
GPS -> Nominatim reverse geocode -> Diyanet States/Cities eşleştirme -> Diyanet CityDetail -> Daily prayer times -> cache -> web UI.

## 4. Üretim
HTTPS kullanın. Reverse geocoder için uygun kullanım politikasına ve User-Agent/contact gerekliliklerine uyun. Diyanet API istek limitleri nedeniyle backend cache'ini koruyun.
