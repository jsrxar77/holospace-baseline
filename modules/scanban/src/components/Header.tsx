import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

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
  const { theme } = useThemeStore();
  const displayBadge = badgeText || (user ? `OP: ${user.email}` : 'OP: jsrxar@gmail.com');

  const handleLogoutPress = () => {
    logout();
    if (onLogout) onLogout();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder }]}>
      <View style={styles.brandGroup}>
        <View style={styles.titleRow}>
          <Text style={[styles.titleWhite, { color: theme.textMain }]} numberOfLines={1}>
            HOLO<Text style={[styles.titleGreen, { color: theme.emerald }]}>WARE</Text>
          </Text>
          <View style={[styles.moduleBadge, { borderColor: theme.emerald }]}>
            <Text style={[styles.moduleBadgeText, { color: theme.emerald }]}>ScanBan Scanner</Text>
          </View>
        </View>
        <Text style={[styles.operatorText, { color: theme.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
          {displayBadge}
        </Text>
      </View>
      <TouchableOpacity style={[styles.btnLogout, { borderColor: theme.red }]} onPress={handleLogoutPress} activeOpacity={0.7}>
        <Text style={[styles.btnLogoutText, { color: theme.red }]}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
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
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  titleGreen: {
    fontWeight: '900'
  },
  moduleBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'center'
  },
  moduleBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  operatorText: {
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
    flexShrink: 0
  },
  btnLogoutText: {
    fontSize: 11,
    fontWeight: '900'
  }
});
