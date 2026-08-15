import { create } from 'zustand';
import { Platform } from 'react-native';
import { SERVER_URL } from '../config';

interface Tenant {
  id: string;
  slug: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR';
  operatorId?: string;
  tenantId?: string;
  tenantSlug?: string;
  entitlements?: string[];
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  entitlements: string[];
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string, tenantSlug?: string) => Promise<boolean>;
  logout: () => void;
}

const CREDENTIALS_KEY_EMAIL = 'hw_saved_mobile_email';
const CREDENTIALS_KEY_TENANT = 'hw_saved_mobile_tenant';

export const saveSavedCredentials = (email: string, tenantSlug: string = '') => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CREDENTIALS_KEY_EMAIL, email);
      if (tenantSlug) window.localStorage.setItem(CREDENTIALS_KEY_TENANT, tenantSlug);
    }
  } catch (e) {}
};

export const getSavedCredentials = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const email = window.localStorage.getItem(CREDENTIALS_KEY_EMAIL) || '';
      const tenantSlug = window.localStorage.getItem(CREDENTIALS_KEY_TENANT) || 'drinklovers';
      return { email, tenantSlug };
    }
  } catch (e) {}
  return { email: '', tenantSlug: 'drinklovers' };
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  entitlements: ['core', 'scanban'],
  token: null,
  isAuthenticated: false,

  login: async (email: string, pass: string, tenantSlug: string = 'drinklovers') => {
    try {
      const response = await fetch(`${SERVER_URL}/api/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Tenant-Slug': tenantSlug
        },
        body: JSON.stringify({ email, password: pass, tenantSlug })
      });
      const data = await response.json();
      if (data.success && data.user) {
        saveSavedCredentials(email, tenantSlug);
        set({
          user: data.user,
          tenant: data.tenant || null,
          entitlements: data.user.entitlements || ['core', 'scanban'],
          token: data.token,
          isAuthenticated: true
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error logging in:', e);
      return false;
    }
  },

  logout: () => {
    set({
      user: null,
      tenant: null,
      entitlements: [],
      token: null,
      isAuthenticated: false
    });
  }
}));
