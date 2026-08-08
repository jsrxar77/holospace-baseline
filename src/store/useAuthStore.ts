import { create } from 'zustand';
import { Platform } from 'react-native';

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

const SERVER_URL = 'http://192.168.100.247:3001';

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: 'u-op-1',
    email: 'javier@drinklovers.com',
    name: 'Javier Operario',
    role: 'OPERATOR',
    operatorId: 'JAVIER-DEV82'
  },
  token: 'token_default_javier',
  isAuthenticated: true,

  login: async (email: string, pass: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await response.json();
      if (data.success && data.user) {
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
