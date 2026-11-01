# Rota

React 19, Vite, TypeScript, Tailwind CSS 4 ve Firebase 12 ile seyahat planlama uygulaması.

## Yerel geliştirme

Node.js 22 kullanın (`.nvmrc` ve `package.json` içinde belirtilir).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local` içindeki `VITE_FIREBASE_*` alanlarını Firebase Console → Project settings → Your apps → Web app bilgileriyle doldurun. Ortam değişkenlerini değiştirdikten sonra Vite'ı yeniden başlatın. Proje bilgileri olmadan giriş ekranı görüntülenir; giriş denemesinde yapılandırma mesajı verilir.

Firebase Console'da:

1. Authentication → Sign-in method altında Google ve Email/Password sağlayıcılarını etkinleştirin. Google için destek e-postasını seçin.
2. Authentication → Settings → Authorized domains listesine `localhost` ve yayın alan adınızı ekleyin.
3. Cloud Firestore veritabanını oluşturun ve `firestore.rules` dosyasındaki kuralları yayınlayın.

`VITE_` değişkenleri tarayıcıya gönderilir. Firebase web yapılandırması erişim yetkisi sağlamaz; verileri Authentication ve Firestore kurallarıyla koruyun. Servis hesabı anahtarlarını bu değişkenlere koymayın.

## Uygulama

Sidebar üzerinden seyahat ve şehir durakları seçilir. Yeni seyahat ve şehir eklenebilir; şehir rehberi düzenlenebilir. Rehberde otel adı, giriş/çıkış tarihleri, rezervasyon kodu, otel notları, havalimanı transferi, şehir içi ulaşım/ödeme ve şehirler arası geçiş notları yer alır. Otel formu ilk oteli düzenler ve varsa diğer otelleri korur.

Mekanlar Müze, Gezilecek Yer, Yemek, Kahve ve Tatlı kategorilerinde eklenebilir ve düzenlenebilir. Ücret, para birimi, “Neyiyle meşhur?”, notlar ve “Mutlaka gidilmeli” alanları desteklenir. “Tümü”, “Mutlaka Gidilmeli” ve “Yeme-İçme” filtreleri kullanılabilir. Eski `food-and-drink` kategorisi yeme-içme filtresine dahildir. Ziyaret durumu işaretlenebilir ve geri alınabilir.

Eski seyahat belgeleri okunmaya devam eder. Belgelerdeki kullanılmayan ek alanlar arayüzde gösterilmez; bu güncelleme toplu veri silme işlemi yapmaz.

## Yapı ve veri modeli

- `src/firebase.ts`: Firebase uygulaması, Auth, Google giriş sağlayıcısı ve Firestore bağlantısı.
- `src/context/AuthContext.tsx`: oturum aboneliği; `user`, `loading`, `error`, Google/e-posta girişi, kayıt ve çıkış.
- `src/context/ThemeContext.tsx`: tema tercihi ve sistem teması takibi.
- `src/components/Dashboard.tsx`: seyahat/şehir seçimi, bilgi kartları ve mekan listesi.
- `src/components/TripForms.tsx`: seyahat, şehir/otel ve mekan formları.
- `src/types/trip.ts`: veri tipleri.
- `src/services/tripService.ts`: Firestore servis katmanı ve canlı abonelik.

Her seyahat `users/{userId}/trips/{tripId}` belgesinde saklanır:

```text
trip: title, description?, startDate?, endDate?, createdAt, updatedAt
  destinations[]: id, city, country, hotels[], airportNotes?, localTransportNotes?, intercityNotes?
    hotels[]: name, checkIn?, checkOut?, reservationCode?, notes?, famousFor?
    places[]: id, name, category, notes?, famousFor?, fee?, mustVisit, visited
      fee: { amount, currency }
```

Tarihler `YYYY-MM-DD` biçiminde takvim tarihidir. Zaman damgaları Firestore sunucu zamanıdır. Ücret belirtilmezse bilinmiyor, sıfırsa ücretsiz demektir.

```ts
import { createTrip, addDestination, addPlace, markPlaceVisited } from './services/tripService';

const tripId = await createTrip(user.uid, { title: 'İtalya rotası' });
const destinationId = await addDestination(user.uid, tripId, {
  city: 'Roma', country: 'İtalya', hotels: [{ name: 'Roma Otel' }],
  airportNotes: 'Leonardo Express', localTransportNotes: 'Metro ve yürüyüş',
});
const placeId = await addPlace(user.uid, tripId, destinationId, {
  name: 'Kolezyum', category: 'attraction', fee: { amount: 18, currency: 'EUR' },
  mustVisit: true, visited: false,
});
await markPlaceVisited(user.uid, tripId, destinationId, placeId);
```

Servis ayrıca `getTrip`, `getTrips`, `subscribeTrips`, `updateTrip`, `deleteTrip`, `updateDestination` ve `updatePlace` fonksiyonlarını sağlar. `getTrip` bulunamayan belge için `null` döndürür; güncellemeler bulunamayan kayıtta hata verir. Silme idempotenttir. `updateTrip` yalnızca başlık, açıklama ve tarihleri değiştirir. Mekan düzenlemesi, başka sekmede değiştirilmiş ziyaret durumunu korur.

Destinasyonlar ve mekanlar dizilerde tutulur; ekleme, düzenleme ve ziyaret işaretleme işlemleri transaction kullanır. Seyahat silinirken harcama alt koleksiyonu 400 kayıtlık gruplar halinde temizlenir; sahiplik kaydı silinmiş durumunda korunur. Her seyahat Firestore'un 1 MiB belge sınırına tabidir.

`firestore.rules` yalnızca oturum açan kullanıcıya kendi seyahat belgelerinde erişim verir. Dosyanın yerelde bulunması kuralları otomatik yayınlamaz.

## Gece / gündüz modu

Giriş ekranı ve panelin üst çubuğundaki buton aktif modu “☀️ Gündüz” veya “🌙 Gece” olarak gösterir. Tercih `localStorage` içinde `rota-theme` anahtarıyla saklanır. Kayıtlı tercih yoksa `prefers-color-scheme` takip edilir; manuel seçim korunur. Tercihler sekmeler arasında eşitlenir. Depolama engellenirse buton mevcut oturumda çalışır.

`ThemeProvider`, kök HTML elemanının `dark` sınıfını ve `color-scheme` değerini yönetir. `public/theme-init.js` ilk yüklemede temayı uygular. Tailwind v4 için `tailwind.config.js` içindeki `darkMode: 'class'`, `src/index.css` dosyasından yüklenir. Geçişler azaltılmış hareket tercihini dikkate alır.

## Doğrulama

```sh
npm test
npm run build
npm run preview
```

Testler oturum ve Firestore taklitleriyle servis davranışlarını, şehir seçimini, filtreleri, formları, kayıt hatalarını ve tema tercihini doğrular. Gerçek giriş ve veritabanı erişimi için Firebase projesiyle tarayıcı kontrolü gerekir. Firebase Emulator testleri ayrıca sunucu erişim kuralları ve transaction tekrarlarını doğrulamalıdır.

Karşılama ekranı fotoğrafı Unsplash üzerinden yüklenir; çevrimdışıyken arka plan rengi görüntülenir.

## Vercel'e yayınlama

1. Vercel → Add New → Project ile `yilmerk/tripservice` deposunu içe aktarın.
2. Production Branch: `main`, Root Directory: `./`, Node.js: `22.x`. `vercel.json`, Vite, `npm ci`, `npm run build` ve `dist` ayarlarını içerir.
3. Environment Variables alanına `.env.example` dosyasındaki altı `VITE_FIREBASE_*` değişkenini ekleyin. Değerleri Firebase Console → Project settings → Your apps bölümünden alın. Değişikliklerden sonra yeniden deploy edin.
4. Firebase Authentication yetkili alanlarına Vercel yayın alanını ve varsa özel alan adını ekleyin; Google ve E-posta/Şifre sağlayıcılarını etkinleştirin.
5. Firestore veritabanını oluşturun ve depodaki `firestore.rules` kurallarını yayınlayın.
6. Yayında giriş/kayıt, oturum kalıcılığı, seyahat/şehir/mekan kaydı, ziyaret durumu ve tema tercihini kontrol edin.

GitHub Actions, `main` gönderimlerinde ve `main` hedefli pull request'lerde `npm ci`, `npm test` ve `npm run build` çalıştırır. Vercel bağlantısı kuruluysa `main` değişiklikleri otomatik dağıtım başlatır. Firebase kuralları Vercel tarafından yayınlanmaz.


## Bütçe ve harcama takibi

Yeni seyahatte hedef bütçe ve varsayılan para birimi seçilebilir; mevcut seyahatlerde bütçe panelinden ayarlanır. Panel seçili seyahatin bütün şehirleri için ortaktır ve şehir eklenmeden de kullanılabilir. Kategoriler: Konaklama, Ulaşım, Yeme-İçme, Müteferrik/Alışveriş, Müze & Etkinlik ve Diğer. Harcamalar eklenebilir, düzenlenebilir ve onayla silinebilir.

Özet; toplam bütçe, harcanan tutar, kalan bütçe, ilerleme çubuğu ve kategori dağılımını gösterir. Kullanım %80'in üzerindeyse sarı, bütçe aşılırsa kırmızı uyarı verilir. Bütçe belirtilmemişse kalan tutar hesaplanmaz; sıfır bütçe ve aşım ayrıca ele alınır. Mekanların planlanan ücretleri otomatik harcama sayılmaz.

Seyahat belgesinde `totalBudget` (ana birim cinsinden sayı), `currency` ve `budgetCurrencyLocked` alanları kullanılır. Eski seyahatlerin varsayılan para birimi EUR'dur; bütçe isteğe bağlıdır.

```text
users/{userId}/trips/{tripId}: totalBudget?, currency?, budgetCurrencyLocked?
trips/{tripId}: ownerId, currency, hasExpenses, status, createdAt
trips/{tripId}/expenses/{expenseId}:
  name, amountMinor, currency, date, category,
  exchangeRate, baseAmountMinor, baseCurrency, createdAt, updatedAt
```

`src/services/expenseService.ts`; `setTripBudget`, `addExpense`, `updateExpense`, `deleteExpense`, `getExpenses`, `subscribeExpenses`, `ensureExpenseLedger` ve seyahatle birlikte alt koleksiyon temizliği fonksiyonlarını sağlar. `addExpense` ve `getExpenses` eski seyahatlerde sahiplik kaydını otomatik oluşturur. Canlı abonelikten önce `ensureExpenseLedger` çağrılır. `trips/{tripId}` belgesi yalnızca finans sahiplik kaydıdır; mevcut seyahat belgeleri taşınmaz. Sahiplik başka kullanıcıya devredilemez. Silinen kaydın sahiplik bilgisi korunarak aynı kimlikle kalan alt kayıtların başka bir hesaba açılması engellenir.

Para tutarları harcamalarda en küçük birimle tam sayı saklanır: EUR/USD/TRY/GBP vb. için kuruş, JPY için yen. İlk harcamadan sonra ana para birimi kalıcı olarak sabitlenir. Harcama farklı para birimindeyse kullanıcı **1 harcama para birimi = kaç seyahat para birimi** kurunu girer. Kur kayıtla saklanır ve geçmiş tutarlar otomatik kur değişimlerinden etkilenmez; dış kur servisi kullanılmaz. Kurla hesaplanan tutar ana para biriminin en küçük birimine yuvarlanır.

**Yayın adımı:** Güncellenen `firestore.rules` dosyasını Firebase Console → Firestore → Rules bölümünde yayınlayın. Vercel bu kuralları yayınlamaz. Kurallar yayınlanana kadar bütçe paneli erişim hatası gösterir; diğer seyahat özellikleri çalışır.

Güvenlik testleri Firestore Emulator ile çalıştırılır:

```sh
npx --yes firebase-tools@15 emulators:exec --project demo-rota --only firestore "npm run test:rules"
```

Java 21 gerekir. GitHub Actions ayrıca bu emülatör testlerini çalıştırır: hesaplar arası erişim, sahte sahiplik, para birimi kilidi, geçersiz tutarlar ve silme sırasındaki yazmalar sınanır.
