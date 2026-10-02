import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface MarkProps {
  size?: number;
  ink: string;
  accent: string;
}

// Icono de logistica: codigo de barras con linea de lectura (familia holospace.)
export const LogisticaMark: React.FC<MarkProps> = ({ size = 26, ink, accent }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Path fill={ink} d="M9 9h5v46H9zM17 9h2v46h-2zM22 9h3v46h-3zM39 9h3v46h-3zM45 9h2v46h-2zM50 9h5v46h-5z" />
    <Path d="M4 32h56" stroke={accent} strokeWidth={3} />
  </Svg>
);

interface WordmarkProps {
  ink: string;
  accent: string;
  fontSize?: number;
  fontFamily?: string;
}

// Wordmark "holospace." en minuscula con punto de acento
export const Wordmark: React.FC<WordmarkProps> = ({ ink, accent, fontSize = 20, fontFamily }) => (
  <Text
    style={[
      styles.word,
      { color: ink, fontSize, letterSpacing: -fontSize * 0.05, ...(fontFamily ? { fontFamily } : null) },
    ]}
  >
    holospace<Text style={{ color: accent }}>.</Text>
  </Text>
);

export const BrandLockup: React.FC<WordmarkProps & { markSize?: number }> = ({ ink, accent, fontSize = 20, fontFamily, markSize = 26 }) => (
  <View style={styles.row}>
    <LogisticaMark size={markSize} ink={ink} accent={accent} />
    <Wordmark ink={ink} accent={accent} fontSize={fontSize} fontFamily={fontFamily} />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontWeight: '600' },
});
