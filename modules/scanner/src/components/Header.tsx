import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

interface HeaderProps {
  title?: string;
  badgeText?: string;
  onLogout?: () => void;
}

// Icono Nave Retro Multicolor Oficial
const RetroShipIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 28 28">
    <G transform="rotate(45, 14, 14)">
      <Rect x="12" y="3" width="4" height="4" fill="#8AADF4" />
      <Rect x="10" y="7" width="8" height="6" fill="#CAD3F5" />
      <Rect x="6" y="9" width="16" height="4" fill="#C6A0F6" />
      <Rect x="4" y="13" width="20" height="4" fill="#8AADF4" />
      <Rect x="4" y="17" width="4" height="4" fill="#ED8796" />
      <Rect x="20" y="17" width="4" height="4" fill="#ED8796" />
      <Rect x="2" y="19" width="2" height="4" fill="#F5BDE6" />
      <Rect x="24" y="19" width="2" height="4" fill="#F5BDE6" />
      <Rect x="12" y="17" width="4" height="6" fill="#A6DA95" />
      <Rect x="13" y="23" width="2" height="4" fill="#FE8019" />
      <Rect x="14" y="27" width="1" height="2" fill="#EED49F" />
    </G>
  </Svg>
);

export const Header: React.FC<HeaderProps> = ({
  badgeText,
  onLogout
}) => {
  const { user, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const displayBadge = badgeText || (user ? `OP: ${(user as any).username || user.email}` : 'OP: Desconectado');
  const orgName = user && (user as any).tenantSlug ? ((user as any).tenantSlug).toUpperCase() : 'POKE';

  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : 4;
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : 4;
  const badgeRadius = theme.radiusBadge !== undefined ? theme.radiusBadge : 2;
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || 'JetBrains Mono';
  const fontFamilyMono = theme.fontMono || 'monospace';

  const handleLogoutPress = () => {
    logout();
    if (onLogout) onLogout();
  };

  const paddingTopVal = Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 8 : 44;

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.cardBg,
        borderBottomColor: theme.cardBorder,
        borderBottomWidth: borderWidthVal,
        paddingTop: paddingTopVal
      }
    ]}>
      <View style={styles.brandGroup}>
        <View style={styles.titleRow}>
          <Text style={[styles.titleHolo, { color: theme.textMain, fontFamily: fontFamilyMain }]}>
            Holo<Text style={[styles.titleSpace, { color: theme.emerald }]}>Space</Text>
          </Text>
          <View style={styles.shipWrapper}>
            <RetroShipIcon size={20} />
          </View>
          <View style={[
            styles.moduleBadge,
            {
              backgroundColor: 'rgba(189, 147, 249, 0.15)',
              borderColor: theme.cobalt || '#BD93F9',
              borderRadius: badgeRadius,
              borderWidth: borderWidthVal
            }
          ]}>
            <Text style={[styles.moduleBadgeText, { color: theme.cobalt || '#BD93F9', fontFamily: fontFamilyMono }]}>
              {orgName}
            </Text>
          </View>
        </View>
        <Text style={[styles.operatorText, { color: theme.textMuted, fontFamily: fontFamilyMono }]} numberOfLines={1} ellipsizeMode="tail">
          {displayBadge}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.btnLogout,
          {
            backgroundColor: 'rgba(255, 85, 85, 0.12)',
            borderColor: theme.red,
            borderRadius: btnRadius,
            borderWidth: borderWidthVal
          }
        ]}
        onPress={handleLogoutPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.btnLogoutText, { color: theme.red, fontFamily: fontFamilyMono }]}>
          CERRAR SESIÓN
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    gap: 6
  },
  titleHolo: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  titleSpace: {
    fontWeight: '900'
  },
  shipWrapper: {
    marginRight: 2
  },
  moduleBadge: {
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
    marginTop: 2
  },
  btnLogout: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0
  },
  btnLogoutText: {
    fontSize: 10,
    fontWeight: '900'
  }
});
