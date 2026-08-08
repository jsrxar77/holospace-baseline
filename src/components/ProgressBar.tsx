import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressBarProps {
  scanned: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ scanned, total }) => {
  const percentage = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {scanned} / {total} <Text style={styles.subText}>Unidades Escaneadas</Text>
        </Text>
        <Text style={styles.pctText}>{percentage}%</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#161B22',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D'
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10
  },
  statsText: {
    color: '#00E676',
    fontSize: 24,
    fontWeight: '900'
  },
  subText: {
    color: '#8B949E',
    fontSize: 14,
    fontWeight: '700'
  },
  pctText: {
    color: '#00E676',
    fontSize: 20,
    fontWeight: '900'
  },
  track: {
    height: 14,
    backgroundColor: '#21262D',
    borderRadius: 10,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    backgroundColor: '#00E676',
    borderRadius: 10
  }
});
