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
const RetroShipIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
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

  const isOmarchy = theme.borderRadius === 4;
  const isSoftMinimal = theme.borderRadius === 16;

  const orgName = user && (user as any).tenantSlug ? ((user as any).tenantSlug).toUpperCase() : 'POKE';
  const displayUser = (user as any)?.username || (user?.email ? user.email.split('@')[0] : 'operario');

  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (isOmarchy ? 4 : (isSoftMinimal ? 20 : 16));
  const badgeRadius = theme.radiusBadge !== undefined ? theme.radiusBadge : (isOmarchy ? 4 : (isSoftMinimal ? 20 : 8));
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;

  // En web, 'Press Start 2P' se aplica con comillas o fallback monospace
  const logoFontFamily = isOmarchy ? (Platform.OS === 'web' ? '"Press Start 2P", monospace' : 'Press Start 2P') : (isSoftMinimal ? 'Plus Jakarta Sans' : 'Outfit');
  const fontFamilyMono = isOmarchy ? (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono') : 'monospace';

  const handleLogoutPress = () => {
    logout();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('hs_token');
      window.localStorage.removeItem('hs_user');
      window.localStorage.removeItem('hs_tenant');
      window.location.href = 'https://holospace.com.ar/login?redirect=' + encodeURIComponent(window.location.href);
      return;
    }
    if (onLogout) onLogout();
  };

  const paddingTopVal = Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 8 : 44;

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isOmarchy ? '#11111B' : theme.cardBg,
        borderBottomColor: isOmarchy ? '#313244' : theme.cardBorder,
        borderBottomWidth: isOmarchy ? 2 : borderWidthVal,
        paddingTop: paddingTopVal
      }
    ]}>
      <View style={styles.brandGroup}>
        <View style={styles.titleRow}>
          <Text style={[
            styles.titleHolo,
            {
              color: isOmarchy ? '#F8F8F2' : theme.textMain,
              fontFamily: logoFontFamily as any,
              fontSize: isOmarchy ? 18 : 22,
              letterSpacing: isOmarchy ? 1 : -0.5,
              textShadowColor: isOmarchy ? '#313244' : 'transparent',
              textShadowOffset: isOmarchy ? { width: 2, height: 2 } : { width: 0, height: 0 },
              textShadowRadius: 0
            }
          ]}>
            Holo<Text style={[
              styles.titleSpace,
              {
                color: theme.emerald,
                textShadowColor: isOmarchy ? '#1E4620' : 'transparent',
                textShadowOffset: isOmarchy ? { width: 2, height: 2 } : { width: 0, height: 0 },
                textShadowRadius: 0
              }
            ]}>Space</Text>
          </Text>
          <View style={styles.shipWrapper}>
            <RetroShipIcon size={26} />
          </View>
          <View style={[
            styles.moduleBadge,
            {
              backgroundColor: 'rgba(203, 166, 247, 0.15)',
              borderColor: '#CBA6F7',
              borderRadius: badgeRadius,
              borderWidth: borderWidthVal
            }
          ]}>
            <Text style={[styles.moduleBadgeText, { color: '#CBA6F7', fontFamily: fontFamilyMono as any }]}>
              {orgName}
            </Text>
          </View>
        </View>
      </View>

      {/* Botón de Usuario / Salida idéntico al control de Header Web */}
      <TouchableOpacity
        style={[
          styles.btnUserPill,
          {
            backgroundColor: isOmarchy ? '#181825' : '#21262D',
            borderColor: isOmarchy ? '#313244' : theme.cardBorder,
            borderRadius: btnRadius,
            borderWidth: borderWidthVal
          }
        ]}
        onPress={handleLogoutPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.btnUserText, { color: isOmarchy ? '#CDD6F4' : '#FFFFFF', fontFamily: fontFamilyMono as any }]}>
          {displayUser}
        </Text>
        <Text style={[styles.btnExitTag, { color: theme.red, fontFamily: fontFamilyMono as any }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 14,
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
  titleHolo: {
    fontWeight: '900'
  },
  titleSpace: {
    fontWeight: '900'
  },
  shipWrapper: {
    marginLeft: 2,
    marginRight: 4
  },
  moduleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'center'
  },
  moduleBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  btnUserPill: {
    height: 34,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  btnUserText: {
    fontSize: 12,
    fontWeight: '700'
  },
  btnExitTag: {
    fontSize: 12,
    fontWeight: '900'
  }
});
