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
  fontFamily?: string;
  fontMono?: string;
  borderRadius: number;
  radiusCard?: number;
  radiusBtn?: number;
  radiusBadge?: number;
  borderWidth?: number;
}

export const DEFAULT_THEME: ThemeTokens = {
  background: '#121317',
  cardBg: '#1A1B22',
  cardBorder: '#2E303E',
  emerald: '#A6DA95',
  cobalt: '#BD93F9',
  amber: '#F1FA8C',
  red: '#FF5555',
  textMain: '#F8F8F2',
  textMuted: '#6272A4',
  fontFamily: 'JetBrains Mono',
  fontMono: 'JetBrains Mono',
  borderRadius: 4,
  radiusCard: 4,
  radiusBtn: 4,
  radiusBadge: 2,
  borderWidth: 1
};

interface ThemeState {
  theme: ThemeTokens;
  fetchTheme: (token?: string | null) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  fetchTheme: async (token?: string | null) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${SERVER_URL}/api/theme`, { headers });
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
            textMuted: data.theme.textMuted || DEFAULT_THEME.textMuted,
            fontFamily: data.theme.fontFamily || DEFAULT_THEME.fontFamily,
            fontMono: data.theme.fontMono || DEFAULT_THEME.fontMono,
            borderRadius: typeof data.theme.borderRadius === 'number' ? data.theme.borderRadius : DEFAULT_THEME.borderRadius,
            radiusCard: typeof data.theme.radiusCard === 'number' ? data.theme.radiusCard : (data.theme.borderRadius || 4),
            radiusBtn: typeof data.theme.radiusBtn === 'number' ? data.theme.radiusBtn : (data.theme.borderRadius || 4),
            radiusBadge: typeof data.theme.radiusBadge === 'number' ? data.theme.radiusBadge : (data.theme.borderRadius || 2),
            borderWidth: typeof data.theme.borderWidth === 'number' ? data.theme.borderWidth : 1
          }
        });
      }
    } catch (e) {
      console.log('[THEME STORE] Error consultando tema remoto:', e);
    }
  }
}));
