import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><AuthProvider><App /></AuthProvider></ThemeProvider></StrictMode>);
