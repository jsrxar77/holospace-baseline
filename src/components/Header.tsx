import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface HeaderProps {
  title?: string;
  badgeText?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Phone-Ware Depósito',
  badgeText = 'Depósito #1'
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.brandGroup}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoText}>PW</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badgeText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#161B22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  logoIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#00E676',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '900'
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900'
  },
  badge: {
    backgroundColor: '#21262D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30363D'
  },
  badgeText: {
    color: '#8B949E',
    fontSize: 13,
    fontWeight: '700'
  }
});
