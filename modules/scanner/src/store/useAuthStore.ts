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
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

const CREDENTIALS_KEY_EMAIL = 'hs_saved_mobile_email';
const CREDENTIALS_KEY_PASS = 'hs_saved_mobile_pass';
const CREDENTIALS_KEY_TENANT = 'hs_saved_mobile_tenant';

export const saveSavedCredentials = (email: string, pass: string = '', tenantSlug: string = '') => {
  try {
    if (typeof window !== 'undefined') {
      const storage = window.sessionStorage || window.localStorage;
      if (storage) {
        storage.setItem(CREDENTIALS_KEY_EMAIL, email);
        if (pass) {
          storage.setItem(CREDENTIALS_KEY_PASS, pass);
        }
        if (tenantSlug) storage.setItem(CREDENTIALS_KEY_TENANT, tenantSlug);
      }
    }
  } catch (e) { }
};

export const getSavedCredentials = () => {
  try {
    if (typeof window !== 'undefined') {
      const storage = window.sessionStorage || window.localStorage;
      if (storage) {
        const email = storage.getItem(CREDENTIALS_KEY_EMAIL) || (window.localStorage ? window.localStorage.getItem(CREDENTIALS_KEY_EMAIL) : '') || '';
        const password = storage.getItem(CREDENTIALS_KEY_PASS) || (window.localStorage ? window.localStorage.getItem(CREDENTIALS_KEY_PASS) : '') || '';
        const tenantSlug = storage.getItem(CREDENTIALS_KEY_TENANT) || (window.localStorage ? window.localStorage.getItem(CREDENTIALS_KEY_TENANT) : '') || 'poke';
        return { email, password, tenantSlug };
      }
    }
  } catch (e) { }
  return { email: '', password: '', tenantSlug: 'poke' };
};


const getInitialAuthState = () => {
  if (typeof window !== 'undefined') {
    try {
      // 1. Si viene con token SSO en URL
      const urlParams = new URLSearchParams(window.location.search);
      const authToken = urlParams.get('auth_token');
      const authUserStr = urlParams.get('auth_user');
      const authTenantStr = urlParams.get('auth_tenant');

      if (authToken && authUserStr) {
        const authUser = JSON.parse(authUserStr);
        const authTenant = authTenantStr ? JSON.parse(authTenantStr) : null;
        if (window.sessionStorage) {
          window.sessionStorage.setItem('hs_token', authToken);
          window.sessionStorage.setItem('hs_user', authUserStr);
          if (authTenant) window.sessionStorage.setItem('hs_tenant', JSON.stringify(authTenant));
        }

        return {
          user: authUser,
          tenant: authTenant,
          entitlements: authUser.entitlements || ['core', 'scanban'],
          token: authToken,
          isAuthenticated: true
        };
      }

      // 2. Si ya existe sesión guardada en sessionStorage (prioritaria por pestaña) o localStorage
      const storage = window.sessionStorage || window.localStorage;
      const savedToken = storage.getItem('hs_token') || (window.localStorage ? window.localStorage.getItem('hs_token') : null);
      const savedUserStr = storage.getItem('hs_user') || (window.localStorage ? window.localStorage.getItem('hs_user') : null);
      const savedTenantStr = storage.getItem('hs_tenant') || (window.localStorage ? window.localStorage.getItem('hs_tenant') : null);

      if (savedToken && savedUserStr) {
        const user = JSON.parse(savedUserStr);
        const tenant = savedTenantStr ? JSON.parse(savedTenantStr) : null;
        return {
          user,
          tenant,
          entitlements: user.entitlements || ['core', 'scanban'],
          token: savedToken,
          isAuthenticated: true
        };
      }
    } catch (e) {}
  }

  return {
    user: null,
    tenant: null,
    entitlements: ['core', 'scanban'],
    token: null,
    isAuthenticated: false
  };
};

const initialAuth = getInitialAuthState();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialAuth.user,
  tenant: initialAuth.tenant,
  entitlements: initialAuth.entitlements,
  token: initialAuth.token,
  isAuthenticated: initialAuth.isAuthenticated,


  login: async (email: string, pass: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await response.json();
      if (data.success && data.user) {
        saveSavedCredentials(email, pass, data.tenant?.slug || '');
        if (typeof window !== 'undefined') {
          try {
            const storage = window.sessionStorage || window.localStorage;
            if (data.token) storage.setItem('hs_token', data.token);
            storage.setItem('hs_user', JSON.stringify(data.user));
            if (data.tenant) storage.setItem('hs_tenant', JSON.stringify(data.tenant));
          } catch (e) {}
        }
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
    if (typeof window !== 'undefined') {
      try {
        if (window.sessionStorage) {
          window.sessionStorage.removeItem('hs_token');
          window.sessionStorage.removeItem('hs_user');
          window.sessionStorage.removeItem('hs_tenant');
        }
        if (window.localStorage) {
          window.localStorage.removeItem('hs_token');
          window.localStorage.removeItem('hs_user');
          window.localStorage.removeItem('hs_tenant');
        }
      } catch (e) {}
    }
    set({
      user: null,
      tenant: null,
      entitlements: [],
      token: null,
      isAuthenticated: false
    });
  }
}));
