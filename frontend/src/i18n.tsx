import { getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { storage } from "@/src/utils/storage";

export const SUPPORTED_LANGS = ["tr", "en", "de", "ru", "it", "fr", "ar", "zh"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

const LANG_KEY = "swipedia.lang";

export const LANG_NAMES: Record<Lang, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  ru: "Русский",
  it: "Italiano",
  fr: "Français",
  ar: "العربية",
  zh: "中文",
};

type Dict = Record<string, Record<Lang, string>>;

const DICT: Dict = {
  "app.loading": { tr: "Swipedia açılıyor…", en: "Opening Swipedia…", de: "Swipedia öffnet…", ru: "Открываем Swipedia…", it: "Apertura di Swipedia…", fr: "Ouverture de Swipedia…", ar: "يتم فتح Swipedia…", zh: "正在打开 Swipedia…" },

  "tabs.explore": { tr: "Keşfet", en: "Explore", de: "Entdecken", ru: "Лента", it: "Esplora", fr: "Explorer", ar: "استكشاف", zh: "发现" },
  "tabs.create": { tr: "Oluştur", en: "Create", de: "Erstellen", ru: "Создать", it: "Crea", fr: "Créer", ar: "إنشاء", zh: "创建" },
  "tabs.ranks": { tr: "Rütbeler", en: "Ranks", de: "Ränge", ru: "Звания", it: "Gradi", fr: "Grades", ar: "الرتب", zh: "等级" },
  "tabs.chat": { tr: "Mesaj", en: "Chat", de: "Chat", ru: "Чат", it: "Chat", fr: "Messages", ar: "الرسائل", zh: "消息" },
  "tabs.profile": { tr: "Profil", en: "Profile", de: "Profil", ru: "Профиль", it: "Profilo", fr: "Profil", ar: "الملف", zh: "我的" },

  "common.retry": { tr: "Tekrar dene", en: "Retry", de: "Erneut versuchen", ru: "Повторить", it: "Riprova", fr: "Réessayer", ar: "إعادة المحاولة", zh: "重试" },
  "common.cancel": { tr: "Vazgeç", en: "Cancel", de: "Abbrechen", ru: "Отмена", it: "Annulla", fr: "Annuler", ar: "إلغاء", zh: "取消" },
  "common.points": { tr: "puan", en: "points", de: "Punkte", ru: "очков", it: "punti", fr: "points", ar: "نقاط", zh: "分" },
  "common.correct": { tr: "Bildin!", en: "Correct!", de: "Richtig!", ru: "Верно!", it: "Esatto!", fr: "Correct !", ar: "أصبت!", zh: "答对了！" },
  "common.wrong": { tr: "Bu kez olmadı", en: "Not this time", de: "Nicht diesmal", ru: "Не в этот раз", it: "Non questa volta", fr: "Pas cette fois", ar: "ليس هذه المرة", zh: "这次不对" },

  "auth.tagline": { tr: "Kaydır. Keşfet. Hatırla.", en: "Swipe. Discover. Remember.", de: "Wischen. Entdecken. Merken.", ru: "Листай. Узнавай. Запоминай.", it: "Scorri. Scopri. Ricorda.", fr: "Glisse. Découvre. Retiens.", ar: "مرّر. اكتشف. تذكّر.", zh: "滑动。发现。记住。" },
  "auth.title": { tr: "Her kaydırmada\nyeni bir kıvılcım.", en: "A new spark\nwith every swipe.", de: "Bei jedem Wischen\nein neuer Funke.", ru: "Новая искра\nс каждым свайпом.", it: "Una nuova scintilla\na ogni swipe.", fr: "Une nouvelle étincelle\nà chaque glissement.", ar: "شرارة جديدة\nمع كل تمريرة.", zh: "每一次滑动\n都有新火花。" },
  "auth.subtitle": { tr: "Gündelik merakını mini sorulara çevir, arkadaşlarınla paylaş ve rütbeleri tırman.", en: "Turn daily curiosity into mini questions, share with friends and climb the ranks.", de: "Verwandle Neugier in Mini-Fragen, teile sie und steige auf.", ru: "Превращай любопытство в мини-вопросы, делись с друзьями и расти в званиях.", it: "Trasforma la curiosità in mini domande, condividile e scala i gradi.", fr: "Transforme ta curiosité en mini-questions, partage-les et grimpe les grades.", ar: "حوّل فضولك اليومي إلى أسئلة قصيرة وشاركها مع أصدقائك وتقدّم في الرتب.", zh: "把日常好奇变成小问题，与朋友分享并晋升等级。" },
  "auth.login": { tr: "Giriş yap", en: "Log in", de: "Anmelden", ru: "Войти", it: "Accedi", fr: "Se connecter", ar: "تسجيل الدخول", zh: "登录" },
  "auth.register": { tr: "Kayıt ol", en: "Sign up", de: "Registrieren", ru: "Регистрация", it: "Registrati", fr: "S'inscrire", ar: "إنشاء حساب", zh: "注册" },
  "auth.name": { tr: "Adın", en: "Your name", de: "Dein Name", ru: "Ваше имя", it: "Il tuo nome", fr: "Ton nom", ar: "اسمك", zh: "你的名字" },
  "auth.email": { tr: "E-posta", en: "Email", de: "E-Mail", ru: "Почта", it: "Email", fr: "E-mail", ar: "البريد الإلكتروني", zh: "邮箱" },
  "auth.password": { tr: "Şifre (en az 6 karakter)", en: "Password (min 6 chars)", de: "Passwort (mind. 6 Zeichen)", ru: "Пароль (мин. 6 символов)", it: "Password (min 6 caratteri)", fr: "Mot de passe (min 6 caractères)", ar: "كلمة المرور (6 أحرف على الأقل)", zh: "密码（至少6位）" },
  "auth.submitLogin": { tr: "Merak etmeye başla", en: "Start exploring", de: "Loslegen", ru: "Начать", it: "Inizia a esplorare", fr: "Commencer", ar: "ابدأ الاستكشاف", zh: "开始探索" },
  "auth.submitRegister": { tr: "Hesabımı oluştur", en: "Create my account", de: "Konto erstellen", ru: "Создать аккаунт", it: "Crea il mio account", fr: "Créer mon compte", ar: "إنشاء حسابي", zh: "创建账户" },
  "auth.google": { tr: "Google ile devam et", en: "Continue with Google", de: "Mit Google fortfahren", ru: "Продолжить с Google", it: "Continua con Google", fr: "Continuer avec Google", ar: "المتابعة عبر Google", zh: "使用 Google 继续" },
  "auth.guest": { tr: "Şimdilik misafir olarak keşfet →", en: "Explore as guest for now →", de: "Erstmal als Gast entdecken →", ru: "Пока как гость →", it: "Esplora come ospite →", fr: "Explorer en invité →", ar: "استكشف كضيف الآن ←", zh: "先以游客身份探索 →" },
  "auth.legal": { tr: "Devam ederek Swipedia topluluk kurallarını kabul etmiş olursun.", en: "By continuing you accept Swipedia's community rules.", de: "Mit dem Fortfahren akzeptierst du die Swipedia-Regeln.", ru: "Продолжая, вы принимаете правила Swipedia.", it: "Continuando accetti le regole di Swipedia.", fr: "En continuant, tu acceptes les règles de Swipedia.", ar: "بالمتابعة أنت توافق على قواعد مجتمع Swipedia.", zh: "继续即表示你同意 Swipedia 社区规则。" },
  "auth.error": { tr: "Bir şeyler ters gitti, tekrar dene.", en: "Something went wrong, try again.", de: "Etwas lief schief, versuche es erneut.", ru: "Что-то пошло не так.", it: "Qualcosa è andato storto.", fr: "Une erreur est survenue.", ar: "حدث خطأ ما، حاول مجدداً.", zh: "出错了，请重试。" },

  "feed.loading": { tr: "Merak kıvılcımları hazırlanıyor…", en: "Sparks of curiosity are loading…", de: "Funken werden geladen…", ru: "Искры загружаются…", it: "Scintille in arrivo…", fr: "Les étincelles arrivent…", ar: "تُجهَّز شرارات الفضول…", zh: "灵感火花加载中…" },
  "feed.errorTitle": { tr: "Akış yüklenemedi", en: "Feed failed to load", de: "Feed nicht geladen", ru: "Лента не загрузилась", it: "Feed non caricato", fr: "Flux non chargé", ar: "تعذر تحميل المحتوى", zh: "加载失败" },
  "feed.errorSub": { tr: "Bağlantını kontrol edip tekrar dene.", en: "Check your connection and retry.", de: "Prüfe deine Verbindung.", ru: "Проверьте соединение.", it: "Controlla la connessione.", fr: "Vérifie ta connexion.", ar: "تحقق من اتصالك وأعد المحاولة.", zh: "请检查网络后重试。" },
  "feed.emptyTitle": { tr: "Akış henüz boş", en: "The feed is empty", de: "Noch nichts hier", ru: "Лента пуста", it: "Il feed è vuoto", fr: "Le flux est vide", ar: "المحتوى فارغ", zh: "还没有内容" },
  "feed.emptySub": { tr: "İlk merak kıvılcımını sen bırak.", en: "Drop the first spark of curiosity.", de: "Hinterlasse den ersten Funken.", ru: "Оставьте первую искру.", it: "Lascia la prima scintilla.", fr: "Dépose la première étincelle.", ar: "أضف أول شرارة فضول.", zh: "来点燃第一颗火花吧。" },
  "feed.comments": { tr: "Yorumlar", en: "Comments", de: "Kommentare", ru: "Комментарии", it: "Commenti", fr: "Commentaires", ar: "التعليقات", zh: "评论" },
  "feed.firstComment": { tr: "İlk meraklı yorumu sen bırak.", en: "Be the first curious comment.", de: "Schreib den ersten Kommentar.", ru: "Оставьте первый комментарий.", it: "Scrivi il primo commento.", fr: "Laisse le premier commentaire.", ar: "كن أول من يعلّق.", zh: "来发表第一条评论吧。" },
  "feed.commentPlaceholder": { tr: "Bir düşünce bırak…", en: "Leave a thought…", de: "Einen Gedanken teilen…", ru: "Оставьте мысль…", it: "Lascia un pensiero…", fr: "Laisse une pensée…", ar: "اترك فكرة…", zh: "留下你的想法…" },
  "feed.shareTitle": { tr: "Kime gönderelim?", en: "Send to whom?", de: "An wen senden?", ru: "Кому отправить?", it: "A chi lo inviamo?", fr: "À qui l'envoyer ?", ar: "لمن نرسله؟", zh: "发送给谁？" },
  "feed.shareNote": { tr: "İstersen bir not ekle…", en: "Add a note if you like…", de: "Notiz hinzufügen…", ru: "Добавьте заметку…", it: "Aggiungi una nota…", fr: "Ajoute une note…", ar: "أضف ملاحظة إن أردت…", zh: "可以附上一句话…" },
  "feed.noPeople": { tr: "Mesajlaşacak merak ortağı henüz yok.", en: "No curiosity buddies yet.", de: "Noch keine Kontakte.", ru: "Пока нет собеседников.", it: "Nessun amico ancora.", fr: "Pas encore d'amis.", ar: "لا يوجد أصدقاء فضول بعد.", zh: "还没有可私信的好友。" },
  "feed.saved": { tr: "Soru kaydedildi", en: "Question saved", de: "Gespeichert", ru: "Сохранено", it: "Salvata", fr: "Enregistrée", ar: "تم الحفظ", zh: "已保存" },
  "feed.unsaved": { tr: "Kayıttan çıkarıldı", en: "Removed from saved", de: "Entfernt", ru: "Удалено", it: "Rimossa", fr: "Retirée", ar: "أُزيل من المحفوظات", zh: "已取消保存" },
  "feed.shared": { tr: "{name} ile paylaşıldı", en: "Shared with {name}", de: "Mit {name} geteilt", ru: "Отправлено: {name}", it: "Condivisa con {name}", fr: "Partagée avec {name}", ar: "تمت المشاركة مع {name}", zh: "已分享给 {name}" },
  "feed.lookAtThis": { tr: "Şuna bak: \"{text}\"", en: "Look at this: \"{text}\"", de: "Schau mal: \"{text}\"", ru: "Взгляни: \"{text}\"", it: "Guarda: \"{text}\"", fr: "Regarde : « {text} »", ar: "انظر إلى هذا: \"{text}\"", zh: "看看这个：\"{text}\"" },
  "feed.loginToSave": { tr: "Kaydetmek için giriş yapmalısın.", en: "Log in to save.", de: "Zum Speichern anmelden.", ru: "Войдите, чтобы сохранять.", it: "Accedi per salvare.", fr: "Connecte-toi pour enregistrer.", ar: "سجّل الدخول للحفظ.", zh: "登录后才能保存。" },
  "feed.answerFailed": { tr: "Cevap kaydedilemedi, tekrar dene.", en: "Answer could not be saved.", de: "Antwort nicht gespeichert.", ru: "Ответ не сохранён.", it: "Risposta non salvata.", fr: "Réponse non enregistrée.", ar: "تعذر حفظ الإجابة.", zh: "答案保存失败。" },
  "feed.commentFailed": { tr: "Yorum eklenemedi.", en: "Comment could not be added.", de: "Kommentar fehlgeschlagen.", ru: "Комментарий не добавлен.", it: "Commento non aggiunto.", fr: "Commentaire non ajouté.", ar: "تعذر إضافة التعليق.", zh: "评论失败。" },
  "feed.shareFailed": { tr: "Paylaşım başarısız.", en: "Share failed.", de: "Teilen fehlgeschlagen.", ru: "Не удалось поделиться.", it: "Condivisione fallita.", fr: "Partage échoué.", ar: "فشلت المشاركة.", zh: "分享失败。" },
  "feed.popupProgress": { tr: "{done}/{rate} doğru · Toplam {total} puan", en: "{done}/{rate} correct · {total} points total", de: "{done}/{rate} richtig · {total} Punkte gesamt", ru: "{done}/{rate} верно · Всего {total}", it: "{done}/{rate} esatte · {total} punti totali", fr: "{done}/{rate} bonnes · {total} points", ar: "{done}/{rate} صحيحة · المجموع {total}", zh: "{done}/{rate} 正确 · 总分 {total}" },
  "feed.popupMilestone": { tr: "50 doğru bonusu! Toplam {total} puan", en: "50-correct bonus! {total} points total", de: "Bonus für 50 Richtige! {total} Punkte", ru: "Бонус за 50 верных! Всего {total}", it: "Bonus 50 esatte! {total} punti", fr: "Bonus 50 bonnes réponses ! {total} points", ar: "مكافأة 50 إجابة صحيحة! المجموع {total}", zh: "50题全对奖励！总分 {total}" },

  "create.title": { tr: "Soru oluştur", en: "Create a question", de: "Frage erstellen", ru: "Создать вопрос", it: "Crea una domanda", fr: "Créer une question", ar: "إنشاء سؤال", zh: "创建问题" },
  "create.hint": { tr: "Merakını topluluğa bırak.", en: "Leave your curiosity to the community.", de: "Teile deine Neugier.", ru: "Поделитесь любопытством.", it: "Lascia la tua curiosità.", fr: "Partage ta curiosité.", ar: "شارك فضولك مع المجتمع.", zh: "把你的好奇分享出去。" },
  "create.topic": { tr: "Konu", en: "Topic", de: "Thema", ru: "Тема", it: "Argomento", fr: "Sujet", ar: "الموضوع", zh: "主题" },
  "create.difficulty": { tr: "Zorluk", en: "Difficulty", de: "Schwierigkeit", ru: "Сложность", it: "Difficoltà", fr: "Difficulté", ar: "الصعوبة", zh: "难度" },
  "create.questionLabel": { tr: "Sorun", en: "Your question", de: "Deine Frage", ru: "Ваш вопрос", it: "La tua domanda", fr: "Ta question", ar: "سؤالك", zh: "你的问题" },
  "create.questionHint": { tr: "Kaydırırken durup düşündürecek kadar ilginç olsun.", en: "Make it interesting enough to pause a swipe.", de: "Interessant genug zum Innehalten.", ru: "Достаточно интересный, чтобы остановиться.", it: "Abbastanza interessante da fermare lo swipe.", fr: "Assez intrigant pour s'arrêter.", ar: "اجعله مثيراً ليوقف التمرير.", zh: "有趣到让人停下来思考。" },
  "create.questionPlaceholder": { tr: "Örn. Dünyanın en büyük okyanusu hangisidir?", en: "E.g. Which is the largest ocean?", de: "Z. B. Welcher Ozean ist der größte?", ru: "Напр. Какой океан самый большой?", it: "Es. Qual è l'oceano più grande?", fr: "Ex. Quel est le plus grand océan ?", ar: "مثال: ما أكبر محيط في العالم؟", zh: "例：世界上最大的海洋是哪个？" },
  "create.options": { tr: "Seçenekler", en: "Options", de: "Optionen", ru: "Варианты", it: "Opzioni", fr: "Options", ar: "الخيارات", zh: "选项" },
  "create.optionPlaceholder": { tr: "{letter} seçeneği", en: "Option {letter}", de: "Option {letter}", ru: "Вариант {letter}", it: "Opzione {letter}", fr: "Option {letter}", ar: "الخيار {letter}", zh: "选项 {letter}" },
  "create.correctSuffix": { tr: " · doğru cevap", en: " · correct answer", de: " · richtig", ru: " · верный", it: " · corretta", fr: " · bonne réponse", ar: " · الإجابة الصحيحة", zh: " · 正确答案" },
  "create.background": { tr: "Arka plan", en: "Background", de: "Hintergrund", ru: "Фон", it: "Sfondo", fr: "Arrière-plan", ar: "الخلفية", zh: "背景" },
  "create.backgroundHint": { tr: "Sorunun dikkat çekmesi için bir görsel seç veya kendi resmini yükle.", en: "Pick a visual or upload your own image.", de: "Wähle ein Bild oder lade deins hoch.", ru: "Выберите фон или загрузите свой.", it: "Scegli un'immagine o carica la tua.", fr: "Choisis un visuel ou téléverse le tien.", ar: "اختر صورة أو ارفع صورتك الخاصة.", zh: "选择图片或上传自己的图片。" },
  "create.classic": { tr: "Klasik", en: "Classic", de: "Klassisch", ru: "Классика", it: "Classico", fr: "Classique", ar: "كلاسيكي", zh: "经典" },
  "create.preset": { tr: "Hazır", en: "Ready", de: "Fertig", ru: "Готовый", it: "Pronto", fr: "Prêt", ar: "جاهز", zh: "预设" },
  "create.upload": { tr: "Yükle", en: "Upload", de: "Hochladen", ru: "Загрузить", it: "Carica", fr: "Téléverser", ar: "رفع", zh: "上传" },
  "create.uploading": { tr: "Yükleniyor", en: "Uploading", de: "Lädt hoch", ru: "Загрузка", it: "Caricamento", fr: "Téléversement", ar: "جارٍ الرفع", zh: "上传中" },
  "create.explanation": { tr: "Kısa açıklama", en: "Short explanation", de: "Kurze Erklärung", ru: "Пояснение", it: "Breve spiegazione", fr: "Courte explication", ar: "شرح قصير", zh: "简短解释" },
  "create.explanationPlaceholder": { tr: "Doğru cevabı bir cümleyle anlat.", en: "Explain the answer in one sentence.", de: "Erkläre die Antwort in einem Satz.", ru: "Объясните ответ одним предложением.", it: "Spiega la risposta in una frase.", fr: "Explique la réponse en une phrase.", ar: "اشرح الإجابة بجملة واحدة.", zh: "用一句话解释答案。" },
  "create.publish": { tr: "Keşfete bırak", en: "Drop it to Explore", de: "Veröffentlichen", ru: "Опубликовать", it: "Pubblica", fr: "Publier", ar: "انشر", zh: "发布" },
  "create.published": { tr: "Sorun keşfete eklendi!", en: "Your question is live!", de: "Frage veröffentlicht!", ru: "Вопрос опубликован!", it: "Domanda pubblicata!", fr: "Question publiée !", ar: "تم نشر سؤالك!", zh: "问题已发布！" },
  "create.incomplete": { tr: "Soru, dört seçenek ve açıklama gerekli.", en: "Question, 4 options and explanation required.", de: "Frage, 4 Optionen und Erklärung nötig.", ru: "Нужны вопрос, 4 варианта и пояснение.", it: "Servono domanda, 4 opzioni e spiegazione.", fr: "Question, 4 options et explication requises.", ar: "السؤال وأربعة خيارات وشرح مطلوبة.", zh: "需要问题、四个选项和解释。" },
  "create.tip": { tr: "Kısa, net ve tek doğru cevaplı sorular daha çok keşfedilir.", en: "Short, clear questions with one answer get discovered more.", de: "Kurze, klare Fragen werden öfter entdeckt.", ru: "Короткие и ясные вопросы находят чаще.", it: "Domande brevi e chiare vengono scoperte di più.", fr: "Les questions courtes et claires sont plus vues.", ar: "الأسئلة القصيرة الواضحة تُكتشف أكثر.", zh: "简短清晰的问题更容易被发现。" },
  "create.uploadFailed": { tr: "Resim yüklenemedi, tekrar dene.", en: "Image upload failed, try again.", de: "Upload fehlgeschlagen.", ru: "Не удалось загрузить.", it: "Caricamento fallito.", fr: "Échec du téléversement.", ar: "فشل رفع الصورة.", zh: "图片上传失败。" },
  "create.bgLoaded": { tr: "Arka plan yüklendi", en: "Background uploaded", de: "Hintergrund hochgeladen", ru: "Фон загружен", it: "Sfondo caricato", fr: "Arrière-plan téléversé", ar: "تم رفع الخلفية", zh: "背景已上传" },
  "create.permTitle": { tr: "Galeri izni gerekli", en: "Gallery access needed", de: "Galerie-Zugriff nötig", ru: "Нужен доступ к галерее", it: "Accesso alla galleria richiesto", fr: "Accès à la galerie requis", ar: "مطلوب إذن المعرض", zh: "需要相册权限" },
  "create.permText": { tr: "Kendi arka plan resmini eklemek için galerine erişmemiz gerekiyor.", en: "We need gallery access to add your own background.", de: "Wir brauchen Zugriff für dein eigenes Bild.", ru: "Нужен доступ, чтобы добавить свой фон.", it: "Serve l'accesso per il tuo sfondo.", fr: "Accès requis pour ton propre fond.", ar: "نحتاج إلى الوصول لإضافة خلفيتك الخاصة.", zh: "需要访问相册以添加自定义背景。" },
  "create.openSettings": { tr: "Ayarları aç", en: "Open settings", de: "Einstellungen öffnen", ru: "Открыть настройки", it: "Apri impostazioni", fr: "Ouvrir les réglages", ar: "فتح الإعدادات", zh: "打开设置" },

  "ranks.title": { tr: "Rütbeler", en: "Ranks", de: "Ränge", ru: "Звания", it: "Gradi", fr: "Grades", ar: "الرتب", zh: "等级" },
  "ranks.hint": { tr: "Puanın seni nereye taşıyor?", en: "Where will your points take you?", de: "Wohin tragen dich deine Punkte?", ru: "Куда приведут очки?", it: "Dove ti portano i punti?", fr: "Où tes points te mènent ?", ar: "إلى أين ستأخذك نقاطك؟", zh: "你的积分将带你到哪里？" },
  "ranks.next": { tr: "Sonraki rütbe: {rank} · {points} puan kaldı", en: "Next rank: {rank} · {points} points left", de: "Nächster Rang: {rank} · noch {points}", ru: "Следующее звание: {rank} · осталось {points}", it: "Prossimo grado: {rank} · mancano {points}", fr: "Prochain grade : {rank} · encore {points}", ar: "الرتبة التالية: {rank} · تبقّى {points}", zh: "下一等级：{rank} · 还差 {points} 分" },
  "ranks.top": { tr: "En yüksek rütbedesin, efsanesin!", en: "You are at the top rank, legend!", de: "Höchster Rang, Legende!", ru: "Высшее звание, легенда!", it: "Grado massimo, leggenda!", fr: "Grade max, légende !", ar: "أعلى رتبة، يا أسطورة!", zh: "你已是最高等级，传奇！" },
  "ranks.here": { tr: "Buradasın", en: "You are here", de: "Du bist hier", ru: "Вы здесь", it: "Sei qui", fr: "Tu es ici", ar: "أنت هنا", zh: "你在这里" },
  "ranks.rate": { tr: "Her {rate} doğru = 1 puan", en: "Every {rate} correct = 1 point", de: "Alle {rate} Richtige = 1 Punkt", ru: "Каждые {rate} верных = 1 очко", it: "Ogni {rate} esatte = 1 punto", fr: "Toutes les {rate} bonnes = 1 point", ar: "كل {rate} صحيحة = نقطة واحدة", zh: "每 {rate} 题正确 = 1 分" },

  "chat.title": { tr: "Mesajlar", en: "Messages", de: "Nachrichten", ru: "Сообщения", it: "Messaggi", fr: "Messages", ar: "الرسائل", zh: "消息" },
  "chat.hint": { tr: "İyi sorular arkadaşla daha iyi.", en: "Good questions are better with friends.", de: "Gute Fragen sind zusammen besser.", ru: "Вопросы лучше с друзьями.", it: "Le domande sono meglio con gli amici.", fr: "Les bonnes questions sont mieux à deux.", ar: "الأسئلة الجيدة أجمل مع الأصدقاء.", zh: "好朋友让好问题更有趣。" },
  "chat.partners": { tr: "Merak ortakları", en: "Curiosity buddies", de: "Neugier-Partner", ru: "Собеседники", it: "Compagni di curiosità", fr: "Compagnons de curiosité", ar: "رفقاء الفضول", zh: "好奇伙伴" },
  "chat.emptyTitle": { tr: "Mesaj kutun boş", en: "Your inbox is empty", de: "Posteingang leer", ru: "Входящие пусты", it: "Posta vuota", fr: "Boîte vide", ar: "صندوقك فارغ", zh: "收件箱为空" },
  "chat.emptyText": { tr: "Kayıtlı hesaplarla sorularını arkadaşlarınla paylaşabilirsin.", en: "With an account you can share questions with friends.", de: "Mit einem Konto kannst du Fragen teilen.", ru: "С аккаунтом можно делиться вопросами.", it: "Con un account puoi condividere le domande.", fr: "Avec un compte, partage tes questions.", ar: "بحساب مسجل يمكنك مشاركة الأسئلة.", zh: "注册后即可与好友分享问题。" },
  "chat.newPartner": { tr: "Yeni bir merak ortağı", en: "A new curiosity buddy", de: "Neuer Partner", ru: "Новый собеседник", it: "Nuovo compagno", fr: "Nouveau compagnon", ar: "رفيق فضول جديد", zh: "新的好奇伙伴" },

  "conv.partner": { tr: "Merak ortağın", en: "Your curiosity buddy", de: "Dein Partner", ru: "Ваш собеседник", it: "Il tuo compagno", fr: "Ton compagnon", ar: "رفيق فضولك", zh: "你的好奇伙伴" },
  "conv.emptyTitle": { tr: "İlk mesajı sen at", en: "Send the first message", de: "Schreib die erste Nachricht", ru: "Напишите первым", it: "Scrivi il primo messaggio", fr: "Envoie le premier message", ar: "أرسل أول رسالة", zh: "发出第一条消息吧" },
  "conv.emptyText": { tr: "Bir soruyu paylaş veya bugünün merakını anlat.", en: "Share a question or today's curiosity.", de: "Teile eine Frage oder deine Neugier.", ru: "Поделитесь вопросом.", it: "Condividi una domanda.", fr: "Partage une question ou ta curiosité.", ar: "شارك سؤالاً أو فضول اليوم.", zh: "分享一个问题或今天的好奇心。" },
  "conv.placeholder": { tr: "Mesaj yaz…", en: "Write a message…", de: "Nachricht schreiben…", ru: "Сообщение…", it: "Scrivi un messaggio…", fr: "Écris un message…", ar: "اكتب رسالة…", zh: "写消息…" },
  "conv.failed": { tr: "Mesaj gönderilemedi, tekrar dene.", en: "Message failed, retry.", de: "Senden fehlgeschlagen.", ru: "Не удалось отправить.", it: "Invio fallito.", fr: "Échec de l'envoi.", ar: "فشل الإرسال.", zh: "发送失败，请重试。" },
  "conv.questionShare": { tr: "Soru paylaşımı", en: "Question share", de: "Geteilte Frage", ru: "Общий вопрос", it: "Domanda condivisa", fr: "Question partagée", ar: "مشاركة سؤال", zh: "分享的问题" },

  "profile.title": { tr: "Profil", en: "Profile", de: "Profil", ru: "Профиль", it: "Profilo", fr: "Profil", ar: "الملف الشخصي", zh: "个人资料" },
  "profile.hint": { tr: "Kendi merak haritan.", en: "Your own curiosity map.", de: "Deine Neugier-Karte.", ru: "Ваша карта любопытства.", it: "La tua mappa di curiosità.", fr: "Ta carte de curiosité.", ar: "خريطة فضولك.", zh: "你的好奇地图。" },
  "profile.points": { tr: "Puan", en: "Points", de: "Punkte", ru: "Очки", it: "Punti", fr: "Points", ar: "النقاط", zh: "积分" },
  "profile.corrects": { tr: "Doğru", en: "Correct", de: "Richtig", ru: "Верные", it: "Esatte", fr: "Bonnes", ar: "الصحيحة", zh: "正确" },
  "profile.saved": { tr: "Kayıtlı", en: "Saved", de: "Gespeichert", ru: "Сохранённые", it: "Salvate", fr: "Enregistrées", ar: "المحفوظة", zh: "已保存" },
  "profile.lab": { tr: "PUAN LABORATUVARI", en: "POINTS LAB", de: "PUNKTE-LABOR", ru: "ЛАБОРАТОРИЯ ОЧКОВ", it: "LABORATORIO PUNTI", fr: "LABO DE POINTS", ar: "مختبر النقاط", zh: "积分实验室" },
  "profile.rateInfo": { tr: "Her {rate} doğruda +1 puan", en: "+1 point every {rate} correct", de: "+1 Punkt alle {rate} Richtige", ru: "+1 очко за каждые {rate} верных", it: "+1 punto ogni {rate} esatte", fr: "+1 point toutes les {rate} bonnes", ar: "+1 نقطة كل {rate} إجابة صحيحة", zh: "每 {rate} 题正确 +1 分" },
  "profile.totalCorrect": { tr: "Toplam doğru", en: "Total correct", de: "Richtige gesamt", ru: "Всего верных", it: "Totale esatte", fr: "Total bonnes", ar: "مجموع الصحيحة", zh: "总正确数" },
  "profile.toBonus": { tr: "Bonusa kalan", en: "To next bonus", de: "Bis zum Bonus", ru: "До бонуса", it: "Al bonus", fr: "Avant le bonus", ar: "حتى المكافأة", zh: "距奖励" },
  "profile.leaderboard": { tr: "Meraklılar listesi", en: "Curious minds", de: "Neugierige", ru: "Любознательные", it: "I curiosi", fr: "Les curieux", ar: "الفضوليون", zh: "好奇榜" },
  "profile.leaderboardEmpty": { tr: "Sıralama puanlar geldikçe görünecek.", en: "Rankings appear as points grow.", de: "Rangliste folgt mit Punkten.", ru: "Рейтинг появится с очками.", it: "La classifica arriverà coi punti.", fr: "Le classement arrive avec les points.", ar: "سيظهر الترتيب مع النقاط.", zh: "有了积分后排行榜将显示。" },
  "profile.logout": { tr: "Çıkış yap", en: "Log out", de: "Abmelden", ru: "Выйти", it: "Esci", fr: "Se déconnecter", ar: "تسجيل الخروج", zh: "退出登录" },
  "profile.tabShared": { tr: "Paylaştıklarım", en: "My questions", de: "Meine Fragen", ru: "Мои вопросы", it: "Le mie domande", fr: "Mes questions", ar: "أسئلتي", zh: "我的提问" },
  "profile.tabSaved": { tr: "Kaydedilenler", en: "Saved", de: "Gespeichert", ru: "Сохранённые", it: "Salvate", fr: "Enregistrées", ar: "المحفوظة", zh: "已保存" },
  "profile.noShared": { tr: "Henüz soru paylaşmadın. İlk sorunu oluştur!", en: "You haven't shared any questions yet. Create your first one!", de: "Du hast noch keine Fragen geteilt. Erstelle deine erste!", ru: "Вы ещё не делились вопросами. Создайте первый!", it: "Non hai ancora condiviso domande. Crea la prima!", fr: "Tu n'as pas encore partagé de questions. Crée la première !", ar: "لم تشارك أي أسئلة بعد. أنشئ أول سؤال!", zh: "你还没有分享任何问题，创建第一个吧！" },
  "profile.noSaved": { tr: "Henüz kaydedilen soru yok. Akışta kalp/kaydet simgesine dokun.", en: "No saved questions yet. Tap the save icon in the feed.", de: "Noch keine gespeicherten Fragen. Tippe im Feed auf Speichern.", ru: "Пока нет сохранённых вопросов. Нажмите «Сохранить» в ленте.", it: "Nessuna domanda salvata. Tocca salva nel feed.", fr: "Aucune question enregistrée. Touche l'icône d'enregistrement dans le fil.", ar: "لا أسئلة محفوظة بعد. اضغط رمز الحفظ في الصفحة.", zh: "暂无已保存的问题。在信息流中点击保存图标。" },
  "ranks.leaderboard": { tr: "Meraklılar", en: "Curious minds", de: "Neugierige", ru: "Любознательные", it: "I curiosi", fr: "Les curieux", ar: "الفضوليون", zh: "好奇榜" },
  "ranks.leaderboardHint": { tr: "İlk 100 sıralaması · dokunarak aç", en: "Top 100 ranking · tap to open", de: "Top 100 · zum Öffnen tippen", ru: "Топ-100 · нажмите, чтобы открыть", it: "Top 100 · tocca per aprire", fr: "Top 100 · touche pour ouvrir", ar: "أفضل 100 · اضغط للفتح", zh: "前100名 · 点击展开" },

  "settings.title": { tr: "Ayarlar", en: "Settings", de: "Einstellungen", ru: "Настройки", it: "Impostazioni", fr: "Réglages", ar: "الإعدادات", zh: "设置" },
  "settings.profileSection": { tr: "Profili düzenle", en: "Edit profile", de: "Profil bearbeiten", ru: "Редактировать профиль", it: "Modifica profilo", fr: "Modifier le profil", ar: "تعديل الملف", zh: "编辑资料" },
  "settings.name": { tr: "Gerçek ad", en: "Real name", de: "Echter Name", ru: "Настоящее имя", it: "Nome reale", fr: "Nom réel", ar: "الاسم الحقيقي", zh: "真实姓名" },
  "settings.username": { tr: "Kullanıcı adı", en: "Username", de: "Benutzername", ru: "Имя пользователя", it: "Nome utente", fr: "Nom d'utilisateur", ar: "اسم المستخدم", zh: "用户名" },
  "settings.saveProfile": { tr: "Kaydet", en: "Save", de: "Speichern", ru: "Сохранить", it: "Salva", fr: "Enregistrer", ar: "حفظ", zh: "保存" },
  "settings.saved": { tr: "Profil güncellendi", en: "Profile updated", de: "Profil aktualisiert", ru: "Профиль обновлён", it: "Profilo aggiornato", fr: "Profil mis à jour", ar: "تم تحديث الملف", zh: "资料已更新" },
  "settings.languageSection": { tr: "Dil", en: "Language", de: "Sprache", ru: "Язык", it: "Lingua", fr: "Langue", ar: "اللغة", zh: "语言" },
  "settings.languageHint": { tr: "Arayüz dili cihaz diliyle eşleşti; buradan değiştirebilirsin.", en: "Interface language matched your device; change it here.", de: "Sprache wurde vom Gerät übernommen.", ru: "Язык совпадает с устройством; смените здесь.", it: "Lingua rilevata dal dispositivo; cambiala qui.", fr: "Langue détectée sur l'appareil ; change-la ici.", ar: "تمت مطابقة اللغة مع جهازك؛ غيّرها هنا.", zh: "界面语言已匹配设备，可在此更改。" },

  "settings.theme": { tr: "Tema", en: "Theme", de: "Design", ru: "Тема", it: "Tema", fr: "Thème", ar: "المظهر", zh: "主题" },
  "settings.themeLight": { tr: "Açık", en: "Light", de: "Hell", ru: "Светлая", it: "Chiaro", fr: "Clair", ar: "فاتح", zh: "浅色" },
  "settings.themeDark": { tr: "Karanlık", en: "Dark", de: "Dunkel", ru: "Тёмная", it: "Scuro", fr: "Sombre", ar: "داكن", zh: "深色" },

  "cat.general": { tr: "Genel Kültür", en: "General Knowledge", de: "Allgemeinwissen", ru: "Общие знания", it: "Cultura generale", fr: "Culture générale", ar: "معرفة عامة", zh: "常识" },
  "cat.science": { tr: "Bilim", en: "Science", de: "Wissenschaft", ru: "Наука", it: "Scienza", fr: "Science", ar: "علوم", zh: "科学" },
  "cat.history": { tr: "Tarih", en: "History", de: "Geschichte", ru: "История", it: "Storia", fr: "Histoire", ar: "تاريخ", zh: "历史" },
  "cat.language": { tr: "Dil", en: "Language", de: "Sprache", ru: "Язык", it: "Lingua", fr: "Langue", ar: "لغة", zh: "语言" },
  "cat.math": { tr: "Matematik", en: "Math", de: "Mathematik", ru: "Математика", it: "Matematica", fr: "Mathématiques", ar: "رياضيات", zh: "数学" },
  "cat.geography": { tr: "Coğrafya", en: "Geography", de: "Geografie", ru: "География", it: "Geografia", fr: "Géographie", ar: "جغرافيا", zh: "地理" },
  "cat.astronomy": { tr: "Astronomi", en: "Astronomy", de: "Astronomie", ru: "Астрономия", it: "Astronomia", fr: "Astronomie", ar: "فلك", zh: "天文" },

  "cat.animals": { tr: "Hayvanlar Alemi", en: "Animal Kingdom", de: "Tierwelt", ru: "Животный мир", it: "Regno animale", fr: "Monde animal", ar: "عالم الحيوان", zh: "动物世界" },
  "cat.games": { tr: "Oyun", en: "Gaming", de: "Videospiele", ru: "Игры", it: "Videogiochi", fr: "Jeux vidéo", ar: "ألعاب", zh: "游戏" },
  "cat.tech": { tr: "Teknoloji", en: "Technology", de: "Technologie", ru: "Технологии", it: "Tecnologia", fr: "Technologie", ar: "تقنية", zh: "科技" },
  "cat.physics": { tr: "Fizik", en: "Physics", de: "Physik", ru: "Физика", it: "Fisica", fr: "Physique", ar: "فيزياء", zh: "物理" },
  "cat.chemistry": { tr: "Kimya", en: "Chemistry", de: "Chemie", ru: "Химия", it: "Chimica", fr: "Chimie", ar: "كيمياء", zh: "化学" },
  "cat.biology": { tr: "Biyoloji", en: "Biology", de: "Biologie", ru: "Биология", it: "Biologia", fr: "Biologie", ar: "أحياء", zh: "生物" },
  "cat.literature": { tr: "Edebiyat", en: "Literature", de: "Literatur", ru: "Литература", it: "Letteratura", fr: "Littérature", ar: "أدب", zh: "文学" },
  "cat.movies": { tr: "Filmler ve Diziler", en: "Movies & Shows", de: "Filme & Serien", ru: "Фильмы и сериалы", it: "Film e serie", fr: "Films et séries", ar: "أفلام ومسلسلات", zh: "影视" },

  "diff.kolay": { tr: "Kolay", en: "Easy", de: "Leicht", ru: "Легко", it: "Facile", fr: "Facile", ar: "سهل", zh: "简单" },
  "diff.orta": { tr: "Orta", en: "Medium", de: "Mittel", ru: "Средне", it: "Medio", fr: "Moyen", ar: "متوسط", zh: "中等" },
  "diff.zor": { tr: "Zor", en: "Hard", de: "Schwer", ru: "Сложно", it: "Difficile", fr: "Difficile", ar: "صعب", zh: "困难" },
  "diff.uzman": { tr: "Uzman", en: "Expert", de: "Experte", ru: "Эксперт", it: "Esperto", fr: "Expert", ar: "خبير", zh: "专家" },

  "notif.title": { tr: "Bildirimler", en: "Notifications", de: "Benachrichtigungen", ru: "Уведомления", it: "Notifiche", fr: "Notifications", ar: "الإشعارات", zh: "通知" },
  "notif.empty": { tr: "Henüz bildirim yok", en: "No notifications yet", de: "Noch keine Benachrichtigungen", ru: "Уведомлений пока нет", it: "Nessuna notifica", fr: "Aucune notification", ar: "لا توجد إشعارات بعد", zh: "暂无通知" },
  "notif.emptyHint": { tr: "Puan kazandığında, yorum aldığında veya biri seninle soru paylaştığında burada göreceksin.", en: "You'll see updates when you earn points, get comments, or someone shares with you.", de: "Hier siehst du Punkte, Kommentare und geteilte Fragen.", ru: "Здесь будут очки, комментарии и общие вопросы.", it: "Vedrai punti, commenti e condivisioni.", fr: "Tu verras tes points, commentaires et partages.", ar: "ستظهر هنا نقاطك وتعليقاتك ومشاركاتك.", zh: "积分、评论和分享都会显示在这里。" },
  "notif.markAllRead": { tr: "Tümünü okundu işaretle", en: "Mark all as read", de: "Alle als gelesen", ru: "Отметить все прочитанным", it: "Segna tutto come letto", fr: "Tout marquer comme lu", ar: "تحديد الكل كمقروء", zh: "全部标记为已读" },
  "notif.justNow": { tr: "Az önce", en: "Just now", de: "Gerade eben", ru: "Только что", it: "Proprio ora", fr: "À l'instant", ar: "الآن", zh: "刚刚" },
  "notif.minsAgo": { tr: "{n} dk önce", en: "{n}m ago", de: "Vor {n} Min.", ru: "{n} мин. назад", it: "{n} min fa", fr: "Il y a {n} min", ar: "منذ {n} دقيقة", zh: "{n}分钟前" },
  "notif.hoursAgo": { tr: "{n} saat önce", en: "{n}h ago", de: "Vor {n} Std.", ru: "{n} ч. назад", it: "{n} ore fa", fr: "Il y a {n}h", ar: "منذ {n} ساعة", zh: "{n}小时前" },
  "notif.daysAgo": { tr: "{n} gün önce", en: "{n}d ago", de: "Vor {n} Tagen", ru: "{n} дн. назад", it: "{n} giorni fa", fr: "Il y a {n}j", ar: "منذ {n} يوم", zh: "{n}天前" },

  "auth.phone": { tr: "Telefon numarası", en: "Phone number", de: "Telefonnummer", ru: "Номер телефона", it: "Numero di telefono", fr: "Numéro de téléphone", ar: "رقم الهاتف", zh: "手机号码" },
  "auth.phoneHint": { tr: "Hesap güvenliği için telefon numarası zorunludur.", en: "Phone number is required for account security.", de: "Telefonnummer ist für die Kontosicherheit erforderlich.", ru: "Номер телефона обязателен для безопасности.", it: "Il numero è obbligatorio per la sicurezza.", fr: "Le numéro est requis pour la sécurité.", ar: "رقم الهاتف مطلوب لأمان الحساب.", zh: "出于账户安全需要手机号码。" },
  "auth.sendCode": { tr: "Doğrulama kodu gönder", en: "Send verification code", de: "Code senden", ru: "Отправить код", it: "Invia codice", fr: "Envoyer le code", ar: "إرسال الرمز", zh: "发送验证码" },
  "auth.verifyTitle": { tr: "E-postanı doğrula", en: "Verify your email", de: "E-Mail bestätigen", ru: "Подтвердите почту", it: "Verifica l'email", fr: "Vérifie ton e-mail", ar: "تحقق من بريدك", zh: "验证你的邮箱" },
  "auth.verifySubtitle": { tr: "{email} adresine 6 haneli bir kod gönderdik.", en: "We sent a 6-digit code to {email}.", de: "Wir haben einen 6-stelligen Code an {email} gesendet.", ru: "Мы отправили 6-значный код на {email}.", it: "Abbiamo inviato un codice a 6 cifre a {email}.", fr: "Nous avons envoyé un code à 6 chiffres à {email}.", ar: "أرسلنا رمزاً من 6 أرقام إلى {email}.", zh: "我们已向 {email} 发送6位验证码。" },
  "auth.code": { tr: "6 haneli kod", en: "6-digit code", de: "6-stelliger Code", ru: "6-значный код", it: "Codice a 6 cifre", fr: "Code à 6 chiffres", ar: "رمز من 6 أرقام", zh: "6位验证码" },
  "auth.verifyButton": { tr: "Doğrula ve kaydol", en: "Verify & sign up", de: "Bestätigen & registrieren", ru: "Подтвердить и войти", it: "Verifica e registrati", fr: "Vérifier et s'inscrire", ar: "تحقق وسجّل", zh: "验证并注册" },
  "auth.resend": { tr: "Kodu yeniden gönder", en: "Resend code", de: "Code erneut senden", ru: "Отправить снова", it: "Invia di nuovo", fr: "Renvoyer le code", ar: "إعادة إرسال الرمز", zh: "重新发送" },
  "auth.codeSent": { tr: "Doğrulama kodu gönderildi", en: "Verification code sent", de: "Code gesendet", ru: "Код отправлен", it: "Codice inviato", fr: "Code envoyé", ar: "تم إرسال الرمز", zh: "验证码已发送" },
  "auth.changeEmail": { tr: "E-postayı değiştir", en: "Change email", de: "E-Mail ändern", ru: "Изменить почту", it: "Cambia email", fr: "Changer d'e-mail", ar: "تغيير البريد", zh: "更改邮箱" },

  "guest.gateTitle": { tr: "Keşfe devam etmek için kayıt ol", en: "Sign up to keep exploring", de: "Registriere dich, um weiter zu entdecken", ru: "Зарегистрируйтесь, чтобы продолжить", it: "Registrati per continuare", fr: "Inscris-toi pour continuer", ar: "سجّل لتتابع الاستكشاف", zh: "注册以继续探索" },
  "guest.gateText": { tr: "Misafir olarak 5 soruyu yanıtladın. Puanlarını kaydetmek, soru paylaşmak ve rütbe atlamak için ücretsiz bir hesap oluştur.", en: "You've answered 5 questions as a guest. Create a free account to save your points, share questions and climb ranks.", de: "Du hast 5 Fragen als Gast beantwortet. Erstelle ein kostenloses Konto, um Punkte zu sichern.", ru: "Вы ответили на 5 вопросов как гость. Создайте бесплатный аккаунт, чтобы сохранять очки.", it: "Hai risposto a 5 domande come ospite. Crea un account gratuito per salvare i punti.", fr: "Tu as répondu à 5 questions en invité. Crée un compte gratuit pour garder tes points.", ar: "أجبت عن 5 أسئلة كضيف. أنشئ حساباً مجانياً لحفظ نقاطك.", zh: "你已以游客身份回答了5题。创建免费账户以保存积分、分享问题并晋级。" },
  "guest.register": { tr: "Ücretsiz kayıt ol", en: "Sign up free", de: "Kostenlos registrieren", ru: "Бесплатная регистрация", it: "Registrati gratis", fr: "Inscription gratuite", ar: "سجّل مجاناً", zh: "免费注册" },
  "guest.later": { tr: "Daha sonra", en: "Maybe later", de: "Später", ru: "Позже", it: "Più tardi", fr: "Plus tard", ar: "لاحقاً", zh: "以后再说" },

  "settings.accountSection": { tr: "Hesap bilgileri", en: "Account details", de: "Kontodaten", ru: "Данные аккаунта", it: "Dati account", fr: "Détails du compte", ar: "تفاصيل الحساب", zh: "账户信息" },
  "settings.securitySection": { tr: "Güvenlik", en: "Security", de: "Sicherheit", ru: "Безопасность", it: "Sicurezza", fr: "Sécurité", ar: "الأمان", zh: "安全" },
  "settings.photo": { tr: "Profil fotoğrafı", en: "Profile photo", de: "Profilbild", ru: "Фото профиля", it: "Foto profilo", fr: "Photo de profil", ar: "صورة الملف", zh: "头像" },
  "settings.changePhoto": { tr: "Fotoğrafı değiştir", en: "Change photo", de: "Bild ändern", ru: "Изменить фото", it: "Cambia foto", fr: "Changer la photo", ar: "تغيير الصورة", zh: "更换头像" },
  "settings.photoUpdated": { tr: "Profil fotoğrafı güncellendi", en: "Profile photo updated", de: "Profilbild aktualisiert", ru: "Фото обновлено", it: "Foto aggiornata", fr: "Photo mise à jour", ar: "تم تحديث الصورة", zh: "头像已更新" },
  "settings.email": { tr: "E-posta", en: "Email", de: "E-Mail", ru: "Почта", it: "Email", fr: "E-mail", ar: "البريد الإلكتروني", zh: "邮箱" },
  "settings.phone": { tr: "Telefon", en: "Phone", de: "Telefon", ru: "Телефон", it: "Telefono", fr: "Téléphone", ar: "الهاتف", zh: "手机" },
  "settings.password": { tr: "Şifre", en: "Password", de: "Passwort", ru: "Пароль", it: "Password", fr: "Mot de passe", ar: "كلمة المرور", zh: "密码" },
  "settings.change": { tr: "Değiştir", en: "Change", de: "Ändern", ru: "Изменить", it: "Cambia", fr: "Modifier", ar: "تغيير", zh: "更改" },
  "settings.notSet": { tr: "Belirtilmedi", en: "Not set", de: "Nicht festgelegt", ru: "Не указано", it: "Non impostato", fr: "Non défini", ar: "غير محدد", zh: "未设置" },
  "settings.guestNotice": { tr: "Bu özellikleri kullanmak için ücretsiz bir hesap oluşturmalısın.", en: "Create a free account to use these features.", de: "Erstelle ein Konto, um diese Funktionen zu nutzen.", ru: "Создайте аккаунт, чтобы использовать эти функции.", it: "Crea un account per usare queste funzioni.", fr: "Crée un compte pour utiliser ces fonctions.", ar: "أنشئ حساباً لاستخدام هذه الميزات.", zh: "创建账户以使用这些功能。" },
  "settings.changeEmailTitle": { tr: "E-postanı değiştir", en: "Change email", de: "E-Mail ändern", ru: "Изменить почту", it: "Cambia email", fr: "Changer d'e-mail", ar: "تغيير البريد", zh: "更改邮箱" },
  "settings.changePhoneTitle": { tr: "Telefonunu değiştir", en: "Change phone", de: "Telefon ändern", ru: "Изменить телефон", it: "Cambia telefono", fr: "Changer de téléphone", ar: "تغيير الهاتف", zh: "更改手机" },
  "settings.changePasswordTitle": { tr: "Şifreni değiştir", en: "Change password", de: "Passwort ändern", ru: "Изменить пароль", it: "Cambia password", fr: "Changer le mot de passe", ar: "تغيير كلمة المرور", zh: "更改密码" },
  "settings.newEmail": { tr: "Yeni e-posta", en: "New email", de: "Neue E-Mail", ru: "Новая почта", it: "Nuova email", fr: "Nouvel e-mail", ar: "بريد جديد", zh: "新邮箱" },
  "settings.newPhone": { tr: "Yeni telefon numarası", en: "New phone number", de: "Neue Telefonnummer", ru: "Новый номер", it: "Nuovo numero", fr: "Nouveau numéro", ar: "رقم جديد", zh: "新手机号" },
  "settings.currentPassword": { tr: "Mevcut şifre", en: "Current password", de: "Aktuelles Passwort", ru: "Текущий пароль", it: "Password attuale", fr: "Mot de passe actuel", ar: "كلمة المرور الحالية", zh: "当前密码" },
  "settings.newPassword": { tr: "Yeni şifre (en az 6 karakter)", en: "New password (min 6 chars)", de: "Neues Passwort (mind. 6)", ru: "Новый пароль (мин. 6)", it: "Nuova password (min 6)", fr: "Nouveau mot de passe (min 6)", ar: "كلمة مرور جديدة (6 أحرف)", zh: "新密码（至少6位）" },
  "settings.verifyHint": { tr: "Güvenlik için mevcut e-postana ({email}) bir doğrulama kodu göndereceğiz.", en: "For security we'll send a code to your current email ({email}).", de: "Zur Sicherheit senden wir einen Code an {email}.", ru: "Для безопасности отправим код на {email}.", it: "Per sicurezza invieremo un codice a {email}.", fr: "Par sécurité, un code sera envoyé à {email}.", ar: "للأمان سنرسل رمزاً إلى {email}.", zh: "出于安全，我们会向 {email} 发送验证码。" },
  "settings.codeSentTo": { tr: "{email} adresine kod gönderildi", en: "Code sent to {email}", de: "Code an {email} gesendet", ru: "Код отправлен на {email}", it: "Codice inviato a {email}", fr: "Code envoyé à {email}", ar: "تم إرسال الرمز إلى {email}", zh: "验证码已发送至 {email}" },
  "settings.enterCode": { tr: "6 haneli kodu gir", en: "Enter the 6-digit code", de: "6-stelligen Code eingeben", ru: "Введите 6-значный код", it: "Inserisci il codice a 6 cifre", fr: "Saisis le code à 6 chiffres", ar: "أدخل الرمز المكوّن من 6 أرقام", zh: "输入6位验证码" },
  "settings.sendCode": { tr: "Doğrulama kodu gönder", en: "Send verification code", de: "Code senden", ru: "Отправить код", it: "Invia codice", fr: "Envoyer le code", ar: "إرسال الرمز", zh: "发送验证码" },
  "settings.confirm": { tr: "Onayla ve değiştir", en: "Confirm & change", de: "Bestätigen & ändern", ru: "Подтвердить и изменить", it: "Conferma e cambia", fr: "Confirmer et modifier", ar: "تأكيد وتغيير", zh: "确认并更改" },
  "settings.save": { tr: "Kaydet", en: "Save", de: "Speichern", ru: "Сохранить", it: "Salva", fr: "Enregistrer", ar: "حفظ", zh: "保存" },
  "settings.changed": { tr: "Güncellendi", en: "Updated", de: "Aktualisiert", ru: "Обновлено", it: "Aggiornato", fr: "Mis à jour", ar: "تم التحديث", zh: "已更新" },
  "settings.passwordChanged": { tr: "Şifren güncellendi", en: "Password updated", de: "Passwort aktualisiert", ru: "Пароль обновлён", it: "Password aggiornata", fr: "Mot de passe mis à jour", ar: "تم تحديث كلمة المرور", zh: "密码已更新" },
  "settings.passwordMismatch": { tr: "Şifre en az 6 karakter olmalı", en: "Password must be at least 6 characters", de: "Passwort mind. 6 Zeichen", ru: "Пароль минимум 6 символов", it: "Password almeno 6 caratteri", fr: "Mot de passe min 6 caractères", ar: "كلمة المرور 6 أحرف على الأقل", zh: "密码至少6位" },

  "legal.terms": { tr: "Kullanım Koşulları", en: "Terms of Service", de: "Nutzungsbedingungen", ru: "Условия использования", it: "Termini di servizio", fr: "Conditions d'utilisation", ar: "شروط الخدمة", zh: "服务条款" },
  "legal.privacy": { tr: "Gizlilik", en: "Privacy", de: "Datenschutz", ru: "Конфиденциальность", it: "Privacy", fr: "Confidentialité", ar: "الخصوصية", zh: "隐私" },
  "auth.identifier": { tr: "E-posta, telefon veya kullanıcı adı", en: "Email, phone or username", de: "E-Mail, Telefon oder Nutzername", ru: "Почта, телефон или имя", it: "Email, telefono o username", fr: "E-mail, téléphone ou pseudo", ar: "البريد أو الهاتف أو اسم المستخدم", zh: "邮箱、手机或用户名" },
  "auth.forgot": { tr: "Şifremi unuttum?", en: "Forgot password?", de: "Passwort vergessen?", ru: "Забыли пароль?", it: "Password dimenticata?", fr: "Mot de passe oublié ?", ar: "نسيت كلمة المرور؟", zh: "忘记密码？" },
  "auth.forgotTitle": { tr: "Şifreni sıfırla", en: "Reset your password", de: "Passwort zurücksetzen", ru: "Сброс пароля", it: "Reimposta la password", fr: "Réinitialiser le mot de passe", ar: "إعادة تعيين كلمة المرور", zh: "重置密码" },
  "auth.forgotSub": { tr: "E-posta ve kullanıcı adını gir; e-postana bir sıfırlama kodu gönderelim.", en: "Enter your email and username; we'll send a reset code to your email.", de: "Gib E-Mail und Nutzernamen ein; wir senden einen Code.", ru: "Введите почту и имя; мы отправим код.", it: "Inserisci email e username; invieremo un codice.", fr: "Saisis ton e-mail et pseudo ; on envoie un code.", ar: "أدخل بريدك واسم المستخدم؛ سنرسل رمزاً.", zh: "输入邮箱和用户名，我们会发送验证码。" },
  "auth.backToLogin": { tr: "Girişe dön", en: "Back to login", de: "Zurück zum Login", ru: "Назад ко входу", it: "Torna al login", fr: "Retour à la connexion", ar: "العودة لتسجيل الدخول", zh: "返回登录" },
  "auth.newPassword": { tr: "Yeni şifre", en: "New password", de: "Neues Passwort", ru: "Новый пароль", it: "Nuova password", fr: "Nouveau mot de passe", ar: "كلمة مرور جديدة", zh: "新密码" },
  "auth.resetButton": { tr: "Şifreyi sıfırla", en: "Reset password", de: "Passwort zurücksetzen", ru: "Сбросить пароль", it: "Reimposta", fr: "Réinitialiser", ar: "إعادة التعيين", zh: "重置密码" },
  "auth.passwordRule": { tr: "Şifre en az 8 karakter; harf, rakam ve özel karakter içermeli.", en: "Password: min 8 chars with a letter, number and special character.", de: "Passwort: mind. 8 Zeichen mit Buchstabe, Zahl und Sonderzeichen.", ru: "Пароль: минимум 8 символов, буква, цифра и спецсимвол.", it: "Password: min 8 caratteri con lettera, numero e speciale.", fr: "Mot de passe : min 8 caractères avec lettre, chiffre et spécial.", ar: "كلمة المرور: 8 أحرف على الأقل مع حرف ورقم ورمز خاص.", zh: "密码：至少8位，含字母、数字和特殊字符。" },
  "auth.unameOk": { tr: "Bu kullanıcı adı uygun ✓", en: "Username available ✓", de: "Nutzername verfügbar ✓", ru: "Имя свободно ✓", it: "Username disponibile ✓", fr: "Pseudo disponible ✓", ar: "اسم المستخدم متاح ✓", zh: "用户名可用 ✓" },
  "auth.unameTaken": { tr: "Alınmış. Öneri: {s}", en: "Taken. Try: {s}", de: "Vergeben. Vorschlag: {s}", ru: "Занято. Попробуйте: {s}", it: "Occupato. Prova: {s}", fr: "Pris. Essaie : {s}", ar: "مستخدم. جرّب: {s}", zh: "已被占用，试试：{s}" },
  "auth.gender_male": { tr: "Erkek", en: "Male", de: "Männlich", ru: "Мужской", it: "Uomo", fr: "Homme", ar: "ذكر", zh: "男" },
  "auth.gender_female": { tr: "Kadın", en: "Female", de: "Weiblich", ru: "Женский", it: "Donna", fr: "Femme", ar: "أنثى", zh: "女" },
};

function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode?.toLowerCase() ?? "tr";
  return (SUPPORTED_LANGS as readonly string[]).includes(code) ? (code as Lang) : "en";
}

type I18nContextValue = {
  lang: Lang;
  ready: boolean;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  lang: "tr",
  ready: false,
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.secureGet<string | null>(LANG_KEY, null);
      setLangState(saved && (SUPPORTED_LANGS as readonly string[]).includes(saved) ? (saved as Lang) : deviceLang());
      setReady(true);
    })();
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    storage.secureSet(LANG_KEY, next);
  };

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    ready,
    setLang,
    t: (key, vars) => {
      let text = DICT[key]?.[lang] ?? DICT[key]?.tr ?? key;
      if (vars) {
        for (const [name, val] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(val));
        }
      }
      return text;
    },
  }), [lang, ready]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
