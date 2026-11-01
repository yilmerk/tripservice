# Rota

React 19, Vite, TypeScript, Tailwind CSS 4 ve Firebase 12 ile seyahat planlama uygulaması başlangıcı.

## Çalıştırma

```sh
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` içindeki `VITE_FIREBASE_*` alanlarını Firebase Console → Project settings → Your apps → Web app yapılandırmanızla doldurun. Ortam değişkenlerini değiştirdikten sonra Vite sunucusunu yeniden başlatın. Firebase bilgileri olmadan giriş ekranı görüntülenir; giriş işlemi yapılandırma mesajı verir.

Firebase Console'da:

1. Authentication → Sign-in method altında Google ve Email/Password sağlayıcılarını etkinleştirin. Google için destek e-postasını seçin.
2. Authentication → Settings → Authorized domains altında `localhost` ve yayın alan adınızı ekleyin.
3. Cloud Firestore veritabanını oluşturun. `src/firebase.ts`, `db` bağlantısını dışarı aktarır.
4. Firestore kullanmadan önce erişim kurallarınızı yayınlayın. Ana panel seyahat, şehir ve mekan bilgilerini bu veritabanında saklar.

`VITE_` değişkenleri tarayıcıya gönderilir. Firebase web yapılandırması erişim yetkisi sağlamaz; güvenliği Firestore kuralları ve Authentication ile kurun. Servis hesabı anahtarlarını bu değişkenlere koymayın.

## Yapı

- `src/firebase.ts`: Firebase uygulaması, Auth, Google sağlayıcısı ve Firestore.
- `src/context/AuthContext.tsx`: `onAuthStateChanged` aboneliği; `user`, `loading`, `error`, `signInWithGoogle`, `signInWithEmail`, `register`, `logout` ve `useAuth`.
- `src/App.tsx`: oturum yüklenirken bekleme ekranı, oturum yoksa giriş/kayıt, oturum varsa ana panel. Tarayıcı oturum kalıcılığı Firebase Auth tarafından yönetilir.

```sh
npm run build
npm run preview
```

Gerçek giriş/kayıt doğrulaması için yapılandırılmış Firebase projesi gerekir. Google açılır pencerelerinin tarayıcıda izinli olduğundan emin olun. Manuel kontrol: kayıt oluşturun, sayfayı yenileyerek oturumun korunduğunu doğrulayın, çıkış yapın; e-posta ve Google girişini ayrı ayrı deneyin. Geçersiz şifre ve kapatılan Google penceresinde hata mesajını kontrol edin.

Karşılama ekranının arka plan fotoğrafı Unsplash üzerinden yüklenir; çevrimdışıyken arka plan rengi görüntülenir.

## Seyahat verisi ve servis

Her seyahat `users/{userId}/trips/{tripId}` belgesinde tutulur:

```text
trip: title, description?, startDate?, endDate?, createdAt, updatedAt
  destinations[]: id, city, country, hotels[], airportNotes?, localTransportNotes?, intercityNotes?
    hotels[]: name, address?, checkIn?, checkOut?, reservationCode?, notes?, location?
    places[]: id, name, category, address?, notes?, fee?, mustVisit, visited, location?
      fee: { amount, currency }  // ör. { amount: 20, currency: 'EUR' }
```

Tipler `src/types/trip.ts`, servis `src/services/tripService.ts` içindedir. Tarihler `YYYY-MM-DD` takvim tarihi, zaman damgaları Firestore sunucu zamanıdır. Ücret belirtilmezse bilinmiyor, sıfırsa ücretsiz demektir.

```ts
import { createTrip, addDestination, addPlace, markPlaceVisited, updateTrip, deleteTrip, getTrips } from './services/tripService';

const tripId = await createTrip(user.uid, { title: 'İtalya rotası', startDate: '2026-11-01', endDate: '2026-11-07' });
const destinationId = await addDestination(user.uid, tripId, {
  city: 'Roma', country: 'İtalya', hotels: [{ name: 'Roma Otel' }],
  airportNotes: 'Fiumicino → Leonardo Express', localTransportNotes: 'Metro ve yürüyüş',
});
const placeId = await addPlace(user.uid, tripId, destinationId, {
  name: 'Kolezyum', category: 'attraction', fee: { amount: 18, currency: 'EUR' },
  mustVisit: true, visited: false,
});
await markPlaceVisited(user.uid, tripId, destinationId, placeId); // true
await markPlaceVisited(user.uid, tripId, destinationId, placeId, false); // geri al
await updateTrip(user.uid, tripId, { title: 'Roma tatili' });
const trips = await getTrips(user.uid); // en yeni önce
await deleteTrip(user.uid, tripId);
```

`getTrip` bulunamayan belge için `null` döndürür; güncelleme ve mekan işaretleme bulunamayan kayıtta hata verir. Silme idempotenttir. Güncellemelerde `undefined` alanlar atlanır; bir açıklamayı temizlemek için boş metin gönderilebilir. `updateTrip` yalnızca seyahat başlığı, açıklaması ve tarihlerini değiştirir.

Destinasyon ve mekan ekleme/ziyaret işlemleri transaction ile yapılır; çakışma halinde Firestore güncel belgeyi tekrar okur. Diziler sayesinde silme tek atomik işlemdir, geride alt koleksiyon kalmaz. Her seyahat Firestore'un **1 MiB belge sınırına** tabidir; çok büyük listeler için ileride alt koleksiyonlara geçilmelidir. Panel bu servise canlı Firestore aboneliğiyle bağlanır.

`firestore.rules` yalnızca oturum açan kullanıcıya kendi seyahat belgelerinde erişim verir. Bu kuralları Firebase Console → Firestore → Rules üzerinden yayınlayın; dosyanın yerelde bulunması kuralları otomatik uygulamaz. İstemci tarafındaki sahiplik kontrolü kuralların yerine geçmez.

`npm test` servis davranışlarını Firestore taklidiyle sınar; gerçek sunucu transaction tekrarlarını ve güvenlik kurallarını doğrulamak için Firebase Emulator entegrasyon testi gerekir.


## Şehir paneli ve Google Maps

Sidebar üzerinden seyahat ve sıralı şehir durakları seçilir. “Yeni seyahat”, “Şehir ekle” ve “Şehir bilgilerini düzenle” formları Firestore'a kaydeder. Otel, havalimanı transferi, şehir içi ulaşım/ödeme ve şehirler arası geçiş notları şehir rehberinde gösterilir. Otel formu ilk oteli düzenler; varsa diğer otelleri korur ve panelde hepsini gösterir.

Mekan formu Müze, Gezilecek Yer, Yemek, Kahve ve Tatlı kategorilerini, isteğe bağlı ücret/koordinat/not alanlarını ve “Mutlaka gidilmeli” seçimini destekler. “Tümü”, “Mutlaka Gidilmeli” ve “Yeme-İçme” filtreleri uygulanır. Eski `food-and-drink` kategorisi de yeme-içme filtresine dahildir. Ziyaret durumu listeden işaretlenebilir veya geri alınabilir.

Harita için:

1. Google Cloud projenizde faturalandırmayı ve **Maps JavaScript API**, **Places API (New)**, **Geocoding API** hizmetlerini etkinleştirin.
2. Tarayıcı API anahtarı oluşturup HTTP referrer kısıtlarını yerel geliştirme ve yayın alan adınıza göre ayarlayın; anahtarın API kısıtlarında Maps JavaScript API, Places API (New) ve Geocoding API hizmetlerine izin verin.
3. `.env.local` içine `VITE_GOOGLE_MAPS_API_KEY=...` ekleyip Vite'ı yeniden başlatın. Üretim için bu değişkeni derlemeden önce sağlayın.

Harita `@react-google-maps/api` kullanır. Mekan ekleme/düzenleme ve otel formundaki **Haritada yer ara** alanında yeni Places otomatik tamamlaması kullanılır. Sonuç seçince konum ve açık adres otomatik doldurulur. Haritaya tıklayınca koordinat seçilir ve Geocoding ile adres alınır. Seçim sürerken kaydetme kapalıdır; adres alınamazsa konum korunur ve adres elle girilebilir. Anahtar yoksa elle adres/koordinat girişi çalışmaya devam eder. Tüm haritalar aynı, sabit `places` kütüphaneli yükleyiciyi kullanır; formla şehir haritasının eşzamanlı açılması ikinci bir Maps betiği yüklemez.

Şehir haritası listedeki filtreden bağımsız olarak tüm konumları gösterir: 🏨 otel, ⭐ mutlaka gidilmeli, 🏛️ müze, 📍 gezilecek yer, 🍽️ yemek, ☕ kahve ve 🍰 tatlı. Otel ve yıldız önceliği kategori ikonundan önce gelir. Bilgi penceresinde isim, kategori, `famousFor` (neyiyle meşhur), adres, notlar ve ücret/durum bilgileri bulunur. **Google Maps'te Yol Tarifi Al** seçili koordinata yeni sekmede yol tarifi açar. Yeni `famousFor` alanı isteğe bağlıdır; eski kayıtlar göç gerektirmez. Koordinatsız eski mekanları listedeki **Düzenle**, oteli **Şehir bilgilerini düzenle** üzerinden haritadan konum seçerek tamamlayabilirsiniz.

UI testleri şehir seçimi, filtreler, kayıt hatası, mekan ekleme ve pin popup/yol tarifi davranışlarını taklit edilmiş Auth, Firestore ve Maps ile doğrular. Gerçek Maps yükleme/alan adı yetkisi ve gerçek Firestore işlemleri için yapılandırılmış projeyle tarayıcı kontrolü gerekir.

## Gece / gündüz modu

Giriş ekranında ve panelin üst çubuğundaki tema butonu aktif modu “☀️ Gündüz” veya “🌙 Gece” olarak gösterir; tıklandığında diğer moda geçer. Tercih `localStorage` içinde `rota-theme` anahtarıyla saklanır. Kayıtlı tercih yoksa sistemin `prefers-color-scheme` tercihi izlenir; manuel seçim sistem değişikliklerinden etkilenmez. Diğer sekmelerdeki tercih değişiklikleri de eşitlenir. Depolama engellenirse buton mevcut oturumda çalışmaya devam eder.

`ThemeProvider` kök HTML elemanındaki `dark` sınıfını ve `color-scheme` değerini yönetir. `public/theme-init.js`, React yüklenmeden önce temayı uygular. Tailwind v4 için `tailwind.config.js` içindeki `darkMode: 'class'` ayarı `src/index.css` üzerinden `@config` ile yüklenir; `dark:` varyantı kök sınıfına bağlıdır. Kartlar, formlar, diyaloglar, giriş ekranı, şehir paneli ve Google Maps görünümü gece paletine uyarlanmıştır. Geçişler azaltılmış hareket tercihini dikkate alır.

## Vercel'e yayınlama

1. Vercel → **Add New → Project** ile `yilmerk/tripservice` GitHub deposunu içe aktarın.
2. Production Branch: **main**, Root Directory: **./**, Node.js: **22.x**. `vercel.json`, Framework **Vite**, Install Command **npm ci**, Build Command **npm run build**, Output Directory **dist** ayarlarını içerir.
3. **Environment Variables** alanına kendi projenizin aşağıdaki değişkenlerini ekleyin. Production ve kullanacaksanız Preview ortamlarını seçin:

   ```text
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   VITE_GOOGLE_MAPS_API_KEY
   ```

   Değerleri Firebase Console → Project settings → Your apps ve Google Cloud'dan alın. Ortam değişkenleri Vite derlemesi sırasında uygulamaya eklenir; değiştirdiğinizde yeniden deploy edin. Servis hesabı veya özel anahtar eklemeyin. GitHub Actions test/derleme akışı bu değerler olmadan çalışır; gerçek giriş veya Maps erişimini test etmez.
4. **Deploy** seçin. Firebase Console → Authentication → Settings → Authorized domains listesine Vercel yayın alan adını (`projeniz.vercel.app`) ve kullanacağınız özel alan adını ekleyin. Sabit bir preview alanı kullanıyorsanız onu da ekleyin.
5. Google Cloud'da Maps anahtarının HTTP referrer kısıtlarına `https://projeniz.vercel.app/*` ve varsa özel alan adını ekleyin. Maps JavaScript API, Places API (New), Geocoding API ve faturalandırma etkin olmalı.
6. Firestore veritabanını oluşturun ve depodaki `firestore.rules` kurallarını Firebase Console üzerinden yayınlayın. Authentication için Google ve E-posta/Şifre sağlayıcılarını etkinleştirin.
7. Yayında giriş/kayıt, sayfa yenileme, seyahat/şehir/mekan kaydı, ziyaret işaretleme, tema tercihi ve harita pinlerini kontrol edin.

GitHub Actions, `main` dalına gönderilen değişikliklerde ve `main` hedefli pull request'lerde `npm ci`, `npm test` ve `npm run build` çalıştırır. Vercel GitHub bağlantısı kurulduktan sonra `main` güncellemeleri yeni production deployment başlatır. Firebase kuralları Vercel tarafından yayınlanmaz.
