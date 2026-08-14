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
  borderRadius: number;
}

export const ORIGINAL_THEME: ThemeTokens = {
  background: '#0B0E14',
  cardBg: '#161B22',
  cardBorder: '#30363D',
  emerald: '#00E676',
  cobalt: '#3B82F6',
  amber: '#F59E0B',
  red: '#FF5252',
  textMain: '#FFFFFF',
  textMuted: '#8B949E',
  borderRadius: 16
};

let currentThemeTokens: ThemeTokens = { ...ORIGINAL_THEME };

export const getThemeTokens = (): ThemeTokens => {
  return currentThemeTokens;
};

export const fetchRemoteTheme = async (baseUrl: string = SERVER_URL): Promise<ThemeTokens> => {
  try {
    const res = await fetch(`${baseUrl}/api/theme`);
    const data = await res.json();
    if (data && data.theme) {
      currentThemeTokens = {
        background: data.theme.background || ORIGINAL_THEME.background,
        cardBg: data.theme.cardBg || ORIGINAL_THEME.cardBg,
        cardBorder: data.theme.cardBorder || ORIGINAL_THEME.cardBorder,
        emerald: data.theme.emerald || ORIGINAL_THEME.emerald,
        cobalt: data.theme.cobalt || ORIGINAL_THEME.cobalt,
        amber: data.theme.amber || ORIGINAL_THEME.amber,
        red: data.theme.red || ORIGINAL_THEME.red,
        textMain: data.theme.textMain || ORIGINAL_THEME.textMain,
        textMuted: data.theme.textMuted || ORIGINAL_THEME.textMuted,
        borderRadius: typeof data.theme.borderRadius === 'number' ? data.theme.borderRadius : ORIGINAL_THEME.borderRadius
      };
    }
  } catch (e) {
    console.log('[THEME SERVICE] Usando tema local por defecto.');
  }
  return currentThemeTokens;
};
