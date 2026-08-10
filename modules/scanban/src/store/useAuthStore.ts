import { create } from 'zustand';
import { Platform } from 'react-native';
import { SERVER_URL } from '../config';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR';
  operatorId: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

const CREDENTIALS_KEY_EMAIL = 'hw_saved_mobile_email';
const CREDENTIALS_KEY_PASS = 'hw_saved_mobile_pass';

export const saveSavedCredentials = (email: string, pass: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CREDENTIALS_KEY_EMAIL, email);
      window.localStorage.setItem(CREDENTIALS_KEY_PASS, pass);
    }
  } catch (e) {}
};

export const getSavedCredentials = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const email = window.localStorage.getItem(CREDENTIALS_KEY_EMAIL) || 'jsrxar@gmail.com';
      const pass = window.localStorage.getItem(CREDENTIALS_KEY_PASS) || 'Asadito21!';
      return { email, pass };
    }
  } catch (e) {}
  return { email: 'jsrxar@gmail.com', pass: 'Asadito21!' };
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email: string, pass: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await response.json();
      if (data.success && data.user) {
        saveSavedCredentials(email, pass);
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true
        });
        return true;
      }
    } catch (e) {
      console.log('Error en login de operario:', e);
    }
    return false;
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
  }
}));
