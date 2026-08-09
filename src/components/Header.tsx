import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

interface HeaderProps {
  title?: string;
  badgeText?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  badgeText,
  onLogout
}) => {
  const { user, logout } = useAuthStore();
  const displayBadge = badgeText || (user ? user.email : 'OP: jsrxar@gmail.com');

  const handleLogoutPress = () => {
    logout();
    if (onLogout) onLogout();
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandGroup}>
        <Text style={styles.titleWhite} numberOfLines={1} ellipsizeMode="tail">
          PHONEWARE <Text style={styles.titleGreen}>SCANNER</Text>
        </Text>
        <Text style={styles.badgeText} numberOfLines={1} ellipsizeMode="tail">
          👤 {displayBadge}
        </Text>
      </View>
      <TouchableOpacity style={styles.btnLogout} onPress={handleLogoutPress} activeOpacity={0.7}>
        <Text style={styles.btnLogoutText}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: '#161B22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brandGroup: {
    flex: 1,
    marginRight: 10,
    justifyContent: 'center'
  },
  titleWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  titleGreen: {
    color: '#00E676',
    fontWeight: '900'
  },
  badgeText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  btnLogout: {
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF5252',
    flexShrink: 0
  },
  btnLogoutText: {
    color: '#FF5252',
    fontSize: 11,
    fontWeight: '900'
  }
});
