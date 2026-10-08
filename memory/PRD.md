# Swipedia — PRD

## Original Problem Statement
TikTok/Reels tarzı dikey kaydırmalı bir öğrenme uygulaması: kullanıcılar çoktan seçmeli soruları (genel kültür, matematik, coğrafya vb.) kaydırarak keşfeder ve cevaplar. Kullanıcılar kendi sorularını oluşturup paylaşabilir (sosyal akış). Cevaplama, kaydetme, yorum yapma ve soruları uygulama içi mesajlaşma ile arkadaşlara gönderme. Puan sistemi: her 25 doğru cevap = 1 puan. Rütbe sistemi: puanlara dayalı olacak (rütbe isimleri/eşikleri kullanıcı tarafından sonra verilecek). Auth: Google + E-posta/Şifre + Misafir modu. Dil: Türkçe (arayüz ve tüm iletişim). Uygulama adı: Swipedia.

## Architecture
- **Frontend**: Expo (SDK 57) + expo-router, React Native. Route yapısı: `app/index.tsx` (yönlendirme), `app/login.tsx` (auth), `app/(tabs)/` (Keşfet, Oluştur, Mesaj, Profil), `app/chat/[id].tsx` (sohbet). Auth durumu `src/auth.tsx` (AuthProvider). Tema `src/theme.ts` (Tactile/Playful Light). API istemcisi `src/api.ts`. iOS 26+ için NativeTabs gate'i `src/navigation.ts`.
- **Backend**: FastAPI + MongoDB (Motor), `/api` prefix. Token tabanlı oturum (`user_sessions`).
- **Tasarım**: `/app/design_guidelines.json` — Tactile/Playful Light, mercan (#FF6B4A) ana renk.

## User Personas
- Meraklı öğrenci: kısa sürede eğlenceli bilgi tüketmek isteyen kullanıcı.
- İçerik üreticisi: kendi sorularını yazıp toplulukla paylaşan kullanıcı.
- Sosyal öğrenen: soruları arkadaşlarıyla paylaşıp tartışan kullanıcı.

## Core Requirements (static)
- TikTok tarzı tam ekran dikey kaydırmalı soru akışı
- Çoktan seçmeli (4 şık) sorular, anlık geri bildirim + açıklama
- 25 doğru = 1 puan; profilde puan ve ilerleme gösterimi
- Kullanıcı soru oluşturma (kategori, soru, 4 şık, doğru şık, açıklama)
- Kaydetme, yorum, arkadaşa mesajla soru gönderme
- Uygulama içi mesajlaşma (kişi listesi + sohbet ekranı)
- Auth: Google (Emergent-managed) + e-posta/şifre + misafir
- Türkçe arayüz, uygulama adı Swipedia

## Implemented (2026-10-01)
- Backend: auth (register/login/guest/Google session), feed, answer (25 doğru = 1 puan), save toggle, comments, question create, leaderboard, people, conversations/messages
- Frontend: tek dosyadan Expo Router yapısına geçiş; tam ekran paging FlatList ile TikTok tarzı Keşfet akışı; sağ aksiyon rayı (kaydet/yorum/paylaş); puan hapı header'da
- Soru oluşturma ekranı (kategori çipleri, 4 şık + doğru şık seçimi, açıklama)
- Mesaj gelen kutusu + sohbet ekranı; akıştan soruyu kişiye gönderme (share sheet)
- Profil: puan/doğru/kayıtlı istatistikleri, puan kartı (25'e ilerleme), liderlik tablosu, çıkış
- TikiLearn → Swipedia isim temizliği (kod + DB kayıtları)
- Alert'ler kaldırıldı, toast bildirimleri eklendi; react-native-keyboard-controller ile klavye deneyimi

## Implemented (2026-10-02) — Faz 2
- Başka kullanıcıların profili: Akışta sorunun sol altındaki yazar bloğuna dokununca `app/user/[id].tsx` açılır; sadece o kişinin paylaştığı sorular grid olarak gösterilir. "Kaydedilenler" sekmesi yalnızca kullanıcının kendi profilinde (`(tabs)/profile.tsx`). Backend: `GET /api/users/{user_id}/profile` (herkese açık, kullanıcı + paylaştığı sorular).

## Implemented (2026-10-03) — Rastgele akış ve temiz başlangıç
- `/api/feed`: yalnızca `is_published=true`, `is_active=true`, `is_hidden=false`, `is_deleted=false` soruları kullanıcı oturumunda tekrar etmeden rastgele seçer; kategori ve küçük batch desteği vardır.
- Akış, başlangıçta küçük bir batch yükler ve swipe sonuna yaklaşınca arka planda yeni batch ekler; tüm soru havuzunu frontend'e çekmez.
- 750 soru otomatik seedi kaldırıldı. Kontrollü `reset_clean_start.py` komutu tüm test verisini temizler ve yalnızca `.env` ile tanımlı gerçek admin hesabını bırakır.
- Doğrulama: random akışta 3 batch boyunca tekrar yok, Bilim kategori filtresi doğru, gizli/pasif kayıtlar dışarıda; temiz son veri durumu 1 admin / 0 normal kullanıcı / 0 soru / 0 oturum.

## Implemented (2026-10-03) — Dil sistemi
- Arayüz yalnızca `tr-TR` (Türkçe) ve `en-US` (American English) destekler. Eski kayıtlı `tr`/`en` tercihleri güvenle yeni kodlara taşınır; diğer tüm değerler iki dilden uygun olana düşer.
- Ayarlar ekranında yalnızca iki dil seçeneği vardır; tercih güvenli depolamada kalır. Rütbeler, yasal metinler, giriş/kayıt, Keşfet ve ayarlar iki dili destekler.
- Doğrulama: TR↔EN-US değişimi, uygulama yeniden açılışında kalıcılık, giriş/kayıt, boş Keşfet, yasal bağlantılar ve eksik metin kontrolü mobil testten geçti.

## Implemented (2026-10-03) — Swip arama içi keşfet
- Alt navigasyonun orta etiketi `Swip` oldu. Arama overlay'i artık sunucudan küçük rastgele batch ile yalnızca yayınlanmış aktif soruları görsel keşfet kartları olarak getirir.
- Görsel kartlar `contentFit="contain"` ile kaynaktaki oranı korur; metin yalnızca alt kısımda hafif gradient üzerinde görünür. Soru yoksa iki dilde keşfet boş durumu gösterilir.

## Implemented (2026-10-03) — Android release API yapılandırması
- `app.config.js`, release bundle içindeki `extra.backendUrl` değerini build ortamındaki `EXPO_PUBLIC_BACKEND_URL` üzerinden alır. `eas.json` içindeki `production-apk` profili production ortamını kullanır.
- Doğrulanan production API origin: `https://micro-genius-3.emergentapps.tr`; istemci mevcut biçimde yalnızca bir kez `/api` ekler. TLS, health, guest login ve admin login dış ağdan doğrulandı.
- Fiziksel APK üretimi bu çalışma ortamında komut engeli nedeniyle başlatılamadı; Publish sonrası platform build arayüzünden oluşturulup cihazda tekrar test edilmelidir.
- Release sertleştirmesi: `production-apk` profili `APP_VARIANT=production` ile çalışır; config üretim origin’i dışında bir `EXPO_PUBLIC_BACKEND_URL` görürse build'i durdurur. API istemcisi yalnızca gömülü config origin'ini kullanır; preview env fallback'i yoktur.
- AAB’de `micro-genius-3.emergent.host` görülmesi üzerine release config iki katmanda (`app.config.js` + `app.json.extra`) statik doğrulanmış origin’e sabitlendi: `https://micro-genius-3.emergentapps.tr`. API client `Constants.expoConfig.extra.backendUrl` üzerinden bu değeri alır ve `/api` tek kez ekler. Yeni AAB üretimi/asset kontrolü ortam build engeli nedeniyle hâlâ bekliyor.

## Implemented (2026-10-03) — Android görsel upload normalleştirmesi
- Profil fotoğrafı ve soru arka planı tek `pickCroppedImage` helper'ını kullanır. Android crop sonrası `content://` URI, ImageManipulator ile cache `file://` JPEG’e dönüştürülür; dosya varlığı/boyutu doğrulanır ve 5 MB backend sınırı için yeniden sıkıştırılır.
- Native multipart yükleme daima üretilmiş `.jpg` adı ve `image/jpeg` MIME ile yapılır; teknik ayrıntılar yalnızca development loglarındadır. Backend upload → avatar update → soru background → dosya okuma zinciri doğrulandı.
- Telefon preview geri bildirimi sonrası Android native upload, FormData yerine `expo-file-system/legacy` `uploadAsync(...MULTIPART)` kullanacak şekilde düzeltildi; bu, ImageManipulator cache URI'sini Android katmanında okur. Fiziksel cihazda yeniden test bekleniyor.

## Implemented (2026-10-03) — Guest demo yetkileri
- Guest hesapları feed/kategori okumayı sürdürür; profil değişikliği, görsel upload, soru oluşturma/yayınlama, cevap/beğeni/kayıt/yorum/takip/mesaj ve bildirim yazmaları backend `require_registered_user` guard ile 403 döner.
- Frontend `useRequireAccount` merkezi modalı Create ve Profile → Settings girişlerinde çalışır. Kayıt Ol/Giriş Yap guest oturumunu kapatıp ilgili login moduna taşır; normal ve admin hesaplar sınırlanmaz.

## Implemented (2026-10-04) — Keşfet soru açma
- Arama → Keşfet kartları dokunulabilir. Kartın gerçek `question_id` değeri ana feed'e aktarılır; seçilen soru mevcut swipe listesine ilk sırada eklenir, aynı kayıt tekrar etmez ve liste başa kayar. Sonraki swipe mevcut random akışla devam eder.

## Implemented (2026-10-04) — Kullanıcı adı araması ve paylaşım kapanışı
- Keşfet araması, yazılan kullanıcı adını `/api/users/search` üzerinden arar; sonuçlarda avatar ve `@kullanıcıadı` görünür, seçim ilgili herkese açık profile yönlendirir.
- Paylaşım sayfası kapatıldığında seçili soru durumu da temizlenir; böylece Yorumlar sayfası yanlışlıkla açılmaz.

## Implemented (2026-10-04) — Genişletilmiş soru kategorileri
- Mevcut sıralama korunarak Psikoloji, Mitoloji, Spor, Müzik, Sanat, Yemek / Mutfak, Kültürler, Felsefe, Hukuk & Toplum, Ekonomi ve Önemli İsimler eklendi.
- Tüm yeni kategoriler mevcut Ionicons eşlemelerini ve kategori seçim/gösterim akışını kullanır; veri modeli ve eski kategori değerleri değişmedi.

## Implemented (2026-10-04) — Top 10 liderlik tablosu
- Liderlik sorgusu puan ve doğru cevap sıralamasını koruyarak en fazla 10 kullanıcı döndürür; ekran da yalnızca ilk 10 kaydı gösterir.

## Implemented (2026-10-04) — Veri ekranlarında aşağı çekerek yenileme
- Mevcut `RefreshControl` yaklaşımıyla kendi profil (Paylaştıklarım/Kaydedilenler), başka kullanıcı profili, rütbeler/liderlik ve Arama/Keşfet güncel veriyi yeniden alır.
- Bildirimler (boş durum dahil) ve mesaj konuşma listesi aynı gerçek veri yenileme davranışını destekler; bağlantı hatasında görünür veriler korunur.

## Implemented (2026-10-04) — Sade alt navigasyon
- Swipe dahil tüm alt navigasyon etiketleri kaldırıldı; Swipe ikonu, metin varkenki dikey hizasında korunurken diğer sekme ikonları %15 büyütülerek dikey olarak ortalandı.
- Rütbeler sekmesindeki kupa, Ekonomi kategorisinden ayrışan podium/sıralama simgesiyle değiştirildi.

## Implemented (2026-10-04) — Dinamik yorum paneli
- Yorum paneli klavye kapalıyken ekranın %62’sini, açıkken %50’sini kaplar; yükseklik geçişi akıcı biçimde animasyonludur.
- Panel açılışında yorum alanı otomatik odaklanır; yorum listesi bağımsız kayar ve yazma alanı sabit görünür kalır.
- Android’de pencere yeniden boyutlanması kullanılır; böylece yorum modalında çift klavye kaçınması oluşmaz.

## Prioritized Backlog
- **P0**: Android production APK: gerçek production backend URL'sini build ortamına `EXPO_PUBLIC_BACKEND_URL` olarak tanımla, Atlas üretim bağlantısını doğrula ve APK'yı bu URL ile yeniden oluştur.
- **P0**: Rütbe sistemi UI'ı (kullanıcı rütbe isimlerini/eşiklerini verecek — bekleniyor)
- **P1**: Kaydedilen soruların profilde listelenmesi ("Kayıtlı" sekmesi)
- **P1**: Profilde "Sorularım" sekmesi (kullanıcının oluşturduğu sorular)
- **P1**: Sohbette paylaşılan sorunun kart olarak gösterilip akışta açılabilmesi
- **P2**: Soru beğenme (like) endpoint + aksiyon rayında kalp ikonu
- **P2**: Bildirimler, çevrimdışı destek, kategori bazlı akış filtreleme

## Test Credentials
`/app/memory/test_credentials.md` — swipedia-test@example.com / secret123; misafir modu giriş ekranından.

## Next Tasks
1. Kullanıcıdan rütbe isimlerini/eşiklerini alıp rütbe rozetini profile ve akışa eklemek
2. Profilde kayıtlı sorular + kendi sorularım sekmeleri
3. Sohbette soru kartı derin bağlantısı
