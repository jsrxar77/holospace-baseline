import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

interface HeaderProps {
  title?: string;
  badgeText?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'PHONEWARE SCANNER',
  badgeText,
  onLogout
}) => {
  const { user, logout } = useAuthStore();
  const displayBadge = badgeText || (user ? user.email : 'OP: javier@drinklovers.com');

  const handleLogoutPress = () => {
    logout();
    if (onLogout) onLogout();
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandGroup}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{displayBadge}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.btnLogout} onPress={handleLogoutPress} activeOpacity={0.7}>
        <Text style={styles.btnLogoutText}>CERRAR SESIÓN</Text>
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
    flexDirection: 'column',
    gap: 4
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  badge: {
    alignSelf: 'flex-start'
  },
  badgeText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '700'
  },
  btnLogout: {
    backgroundColor: '#21262D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF5252'
  },
  btnLogoutText: {
    color: '#FF5252',
    fontSize: 11,
    fontWeight: '900'
  }
});
