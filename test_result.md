#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Session: Faz 2 — stok avatar + bio + takip + beğeni (Ekim 2026)
backend:
  - task: "Yayınlanmış sorular için oturum-bazlı rastgele akış"
    file: "/app/backend/server.py, /app/frontend/src/api.ts, /app/frontend/app/(tabs)/index.tsx"
    implemented: true
    needs_retesting: false
    status_history:
      - working: true
        comment: "GET /api/feed küçük batch'lerle yalnızca aktif/yayınlanmış/görünür/silinmemiş soruları getirir. feed_seen + feed_cycle_state kullanıcı/katman bazlı tekrarı engeller; FlatList sona yaklaşınca 8 yeni kart ekler. Manuel API testi: 18 benzersiz soru, kategori filtresi 6/6 Bilim, üç batch 81 ms; gizli ve pasif soru dışlandı."
      - working: true
        comment: "Kapsamlı test agenti: 3 ardışık batch tekrar içermedi; gizli/pasif/silinmiş/yayında olmayan kayıtlar dışlandı; Bilim filtresi doğru; misafir giriş ve kart akışı geçti."
  - task: "Temiz başlangıç ve tek gerçek admin"
    file: "/app/backend/server.py, /app/backend/reset_clean_start.py, /app/backend/.env"
    implemented: true
    needs_retesting: false
    status_history:
      - working: true
        comment: "750 soru otomatik seed'i kaldırıldı. Kontrollü reset komutu kullanıcılar, sorular, oturumlar ve ilişkili test verilerini temizleyip yalnızca server env'den gelen gerçek admini bırakır."
      - working: true
        comment: "Son temiz durum doğrulandı: 1 kullanıcı, hedef admin 1, normal kullanıcı 0, soru 0, oturum 0. Admin girişi 200 ve boş akış ekranı test edildi; sonrasında test oturumu tekrar silindi."
  - task: "Android APK kimlik doğrulama üretim yönlendirmesi"
    file: "/app/frontend/.env, /app/frontend/src/api.ts, /app/backend/server.py"
    implemented: false
    needs_retesting: true
    status_history:
      - working: false
        comment: "Kullanıcı gerçek Android APK'da kayıt ve misafir girişinin çalışmadığını bildirdi. Kaynak build ayarı EXPO_PUBLIC_BACKEND_URL=https://micro-genius-3.preview.emergentagent.com kullanıyor; üretim backend alan adı/release build yapılandırması tanımlı değil. Genel ağdan mevcut preview /api/auth/guest ve /api/auth/register/request-code 200 döndü; yerel Mongo ping başarılı."
  - task: "Eski kayıt API uyumluluğu ve okunabilir doğrulama hatası"
    file: "/app/backend/server.py, /app/frontend/src/api.ts"
    implemented: true
    needs_retesting: false
    status_history:
      - working: true
        comment: "POST /api/auth/register artık identifier/password sözleşmesini doğru işler; manuel test 200 döndü. FastAPI 422 detail dizileri kullanıcı arayüzünde alan bazlı okunabilir metne dönüştürülüyor; mobil ekran testi [object Object] göstermedi."
  - task: "Soru beğeni (like) toggle + feed liked flag"
    file: "/app/backend/server.py"
    implemented: true
    needs_retesting: true
    status_history:
      - working: "NA"
        comment: "POST /api/questions/{id}/like toggler (question_likes koleksiyonu, likes sayacı inc/dec). /feed artık her soru için liked bool döner. Soru sahibine 'like' bildirimi."
  - task: "Takip sistemi (follow/unfollow) + takipçi sayıları + bildirim"
    file: "/app/backend/server.py"
    implemented: true
    needs_retesting: true
    status_history:
      - working: "NA"
        comment: "POST /api/users/{id}/follow toggler (follows koleksiyonu). /users/{id}/profile ve /auth/me followers_count, following_count, is_following döner. Takip edince hedefe bildirim; takip edilen soru paylaşınca takipçilere 'new_question' bildirimi. Kendini takip 400, olmayan kullanıcı 404."
  - task: "Profil biyografisi (PATCH /users/me bio)"
    file: "/app/backend/server.py"
    implemented: true
    needs_retesting: true
    status_history:
      - working: "NA"
        comment: "ProfileUpdate.bio zaten vardı; public_user bio default '' yapıldı. PATCH /users/me bio kaydeder."
frontend:
  - task: "Feed beğeni butonu + stok avatar seçici + bio alanı + takip butonu"
    file: "/app/frontend/app/(tabs)/index.tsx, /app/frontend/app/settings.tsx, /app/frontend/app/user/[id].tsx, /app/frontend/app/(tabs)/profile.tsx"
    implemented: true
    needs_retesting: false
    status_history:
      - working: "NA"
        comment: "Smoke test (screenshot) ile doğrulandı: feed'de kalp butonu yorumun üstünde; ayarlarda Erkek/Kadın sekmeli stok avatar modalı + galeriden yükle; bio girişi; başka profilde Takip Et butonu + takipçi/takip sayıları."
metadata:
  created_by: "main_agent"
test_plan:
  current_focus:
    - "Yayınlanmış sorular için oturum-bazlı rastgele akış"
    - "Temiz başlangıç ve tek gerçek admin"
    - "Soru beğeni (like) toggle + feed liked flag"
    - "Takip sistemi (follow/unfollow) + takipçi sayıları + bildirim"
    - "Profil biyografisi (PATCH /users/me bio)"
  stuck_tasks: []
agent_communication:
  - agent: "main"
    message: "KAPSAMLI TEST: Mevcut geçici API test verisiyle (24 soru; 1 gizli, 1 pasif) backend random feed test edildi. Şimdi (1) admin girişinden sonra akışın yüklendiğini, (2) 3 batch'te soru ID tekrarının olmadığını, (3) Bilim kategori filtresinin yalnızca Bilim döndürdüğünü, (4) gizli/pasif soru görünmediğini, (5) mevcut login/signup/misafir akışlarının bozulmadığını, (6) temiz başlangıç komutundan sonra 1 admin / 0 normal kullanıcı / 0 soru kaldığını test et. Admin credential /app/memory/test_credentials.md içindedir. TEST BİTİNCE main agent geçici tüm veriyi reset_clean_start.py ile silecektir; yeni kalıcı veri oluşturma."
  - agent: "main"
    message: "ÖNEMLİ FIX: Expo Go'da uygulama açılmıyordu — 'Cannot read property ErrorBoundary of undefined' hatası. Kök neden: app/(tabs)/index.tsx içinde route dosyalarını (app/(tabs)/ranks, app/notifications) doğrudan import etmek expo-router'da circular route import hatasına yol açıyordu. Çözüm: ekran gövdeleri src/screens/ranks-screen.tsx ve src/screens/notifications-screen.tsx'e taşındı; route dosyaları ince re-export oldu; index artık src'den import ediyor. LÜTFEN SADECE FRONTEND test et: (1) Uygulama login ekranında açılıyor mu, misafir girişiyle feed yükleniyor mu (CRASH YOK). (2) Üst menü: solda arama kutusu, ortada rütbe rozeti, sağda 'Bildirimler' butonu görünüyor mu. (3) Arama kutusuna dokununca genişleyen arama overlay'i açılıyor, input'a yazınca kullanıcı/soru sonuçları geliyor, X ile kapanıyor. (4) Rütbe rozetine dokununca rütbe ekranı overlay olarak açılıyor. (5) Bildirimler butonuna dokununca bildirim ekranı overlay olarak açılıyor. (6) Regresyon: beğeni (kalp) butonu, kaydet, yorum hâlâ çalışıyor. Test credentials: swipedia-test@example.com / secret123. OTP/e-posta kodu okumaya çalışma."
