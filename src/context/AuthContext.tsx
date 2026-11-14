import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { FirebaseError } from 'firebase/app';
import { getAuthIssue } from '../utils/authErrors';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
function configuredAuth() {
  if (!auth) throw new FirebaseError('auth/missing-config', 'Firebase configuration is missing.');
  return auth;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, current => { setUser(current); setError(null); setLoading(false); }, err => {
      setUser(null); const issue = getAuthIssue(err);
      setError(`${issue.message}${issue.code ? ` (Hata kodu: ${issue.code})` : ''}`); setLoading(false);
    });
  }, []);
  const value: AuthContextValue = {
    user, loading, error,
    signInWithGoogle: async () => { await signInWithPopup(configuredAuth(), googleProvider); },
    signInWithEmail: async (email, password) => { await signInWithEmailAndPassword(configuredAuth(), email, password); },
    register: async (name, email, password) => {
      const credential = await createUserWithEmailAndPassword(configuredAuth(), email, password);
      await updateProfile(credential.user, { displayName: name.trim() });
      setUser(credential.user);
    },
    logout: async () => { await signOut(configuredAuth()); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  return context;
}
