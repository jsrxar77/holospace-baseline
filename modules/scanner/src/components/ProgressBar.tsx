import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';

interface ProgressBarProps {
  scanned: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ scanned, total }) => {
  const { theme } = useThemeStore();
  const percentage = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
  const isComplete = percentage === 100;
  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (theme.borderRadius || 4);
  const badgeRadius = theme.radiusBadge !== undefined ? theme.radiusBadge : (theme.borderRadius || 2);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMono = theme.fontMono || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'monospace');

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
        <Text style={[styles.pctText, { color: isComplete ? theme.emerald : theme.cobalt, fontFamily: fontFamilyMono }]}>
          {percentage}%
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: `${theme.cardBorder}80`, borderRadius: badgeRadius }]}>
        <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: isComplete ? theme.emerald : theme.cobalt, borderRadius: badgeRadius }]} />
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
