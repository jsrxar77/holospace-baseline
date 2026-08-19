import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';

interface ProgressBarProps {
  scanned: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ scanned, total }) => {
  const { theme } = useThemeStore();
  const percentage = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
  const isOmarchy = theme.borderRadius === 4;
  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (isOmarchy ? 4 : 18);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMono = theme.fontMono || 'monospace';

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.cardBg,
        borderColor: theme.cardBorder,
        borderRadius: cardRadius,
        borderWidth: borderWidthVal
      }
    ]}>
      <View style={styles.statsRow}>
        <Text style={[styles.statsText, { color: theme.emerald, fontFamily: fontFamilyMono }]}>
          {scanned} / {total} <Text style={[styles.subText, { color: theme.textMuted }]}>Unidades Escaneadas</Text>
        </Text>
        <Text style={[styles.pctText, { color: theme.emerald, fontFamily: fontFamilyMono }]}>{percentage}%</Text>
      </View>

      <View style={[styles.track, { backgroundColor: isOmarchy ? '#11111B' : '#21262D', borderRadius: isOmarchy ? 2 : 10 }]}>
        <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: theme.emerald, borderRadius: isOmarchy ? 2 : 10 }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10
  },
  statsText: {
    fontSize: 22,
    fontWeight: '900'
  },
  subText: {
    fontSize: 13,
    fontWeight: '700'
  },
  pctText: {
    fontSize: 18,
    fontWeight: '900'
  },
  track: {
    height: 12,
    overflow: 'hidden'
  },
  fill: {
    height: '100%'
  }
});
