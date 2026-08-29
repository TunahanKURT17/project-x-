# Vakit — canlı HTTPS dağıtım

Bu proje Render/Docker tabanlı bir Node.js web servisi olarak yayına hazırdır.

## Gerekli secret'lar
- DIYANET_EMAIL
- DIYANET_PASSWORD

Bunları Git'e veya frontend'e koyma.

## Render
1. Bu klasörü bir GitHub repository'sine yükle.
2. Render > New > Blueprint ile `render.yaml` seç.
3. `DIYANET_EMAIL` ve `DIYANET_PASSWORD` secret değerlerini gir.
4. Deploy.
5. Render sana `https://...onrender.com` adresi verir.
6. İstersen kendi domainini Render'daki Custom Domains bölümünden bağla.

## Kontrol
`/api/health` 200 dönmeli.

## Önemli
Diyanet API hesabı olmadan gerçek Diyanet verisi alınamaz. Diyanet kullanıcı bilgileri yalnızca backend environment variable olarak tutulmalıdır.
