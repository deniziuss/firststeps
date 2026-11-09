# FirstSteps

[English](README.md) | **Türkçe**

Uluslararası öğrenciler için kişiselleştirilmiş bir uyum ve yerleşme platformu.

FirstSteps, uluslararası bir öğrencinin varış sürecini kişisel ve sıralı bir plana dönüştürür. Plan, öğrenciyi hangi görevlerin kapsadığını, önce neyin yapılması gerektiğini ve resmî bilginin nerede olduğunu gösterir; öğrenci takıldığında kimden yardım alacağını da söyler. İlk pilot kapsam, Letonya'nın Liepāja şehrine gelen Erasmus ve uluslararası öğrencilerdir.

> **Durum:** alfa (v0.0.1 incelemede). Microsoft SQL Server üzerinde yerel olarak geliştirildi ve test edildi. Bir öğrenci projesidir ve yayında değildir. Herhangi bir üniversiteyle bağlantılı değildir, onların onayını da taşımaz. İçindeki yönlendirmeler bilgilendirme amaçlıdır, hukuki tavsiye değildir.

## Problem

Yurt dışına taşınan öğrenciler konaklama, üniversite kaydı, oturum işlemleri, ulaşım, sağlık sigortası ve günlük yaşamla ilgili bilgileri birbirinden kopuk pek çok kaynaktan toplar. Hangi adımların kendi durumları için geçerli olduğu, bunların hangi sırayla yapılması gerektiği, bilginin hâlâ güncel olup olmadığı ve bir şey ters gittiğinde nereye sorulacağı çoğu zaman belirsizdir.

## Özellikler

Aşağıdakilerin hepsi uygulanmış ve testlerle kapsanmıştır (bkz. [docs/testing.md](docs/testing.md)):

- **Hesaplar ve roller:**
  - Öğrenci kendi kaydını oluşturur; giriş ve çıkış yapılır.
  - Öğrenci, Mentor ve Yönetici rolleri vardır; profil ve şifre değiştirilebilir.
  - Şifreler argon2id ile hash'lenir.
  - Her sayfa ve server action, rolü ve sahipliği sunucuda kontrol eder.
- **Akıllı yolculuk oluşturucu:**
  - Öğrenci üniversite, varış tarihi, program ve konaklama bilgisiyle bir yolculuk oluşturur.
  - Ona uyan görev şablonları kişisel görevlere dönüşür.
  - Görevler Varıştan önce, İlk günler, İlk hafta ve Yerleşme aşamalarında gruplanır.
- **Görev bağımlılık motoru:**
  - Görevler başka görevlere bağlı olabilir; kilitli görevler neyi beklediklerini açıklar.
  - Bağlı bir görev tamamlanmışken, ön koşulu olan görev yeniden açılamaz.
  - Yöneticiler döngüsel bağımlılık oluşturamaz.
  - Öğrenciyi kapsamayan bir ön koşul (başka program veya konaklama durumu ya da plan değişikliğinden sonra *Gerekmiyor*) görevi kilitlemez; veritabanı trigger'ı ve uygulama aynı kuralı izler.
  - Yolculuk oluşturulduktan sonra eklenen bir ön koşul, *Planımı güncelle* ile plana eklenir.
- **Plan güncellemeleri:** Konaklama durumu değişince yolculuk yeniden planlanır:
  - yeni görevler eklenir,
  - artık geçerli olmayan görevler *Gerekmiyor* olarak işaretlenir,
  - tamamlanmış işler asla kaybolmaz.
- **Doğrulanmış bilgi:** Görevler resmî kaynaklara bağlanır. Her kaynak inceleme durumunu (*Doğrulandı*, *Henüz incelenmedi*, *Güncel değil*) ve son kontrol tarihini gösterir.
- **Takıldım / Mentor desteği:**
  - Öğrenci bir görev üzerinden yardım talebi açar.
  - Yönetici talebi bir mentora atar.
  - Mentor yalnızca kendisine atanan talepleri görür ve eşzamansız yanıt verir.
- **Şehir rehberi:** Pratik görev içerikleri ve kaynaklarından oluşturulan şehir ve üniversite rehberi.
- **Paneller ve raporlar:**
  - aşamalara göre öğrenci ilerlemesi,
  - yazdırılabilir ilerleme raporu,
  - mentor talep listesi,
  - anonim toplu grafikler içeren yönetici özeti.
- **Yönetici paneli:** Şunlar buradan yönetilir:
  - üniversiteler ve görev şablonları,
  - bağımlılıklar (döngü ve kapsam kontrolleriyle),
  - kaynak incelemesi,
  - yardım talebi ataması,
  - kullanıcı rolleri.
- **İngilizce ve Türkçe:**
  - Arayüzün tamamı, doğrulama mesajları ve tarihler iki dilde kullanılabilir.
  - Dil seçici, girişten önce ve sonra üst menüde bulunur; seçim bir çerezde saklanır.
  - Veritabanındaki görev ve kaynak metinleri çevrilmiştir. Çeviri yoksa İngilizce metin bir uyarıyla gösterilir.
- **Editoryal tasarım ve hareket:**
  - Editoryal bir açılış sayfası: yüzen menü, örnek verili ürün önizlemesi, kaydırmayla anlatım, etkileşimli bağımlılık demosu ve mentor akışı.
  - Aynı görsel dil öğrenci, mentor ve yönetici ekranlarında da kullanılır.
  - Hareketler GSAP ile yapılır; Lenis yumuşak kaydırması yalnızca açılış sayfasındadır; iki React Bits bileşeni uyarlanmıştır.
  - "Hareketi azalt" ayarına uyulur ve hiçbir içerik animasyona bağlı değildir. Ayrıntılar: [docs/design-system.md](docs/design-system.md).
- **Güvenlik incelemesi:** Çıkışta oturum iptal edilir, şifre değişince diğer oturumlar kapanır, içerik güvenlik politikası (CSP) ve güvenlik başlıkları gönderilir, kayıtlı bağlantılar yalnızca http(s) olabilir. Bulgular, testler ve hazırlık değerlendirmesi: [docs/security.md](docs/security.md).
- **Hesap güvenliği:**
  - E-posta doğrulama ve tek kullanımlık bağlantıyla şifre sıfırlama.
  - SQL Server'da kalıcı deneme sınırları ve değiştirilemeyen yönetici denetim kaydı.
  - Sağlık ve hazırlık uç noktaları, yapılandırılmış loglar, doğrulanmış yedekler ve geri yükleme testleri.
  - Ayrıntılar: [docs/email.md](docs/email.md), [docs/operations.md](docs/operations.md).
  - Tablolar proposal 0006'da; ayrı bir test kopyasında denendi, geliştirme veritabanına uygulanması onay bekliyor.
- **İşletim ve gizlilik:**
  - TLS ve yeniden denemeli SMTP gönderimi (bir sağlayıcıya bağlı değil).
  - Metrikler ve yerel sağlık/alarm kontrolü.
  - Şemayı karşılaştıran geri yükleme testleriyle doğrulanmış yedekler ve sınırlı veritabanı bakımı.
  - Ayarlar'da kişisel veri dışa aktarımı ve denetim kaydı bırakan bir anonimleştirme betiği.
  - Hazırlandı, yayına alınmadı: ters vekil (reverse proxy) yapılandırmaları ve zamanlanmış görevler.
  - Ayrıntılar: [docs/operations.md](docs/operations.md), [docs/privacy.md](docs/privacy.md).
- **Arayüz:**
  - Doğal bir renk paleti: koyu orman yeşili, orman yeşili, sıcak fildişi, okr altını, sıcak boz.
  - Açık ve koyu tema.
  - 360 px'ten başlayan duyarlı düzen.
  - Boş, yükleniyor ve hata durumları açıkça gösterilir.
  - Klavyeyle kullanım ve "ana içeriğe geç" bağlantısı.
  - Otomatik WCAG 2.2 AA kontrolleri (axe-core), herkese açık, öğrenci, mentor ve yönetici ekranlarında, iki dilde ve iki temada başarılıdır.

## Teknolojiler

| Alan | Teknoloji |
|---|---|
| Web uygulaması | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| Arayüz | Tailwind CSS 4, shadcn/ui (Radix), lucide-react, Recharts, Inter Tight, Inter ve Geist Mono yazı tipleri |
| Hareket | GSAP 3 (ScrollTrigger, SplitText) ve `@gsap/react`, Lenis, uyarlanmış React Bits bileşenleri ([bildirimler](THIRD_PARTY_NOTICES.md)) |
| Diller | İngilizce ve Türkçe: projeye ait tipli sözlükler, `Intl` biçimlendirme, Next.js proxy ile dil yönlendirmesi |
| Doğrulama | Zod |
| Veritabanı | Microsoft SQL Server (SQL Server 2022 Express üzerinde geliştirildi), `mssql` sürücüsü |
| Kimlik doğrulama | argon2id (`@node-rs/argon2`), imzalı ve HTTP-only oturum çerezi (`jose`) |
| Testler | Vitest (birim), Playwright (uçtan uca), axe-core (erişilebilirlik), SQL doğrulama betiği |

## Mimari

Tek bir Next.js uygulaması (modüler monolit):

```
Tarayıcı
  │
Next.js App Router — server component'ler ve server action'lar
  │   src/server/dal.ts       oturum → mevcut kullanıcı, rol ve sahiplik kontrolleri
  │   src/lib/validation.ts   girdi doğrulama (Zod)
  ├── src/domain/             saf iş kuralları: görev seçimi, ön koşullar, döngüler, yeniden planlama, ilerleme
  └── src/server/repositories parametreli SQL ve stored procedure çağrıları
        │
Microsoft SQL Server — 8 tablo, PK/FK/UNIQUE/CHECK kısıtları, 3 trigger, 5 stored procedure,
                       ek olarak 2 çeviri tablosu (migration 0002)
```

Uygulama, net mesajlar verebilmek için kuralları önce kendisi kontrol eder; veritabanı da aynı kuralları kısıtlar ve trigger'larla bir kez daha uygular. Ayrıntılar ve tasarım kararları: [docs/architecture.md](docs/architecture.md).

## Yerel geliştirme

### Gereksinimler

- Node.js 24 ve npm
- Microsoft SQL Server 2016 SP1 veya daha yenisi (SQL Server 2022 Express uygundur):
  - `127.0.0.1:1433` üzerinde TCP/IP açık olmalı.
  - SQL Server ve Windows kimlik doğrulaması (karma mod) açık olmalı.
  - Windows hesabın bu instance'ta sysadmin olmalı. SQL Server'ı kuran hesap için bu varsayılan durumdur.
- [sqlcmd](https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility) (go-sqlcmd)

Windows'ta `database/local/configure-sqlexpress.ps1` betiği (yönetici olarak çalıştırılır) bir `SQLEXPRESS` instance'ı için karma modu ve yalnızca yerel adrese açık 1433 TCP portunu etkinleştirir.

### Kurulum

Alfa sürümü `feat/alpha-0.0.1-ui-i18n` branch'indedir:

```bash
git clone -b feat/alpha-0.0.1-ui-i18n https://github.com/deniziuss/firststeps.git
cd firststeps
npm install
npm run db:local:setup
npm run db:seed-users
npm run dev
```

- `db:local:setup` şunları yapar:
  - `FirstSteps_Dev` veritabanını (`AUTO_CLOSE` kapalı) ve en az yetkili uygulama kullanıcısını oluşturur.
  - `database/migrations/` içindeki her dosyayı uygular; hepsi tekrar çalıştırılabilir.
  - Sentetik pilot içeriği ve Türkçe çevirilerini yükler.
  - Instance'ın minimum belleğini ayarlar (`database/local/05_server_settings.sql`).
  - Doğrulama betiğini çalıştırır.
  - Rastgele üretilmiş gizli değerlerle `.env.local` dosyasını oluşturur.
  - Hiçbir zaman veri silmez.
- `db:seed-users` bir sentetik yönetici ve bir sentetik mentor hesabı oluşturur; şifreleri yalnızca `.env.local` dosyasına yazılır.
- http://localhost:3000 adresini aç ve bir öğrenci hesabı oluştur.

### Ortam değişkenleri

Bkz. [`.env.example`](.env.example). `DB_SERVER` yerel bir adres ve `DB_NAME` değeri `FirstSteps_Dev` değilse uygulama veritabanına bağlanmayı reddeder. `.env.local` dosyasını asla commit etme.

| Değişken | Amaç |
|---|---|
| `DB_SERVER`, `DB_PORT`, `DB_NAME` | Yerel SQL Server adresi ve veritabanı |
| `DB_USER`, `DB_PASSWORD` | Uygulama kullanıcısı (DDL yetkisi yok) |
| `DB_ENCRYPT`, `DB_TRUST_SERVER_CERT` | Yerel sunucu için TLS ayarları |
| `SESSION_SECRET` | Oturum çerezlerini imzalar (32+ rastgele karakter) |
| `TRUST_PROXY` | `X-Forwarded-For` başlığı hız sınırlaması için yalnızca güvenilir bir proxy arkasında kullanılır |

## Testler

| Komut | Ne çalıştırır |
|---|---|
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Birim testleri: iş kuralları ve çeviri sözlükleri (aynı anahtarlar, yer tutucular, kodda kullanılan her anahtarın var olması) |
| `npm run build` | Production build |
| `npm run test:e2e` | Yerel production build'e karşı Playwright uçtan uca testleri. Kapsam: İngilizce ve Türkçe öğrenci, mentor ve yönetici akışları, dil değiştirme, erişilebilirlik. Yerel veritabanı, tohum kullanıcılar ve Microsoft Edge gerekir. Çalıştırma sonunda kendi oluşturduğu sentetik kayıtları siler; saklamak için `E2E_KEEP_DATA=1` kullan |
| `npm run db:local:setup` | `database/local/04_verify.sql` dosyasını da çalıştırır: nesne sayıları ve trigger/procedure davranışı; değişiklikler geri alınır |
| `npm run test:db` | Ön koşul kuralı eşleşmesi: aynı durumlar hem SQL trigger'ında (yerel `FirstSteps_Dev`, geri alınır) hem TypeScript motorunda denenir |
| `npm run db:cleanup-test-data` | `FirstSteps_Dev` içindeki sentetik test kayıtlarını yalnızca listeler (deneme çalıştırması). `-- --apply` bunları siler, `-- --self-test` güvenlik kurallarını kontrol eder. Yalnızca `@example.invalid` adresli `e2e+`/`sweep+`… öğrenciler ve pasif `E2E …` şablonları eşleşir |

GitHub Actions her push ve pull request'te kurulum, typecheck, lint, birim testleri ve production build adımlarını çalıştırır. Veritabanına bağlı testler ve uçtan uca testler şimdilik yalnızca yerelde çalışır.

## Proje yapısı

```
database/migrations/   şema migration'ları (0001: tablolar, indeksler, trigger'lar, procedure'ler; 0002: içerik çevirileri)
database/proposals/    karar bekleyen şema değişiklikleri (kurulum tarafından uygulanmaz)
database/local/        yerel kurulum: veritabanı ve kullanıcı, sentetik içerik, doğrulama, SQL Express yapılandırması
scripts/db/            kurulum, bağlantı kontrolü, şema anlık görüntüsü, sentetik kullanıcılar, test verisi temizliği
src/app/[locale]/      sayfalar: (auth) giriş/kayıt, (app) öğrenci, mentor ve yönetici ekranları
src/i18n/              dil ayarları, İngilizce ve Türkçe sözlükler, çevirici ve biçimlendiriciler
src/proxy.ts           temiz URL'leri çerezdeki dile yönlendirir
src/components/        arayüz bileşenleri (landing/, motion/, reactbits/, ui/)
src/domain/            iş kuralları (birim testli)
src/server/            ortam, veritabanı erişimi, oturum, yetkilendirme, repository'ler, server action'lar
tests/unit, tests/e2e  Vitest ve Playwright testleri
docs/                  mimari, veritabanı, tasarım sistemi, testler, ilerleme, ekran görüntüleri
```

## Mevcut durum ve yol haritası

Yukarıda listelenen tüm modüller uygulanmış ve yerelde test edilmiştir. Güncel durum ve açık konular: [docs/progress.md](docs/progress.md). Ayrıntılı teknik belgeler İngilizcedir.

Bilinen açık konular:

- Görev ve kaynak metinleri sentetik taslaklardır; tüm kaynaklar hâlâ *Henüz incelenmedi* durumundadır.

Planlanan ancak henüz uygulanmayanlar:

- E-posta doğrulama ve şifre sıfırlama
- Yönetici değişiklikleri için denetim kaydı
- İngilizce ve Türkçe dışında diller
- Yeni şehirler, üniversiteler ve ülkeler
- Öğrenciler ve mentorlar arasında gerçek zamanlı sohbet
- Takvim ve bütçe planlama
- CI'da izole bir SQL Server container'ı ile veritabanı entegrasyon testleri
- Yayına alma (deployment)

## Lisans

Henüz bir lisans seçilmedi; bir lisans eklenene kadar tüm hakları yazara aittir.
