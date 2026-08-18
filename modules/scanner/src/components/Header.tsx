import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
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
  const displayBadge = badgeText || (user ? `OP: ${(user as any).username || user.email}` : 'OP: Desconectado');
  const orgName = user && (user as any).tenantSlug ? ((user as any).tenantSlug).toUpperCase() : 'SUPERADMIN';

  const isOmarchy = theme.borderRadius === 4;
  const isSoftMinimal = theme.borderRadius === 12;

  const handleLogoutPress = () => {
    logout();
    if (onLogout) onLogout();
  };

  const paddingTopVal = Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 8 : 48;

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder, paddingTop: paddingTopVal }]}>
      <View style={styles.brandGroup}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.titleWhite,
              {
                color: theme.textMain,
                fontFamily: isOmarchy ? 'Press Start 2P' : (isSoftMinimal ? 'Plus Jakarta Sans' : 'Outfit'),
                fontSize: isOmarchy ? 13 : 20,
                letterSpacing: isOmarchy ? 1 : -0.5
              }
            ]}
          >
            HOLO<Text style={[styles.titleGreen, { color: theme.emerald }]}>SPACE</Text>
          </Text>
          <View style={[styles.moduleBadge, { borderColor: theme.emerald, borderRadius: isOmarchy ? 4 : (isSoftMinimal ? 20 : 6) }]}>
            <Text style={[styles.moduleBadgeText, { color: theme.emerald }]}>{orgName}</Text>
          </View>
        </View>
        <Text style={[styles.operatorText, { color: theme.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
          {displayBadge}
        </Text>
      </View>
      <TouchableOpacity style={[styles.btnLogout, { borderColor: theme.red, borderRadius: isOmarchy ? 4 : (isSoftMinimal ? 20 : 8) }]} onPress={handleLogoutPress} activeOpacity={0.7}>
        <Text style={[styles.btnLogoutText, { color: theme.red }]}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    gap: 6,
    flexWrap: 'wrap'
  },
  titleWhite: {
    fontSize: 15,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center'
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  operatorText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  btnLogout: {
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0
  },
  btnLogoutText: {
    fontSize: 10,
    fontWeight: '900'
  }
});
