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
