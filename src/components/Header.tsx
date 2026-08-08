import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

interface HeaderProps {
  title?: string;
  badgeText?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Phone-Ware Depósito',
  badgeText
}) => {
  const { user, logout } = useAuthStore();
  const displayBadge = badgeText || (user ? user.email : 'OP: javier@drinklovers.com');

  return (
    <View style={styles.container}>
      <View style={styles.brandGroup}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoText}>PW</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <TouchableOpacity style={styles.badge} onPress={logout} activeOpacity={0.7}>
        <Text style={styles.badgeText}>{displayBadge} (Salir)</Text>
      </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: '900'
  },
  badge: {
    backgroundColor: '#21262D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00E676'
  },
  badgeText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '700'
  }
});
