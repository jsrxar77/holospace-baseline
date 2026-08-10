import { create } from 'zustand';
import { SERVER_URL } from '../config';

export interface ThemeTokens {
  background: string;
  cardBg: string;
  cardBorder: string;
  emerald: string;
  cobalt: string;
  amber: string;
  red: string;
  textMain: string;
  textMuted: string;
}

export const DEFAULT_THEME: ThemeTokens = {
  background: '#0B0E14',
  cardBg: '#161B22',
  cardBorder: '#30363D',
  emerald: '#00E676',
  cobalt: '#3B82F6',
  amber: '#F59E0B',
  red: '#FF5252',
  textMain: '#FFFFFF',
  textMuted: '#8B949E'
};

interface ThemeState {
  theme: ThemeTokens;
  fetchTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  fetchTheme: async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/theme`);
      const data = await res.json();
      if (data && data.theme) {
        set({
          theme: {
            background: data.theme.background || DEFAULT_THEME.background,
            cardBg: data.theme.cardBg || DEFAULT_THEME.cardBg,
            cardBorder: data.theme.cardBorder || DEFAULT_THEME.cardBorder,
            emerald: data.theme.emerald || DEFAULT_THEME.emerald,
            cobalt: data.theme.cobalt || DEFAULT_THEME.cobalt,
            amber: data.theme.amber || DEFAULT_THEME.amber,
            red: data.theme.red || DEFAULT_THEME.red,
            textMain: data.theme.textMain || DEFAULT_THEME.textMain,
            textMuted: data.theme.textMuted || DEFAULT_THEME.textMuted
          }
        });
      }
    } catch (e) {
      console.log('[THEME STORE] Error consultando tema remoto:', e);
    }
  }
}));
