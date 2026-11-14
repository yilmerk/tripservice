import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import FirebaseBootstrap from './components/FirebaseBootstrap';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><FirebaseBootstrap><AuthProvider><App /></AuthProvider></FirebaseBootstrap></ThemeProvider></StrictMode>);
