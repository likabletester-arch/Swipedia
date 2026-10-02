# Swipedia: Resmî Soru Kütüphanesi ve Admin Hesabı

Uygulamanın akışını, tek bir resmî "Swipedia" hesabından paylaşılan 300 elenmiş soruyla dolduran ve bu hesabı diğer kullanıcılardan ayıran doğrulanmış bir yönetici kimliğine dönüştüren güncelleme.
Mevcut tüm deneme soruları kaldırılır; yerine 15 kategoriye yayılmış, doğru cevapları gözden geçirilmiş gerçek sorular gelir.

## Kimler için
- Uygulamayı keşfeden son kullanıcılar: artık rastgele deneme sorular yerine düzgün, kategorilere ayrılmış gerçek sorularla karşılaşır.
- Uygulama sahibi: "Swipedia" adlı resmî/yönetici hesabı üzerinden tüm başlangıç içeriğini paylaşan, puan yarışına girmeyen ayrıcalıklı bir kimliğe sahip olur.

## Temel özellikler ve deneyim
- **300 resmî soru**: Belgedeki 15 kategorinin tamamı uygulamaya aktarılır (Genel Kültür, Bilim, Tarih, Dil, Matematik, Coğrafya, Astronomi, Hayvanlar Alemi, Oyun, Teknoloji, Fizik, Kimya, Biyoloji, Edebiyat, Filmler ve Diziler). Her soru belgede belirtilen kategorisiyle eşleştirilir.
- **Doğru cevap belirleme**: Her sorunun doğru cevabı belgedeki yıldız (`*`) işaretine göre alınır. Yıldızın açıkça yanlış şıkta durduğu sorular (örn. Özgürlük Heykeli → Fransa, Amazon → Güney Amerika) olgusal doğrusuyla düzeltilir.
- **Tek kaynaktan paylaşım**: Tüm bu sorular "swipedia" kullanıcı adlı hesabın paylaşımı olarak görünür; akışta ve o hesabın "Paylaştıklarım" sekmesinde bu hesabın adıyla listelenir.
- **Deneme sorularının temizlenmesi**: Bu 300 soru dışındaki uygulamadaki tüm mevcut sorular kaldırılır.
- **Doğrulanmış admin kimliği**: "swipedia" hesabının profil fotoğrafı uygulama ikonu olur ve profilinde doğrulanmış (mavi tik) rozeti gösterilir. Bu ana yönetici hesabıdır.
- **Puan muafiyeti**: "swipedia" hesabı puan sistemine tabi tutulmaz; bu hesapta puan barı/puan göstergeleri gizlenir ve soru çözse bile puan kazanmaz.

## Kullanıcı akışı
- Normal kullanıcı akışı aynı kalır: giriş → kaydırmalı akışta soruları yanıtlar. Fark, akışın artık resmî, kategorili sorularla dolu olmasıdır.
- Akıştaki her resmî sorunun üstünde paylaşan olarak "swipedia" (doğrulanmış rozetli) görünür.
- "swipedia" hesabıyla giriş yapıldığında profilde puan göstergesi yer almaz; profil fotoğrafı uygulama ikonu ve adının yanında doğrulanmış rozeti görünür; "Paylaştıklarım" sekmesi 300 resmî soruyu listeler.

## UI/UX hissi
- Mevcut tasarım dili ve kategoriler korunur; görsel bir yenilik yok, içerik ve hesap davranışı değişir.
- Doğrulanmış rozet ve ikon-profil-fotoğrafı, resmî hesaba belirgin bir güven/otorite hissi verir.
- Puan barının bu hesapta görünmemesi, yönetici kimliğini oyunlaştırmadan ayırır.

## Uygulama aşamaları
**Aşama 1 — MVP (şimdi yapılacak)**
- 300 sorunun doğru cevaplarıyla birlikte doğru kategoriye yerleştirilmesi ve "swipedia" hesabından paylaşılması.
- Diğer tüm mevcut soruların kaldırılması.
- "swipedia" hesabına uygulama ikonu profil fotoğrafı + doğrulanmış rozet verilmesi.
- "swipedia" hesabının puan sisteminden muaf tutulması (puan barının gizlenmesi, puan kazanmaması).

**Aşama 2 — Sonraki (şimdi yapılmayacak)**
- Admin hesabının uygulama içinden toplu soru ekleme/düzenleme/silme yapabileceği basit bir yönetim ekranı.

**Aşama 3 — Sonraki (şimdi yapılmayacak)**
- Kategori bazlı filtreleme/keşif ve resmî soru setlerinin koleksiyonlar hâlinde sunulması.

## Varsayımlar
- Doğru cevap önce belgedeki yıldıza göre alınır; yıldızın bariz yanlış olduğu sorular olgusal doğrusuyla düzeltilir (onaylanan seçenek).
- Hedef hesap, kullanıcı adı tam olarak "swipedia" olan mevcut hesaptır; bu hesap bulunup resmî/admin hesabı olarak işaretlenir.
- Her sorunun metni belgedeki hâliyle (soru + açıklayıcı ikinci cümle dâhil) kullanılır; ayrıca ek bir açıklama metni üretilmez.
- Sorulara görsel/arka plan eklenmez; zorluk tüm sorular için tek bir ortak değere (orta) ayarlanır.
- "Diğer tüm sorular silinsin" talebi, bu 300 soru dışındaki her soruyu kapsar (daha önce test amacıyla oluşturulmuş olanlar dâhil).
- Puan muafiyeti yalnızca "swipedia" hesabını etkiler; diğer kullanıcıların puan deneyimi aynen devam eder.
- Belgedeki kategori adları uygulamadaki mevcut kategorilerle birebir eşleşir; yeni kategori eklenmez.
- İşlem, ek ücretli servis (yapay zekâ vb.) kullanılmadan, düşük maliyetli biçimde yapılır.
