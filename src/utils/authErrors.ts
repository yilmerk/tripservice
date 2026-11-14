export interface AuthIssue { message: string; code?: string }
const invalidCredentials = 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.';
const messages: Record<string, string> = {
  'auth/invalid-credential': invalidCredentials,
  'auth/invalid-login-credentials': invalidCredentials,
  'auth/wrong-password': invalidCredentials,
  'auth/user-not-found': invalidCredentials,
  'auth/invalid-email': 'Geçerli bir e-posta adresi girin.',
  'auth/missing-password': 'Şifrenizi girin.',
  'auth/email-already-in-use': 'Bu e-posta adresiyle bir hesap zaten mevcut.',
  'auth/weak-password': 'Şifreniz en az 6 karakter olmalı.',
  'auth/user-disabled': 'Bu hesabın girişi devre dışı bırakılmış. Uygulama yöneticisiyle iletişime geçin.',
  'auth/popup-closed-by-user': 'Google giriş penceresi kapatıldı. Tekrar deneyebilirsiniz.',
  'auth/cancelled-popup-request': 'Giriş penceresi kapatıldı. Lütfen yeniden deneyin.',
  'auth/popup-blocked': 'Tarayıcı giriş penceresini engelledi. Açılır pencerelere izin verin.',
  'auth/network-request-failed': 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.',
  'auth/operation-not-allowed': 'Bu giriş yöntemi etkin değil. Firebase Authentication ayarlarında E-posta/Şifre veya Google sağlayıcısı etkinleştirilmeli.',
  'auth/password-does-not-meet-requirements': 'Şifreniz uygulamanın şifre politikasını karşılamıyor. Daha güçlü bir şifre seçin.',
  'auth/unauthorized-domain': 'Bu site giriş için yetkilendirilmemiş. Firebase Authentication yetkili alanlarına sitenin adresi eklenmeli.',
  'auth/configuration-not-found': 'Bu Firebase projesinde giriş hizmeti yapılandırılmamış. Firebase Console’da Authentication kurulumu tamamlanmalı.',
  'auth/project-not-found': 'Giriş için kullanılan Firebase projesi bulunamadı. Uygulamanın Firebase proje ayarları kontrol edilmeli.',
  'auth/invalid-api-key': 'Giriş hizmetinin Firebase API anahtarı geçersiz. Yayın ayarlarındaki Firebase web uygulaması bilgileri kontrol edilmeli.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Giriş hizmetinin Firebase API anahtarı geçersiz. Yayın ayarlarındaki Firebase web uygulaması bilgileri kontrol edilmeli.',
  'auth/app-not-authorized': 'Bu sitenin giriş hizmetine erişimine izin verilmiyor. Firebase API anahtarının uygulama ve API kısıtlamaları kontrol edilmeli.',
  'auth/api-key-service-blocked': 'Firebase API anahtarı giriş hizmetine erişemiyor. Anahtarın Identity Toolkit API ve Token Service API izinleri kontrol edilmeli.',
  'auth/account-exists-with-different-credential': 'Bu hesap başka bir giriş yöntemiyle oluşturulmuş. Daha önce kullandığınız yöntemle giriş yapın.',
  'auth/invalid-app-credential': 'Giriş doğrulaması başarısız oldu. Siteyi yenileyip tekrar deneyin; sorun sürerse giriş yapılandırması kontrol edilmeli.',
  'auth/missing-config': 'Giriş hizmeti yapılandırılmamış. Yayın ortamındaki VITE_FIREBASE_* değişkenleri tamamlanıp uygulama yeniden yayınlanmalı.',
  'auth/internal-error': 'Giriş hizmeti beklenmeyen bir yanıt verdi. Bir süre sonra tekrar deneyin; sorun sürerse hata kodunu uygulama yöneticisine iletin.',
};
export function getAuthIssue(error: unknown): AuthIssue {
  // Firebase errors may cross realms or come from different SDK bundles.
  // Read only their code; raw messages/customData can contain request details.
  const value = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const code = typeof value === 'string' && /^auth\/[a-z0-9._:/%-]{1,180}$/i.test(value) ? value : undefined;
  if (!code) return { message: 'Giriş tamamlanamadı. Lütfen yeniden deneyin.' };
  if (code.startsWith('auth/requests-from-referer-') || code === 'auth/requests-to-this-api-identitytoolkit-method-google.cloud.identitytoolkit.v1.authenticationservice.signinwithpassword-are-blocked.') {
    return { code, message: 'Bu sitenin giriş isteği API anahtarı kısıtlamasıyla engelleniyor. Google Cloud’da Firebase anahtarının site ve Identity Toolkit API izinleri kontrol edilmeli.' };
  }
  return { code, message: messages[code] ?? 'Giriş hizmeti isteği reddetti. Aşağıdaki hata kodunu uygulama yöneticisine iletin.' };
}
