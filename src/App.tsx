import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, Check, Compass, Eye, EyeOff, Globe2, LoaderCircle, LockKeyhole, MapPin, Route } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import ThemeToggle from './components/ThemeToggle';

function Brand() { return <a href="/" className="brand" aria-label="Rota ana sayfa"><span className="brand-icon"><Compass size={25}/></span>rota<span className="brand-dot">.</span></a>; }
function errorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    const messages: Record<string, string> = {
      'auth/invalid-credential': 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.',
      'auth/email-already-in-use': 'Bu e-posta adresiyle bir hesap zaten mevcut.',
      'auth/weak-password': 'Şifreniz en az 6 karakter olmalı.',
      'auth/popup-closed-by-user': 'Google giriş penceresi kapatıldı. Tekrar deneyebilirsiniz.',
      'auth/popup-blocked': 'Tarayıcı giriş penceresini engelledi. Açılır pencerelere izin verin.',
      'auth/network-request-failed': 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.',
      'auth/too-many-requests': 'Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.',
      'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase projesinde etkinleştirilmemiş.',
      'auth/unauthorized-domain': 'Bu alan adını Firebase Authentication yetkili alanlarına ekleyin.',
    };
    return messages[error.code] ?? 'İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.';
  }
  return error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu.';
}
function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, register, error: sessionError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const isRegister = mode === 'register';
  async function run(action: () => Promise<void>) {
    setError(''); setPending(true);
    try { await action(); } catch (err) { setError(errorMessage(err)); } finally { setPending(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    void run(() => isRegister ? register(String(data.get('name')), email, password) : signInWithEmail(email, password));
  }
  return <div className="login-layout">
    <section className="story-panel" aria-label="Yolculuğun burada başlar">
      <div className="landscape"/><div className="story-shade"/>
      <div className="story-top"><Brand/><span className="edition">DAHA ÇOK KEŞFET. DAHA ÇOK YAŞA.</span></div>
      <div className="story-content"><span className="eyebrow"><span/> YOLCULUĞUN BURADA BAŞLAR</span><h1 className="dark:text-slate-100">Bir sonraki<br/>hikâyen,<br/><em>yolda.</em></h1><p>Hayalini kurduğun yerler, biriktireceğin anılar.<br/>Hepsini birlikte planlayalım.</p>
      <div className="destination"><span className="destination-icon"><MapPin size={20}/></span><div><strong>Dolomitler, İtalya</strong><span>46°29′ N &nbsp; 11°51′ E</span></div><span className="destination-line"/><span className="destination-number">01 / 03</span></div></div>
      <div className="story-bottom"><span>Her güzel hikâye bir adımla başlar.</span><ArrowDown size={17}/></div>
    </section>
    <section className="form-panel dark:bg-slate-950 dark:text-slate-100"><header className="form-header"><span>Yeni rotalara, birlikte.</span><div className="header-actions"><span className="language"><Globe2 size={15}/> Türkçe</span><ThemeToggle/></div></header>
      <main className="auth-main"><div className="welcome-icon"><Route size={25}/></div><span className="form-kicker">KEŞFETMEYE HAZIR MISIN?</span><h2 className="dark:text-slate-100">{isRegister ? 'Hikâyene başla.' : 'Yeniden merhaba.'}</h2><p className="form-intro">{isRegister ? 'Yeni yerler, yeni anılar. İlk adımı birlikte atalım.' : 'Bir sonraki maceranı planlamak için giriş yap.'}</p>
      <div className="tabs" role="tablist" aria-label="Hesap işlemleri">{(['login','register'] as const).map(tab => <button key={tab} role="tab" aria-selected={mode === tab} disabled={pending} className={mode === tab ? 'active' : ''} onClick={() => { setMode(tab); setError(''); }}>{tab === 'login' ? 'Giriş yap' : 'Hesap oluştur'}</button>)}</div>
      <button className="google-button" disabled={pending} onClick={() => void run(signInWithGoogle)}><svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.7c3.9-3.6 6-8.8 6-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.6-4.6l-6.7-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.2A20.5 20.5 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.9a12 12 0 0 1 0-7.8v-5.2H5.7a20.4 20.4 0 0 0 0 18.2Z"/><path fill="#EA4335" d="M24 11.7c3 0 5.5 1 7.6 3l5.7-5.6A19.4 19.4 0 0 0 24 4 20.5 20.5 0 0 0 5.7 14.9l6.9 5.2A12 12 0 0 1 24 11.7Z"/></svg>Google ile devam et</button>
      <div className="divider"><span/>veya e-posta ile<span/></div>
      <form onSubmit={submit}>
        {isRegister && <label>Adın ve soyadın<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="name" autoComplete="name" placeholder="Ad Soyad" required maxLength={100}/></label>}
        <label>E-posta adresin<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" type="email" name="email" placeholder="merhaba@ornek.com" autoComplete="email" required/></label>
        <label>Şifren<div className="password-field"><input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="password" type={showPassword ? 'text' : 'password'} placeholder={isRegister ? 'En az 6 karakter' : 'Şifreni gir'} autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={isRegister ? 6 : undefined} required/><button type="button" aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {(error || sessionError) && <p role="alert" className="error-message">{error || sessionError}</p>}
        <button className="primary-button" disabled={pending} type="submit">{pending ? <><LoaderCircle className="animate-spin" size={18}/> İşlem yapılıyor…</> : <>{isRegister ? 'Hesabımı oluştur' : 'Yolculuğa devam et'}<ArrowRight size={18}/></>}</button>
      </form>
      <p className="switch-mode">{isRegister ? 'Zaten bir hesabın var mı?' : 'Henüz bir hesabın yok mu?'} <button disabled={pending} onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}>{isRegister ? 'Giriş yap' : 'Ücretsiz hesap oluştur'}</button></p>
      <div className="trust"><span><Check size={14}/>Ücretsiz başla</span><span><Check size={14}/>Tüm planların bir yerde</span></div>
      </main><footer className="form-footer"><span>© {new Date().getFullYear()} Rota</span><span><LockKeyhole size={12}/> Bilgilerin güvenle saklanır.</span></footer>
    </section>
  </div>;
}
export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen dark:bg-slate-950 dark:text-slate-100" role="status"><Brand/><LoaderCircle className="animate-spin"/><p>Rotan hazırlanıyor…</p></div>;
  return user ? <Dashboard key={user.uid}/> : <LoginScreen/>;
}
