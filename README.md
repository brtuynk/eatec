# EATEC Construction: site + yönetim paneli

Tek uygulama: herkese açık site (İngilizce `/` ve Macarca `/hu/`) ve `/admin` altında yönetim paneli.
Eski Django API'ye artık ihtiyaç yok, tüm içerik bu uygulamanın kendi veritabanında.

## Yerelde çalıştırma

```bash
npm install
ADMIN_EMAIL=siz@ornek.com ADMIN_PASSWORD='uzun-bir-sifre' npm start
```

- Site: http://localhost:3000
- Panel: http://localhost:3000/admin

İlk açılışta veritabanı boşsa `seed/` klasöründeki (eski siteden aktarılmış) içerik ve fotoğraflarla dolar.
`ADMIN_PASSWORD` verilmezse rastgele bir şifre üretilir ve konsola bir kez yazılır.
Şifreyi panelde **Account** sayfasından değiştirebilirsiniz.

## Panelde neler yönetilir

| Bölüm | Ne yapar |
|---|---|
| Site texts | Ana ekran başlığı/metni/fotoğrafı, bölüm başlıkları, kurumsal metin, iletişim bilgileri, sosyal medya, SEO başlığı. Her metnin İngilizce ve Macarca kutusu var. Boş bırakılan kutu hazır metni kullanır (gri yazı). |
| Projects | Proje ekle/düzenle/sil/sırala. Ülke süzgeçleri ve "N ülke, N proje" sayıları otomatik hesaplanır. |
| Applications | "What we build" kartları. |
| Client logos | "Trusted by" logoları. Koyu logo, beyaz ya da saydam zeminli yüklenir; sistem koyu siteye uygun beyaz hale getirir. |
| Policies | Politika sekmeleri. |
| Messages | İletişim formundan gelen mesajlar. |

Kaydettiğiniz anda sitede görünür, yeniden yayınlamak gerekmez.

**Fotoğraflar:** JPG/PNG/WebP yükleyin. Sistem otomatik olarak WebP'ye çevirir ve 480/960/1600 px varyantlar üretir
(orijinalden büyütmez). Ana ekran ve proje fotoğrafları için en az 1600 px genişlik önerilir.

## Yayına alma (Docker)

```bash
cp .env.example .env      # düzenleyin: SITE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, isteğe bağlı SMTP
docker compose up -d --build
```

- Uygulama 3000 portunda dinler. Önüne TLS sonlandıran bir reverse proxy / ingress koyun.
- **`./data` klasörü kalıcı olmalı** (veritabanı `site.db`, yüklenen fotoğraflar `uploads/`, oturum anahtarı).
  Yedek almak için bu klasörü kopyalamak yeterli.
- Kubernetes'te `/data` için bir PersistentVolume bağlayın. Sağlık kontrolü: `GET /healthz`.
- Tek kopya (replica 1) çalıştırın, veritabanı bir SQLite dosyasıdır.

Ortam değişkenleri: `PORT`, `DATA_DIR`, `SITE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (yalnızca ilk kurulumda kullanıcı oluşturur),
`SESSION_SECRET` (verilmezse `data/session.key` üretilir), `SMTP_*`, `CONTACT_TO`, `TRUST_PROXY`.

## Formdan gelen mesajlar

Her mesaj panelde **Messages** altına kaydedilir. E-posta ile de almak için `SMTP_*` değişkenlerini ve
`CONTACT_TO` (ya da panelde Site texts > "Send form messages to") ayarlayın.
Formda bot koruması (gizli alan) ve IP başına hız sınırı (10 dakikada 5 mesaj) vardır.

## Eski API'den geçiş

`tools/migrate-from-api.mjs` eski API'den içeriği ve fotoğrafları `seed/` klasörüne aktarmıştı (bir kez çalıştırıldı).
`seed/` klasörünü saklayın (boş bir veritabanını yeniden doldurur). Yeni site yayına girince eski `api.eatecconstruction.com` kapatılabilir.

## Güvenlik notları

- Panel şifreleri scrypt ile saklanır, oturumlar imzalı çerezdir, tüm panel formlarında CSRF koruması vardır.
- Panel girişinde deneme sınırı vardır (15 dakikada 10).
- Site dışarıdan hiçbir kaynak yüklemez (fontlar ve ikonlar kendi sunucusundan gelir), sıkı bir Content-Security-Policy uygulanır.
- `/admin` arama motorlarından gizlidir (`robots.txt` ve `noindex`).
