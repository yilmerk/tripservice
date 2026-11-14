import { useEffect, useState, type ReactNode } from 'react';
import { Compass, LoaderCircle } from 'lucide-react';
import { initializeFirebase } from '../firebase';
import { getAuthIssue, type AuthIssue } from '../utils/authErrors';

export default function FirebaseBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<AuthIssue | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void initializeFirebase().then(() => { if (active) setReady(true); }).catch(err => { if (active) setError(getAuthIssue(err)); });
    return () => { active = false; };
  }, [retry]);
  if (ready) return children;
  return <div className="loading-screen dark:bg-slate-950 dark:text-slate-100"><Compass size={32}/>{error ? <div className="firebase-startup-error"><div className="error-message" role="alert"><p>{error.message}</p>{error.code && <p className="auth-error-code">Hata kodu: <code>{error.code}</code></p>}</div><button className="outline-button" onClick={() => setRetry(value => value + 1)}>Bağlantıyı yeniden dene</button></div> : <><LoaderCircle className="animate-spin"/><p role="status">Giriş bağlantısı hazırlanıyor…</p></>}</div>;
}
