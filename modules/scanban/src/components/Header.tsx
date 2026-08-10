import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

interface HeaderProps {
  title?: string;
  badgeText?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  badgeText,
  onLogout
}) => {
  const { user, logout } = useAuthStore();
  const displayBadge = badgeText || (user ? `OP: ${user.email}` : 'OP: jsrxar@gmail.com');

  const handleLogoutPress = () => {
    logout();
    if (onLogout) onLogout();
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandGroup}>
        <View style={styles.titleRow}>
          <Text style={styles.titleWhite} numberOfLines={1}>
            HOLO<Text style={styles.titleGreen}>WARE</Text>
          </Text>
          <View style={styles.moduleBadge}>
            <Text style={styles.moduleBadgeText}>ScanBan Scanner</Text>
          </View>
        </View>
        <Text style={styles.operatorText} numberOfLines={1} ellipsizeMode="tail">
          {displayBadge}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
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
  moduleBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderColor: '#00E676',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'center'
  },
  moduleBadgeText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '800'
  },
  operatorText: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4
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
