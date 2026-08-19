import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Modal, TouchableWithoutFeedback } from 'react-native';
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
  const { user, tenant, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isOmarchy = theme.borderRadius === 4;
  const isSoftMinimal = theme.borderRadius === 16;

  const orgName = (tenant && tenant.name) || (user && (user as any).tenantName) || (user && (user as any).tenantSlug ? ((user as any).tenantSlug).toUpperCase() : 'POKE ARGENTINA');
  const displayUser = (user as any)?.username || (user?.email ? user.email.split('@')[0] : 'juan');
  const userFullName = user?.name || `Juan (Operario ${orgName})`;
  const userRole = user?.role || 'OPERATOR';
  const userEmail = user?.email || 'juan@poke.com.ar';

  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (isOmarchy ? 4 : 16);
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (isOmarchy ? 4 : (isSoftMinimal ? 20 : 12));
  const badgeRadius = theme.radiusBadge !== undefined ? theme.radiusBadge : (isOmarchy ? 2 : (isSoftMinimal ? 20 : 8));
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;

  const logoFontFamily = isOmarchy ? (Platform.OS === 'web' ? '"Press Start 2P", monospace' : 'Press Start 2P') : (isSoftMinimal ? 'Plus Jakarta Sans' : 'Outfit');
  const fontFamilyMain = theme.fontFamily || (isOmarchy ? (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono') : 'Outfit');
  const fontFamilyMono = isOmarchy ? (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono') : 'monospace';

  const handleLogoutPress = () => {
    setIsDropdownOpen(false);
    logout();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('hs_token');
      window.localStorage.removeItem('hs_user');
      window.localStorage.removeItem('hs_tenant');
      window.localStorage.removeItem('hs_saved_mobile_email');
      window.localStorage.removeItem('hs_saved_mobile_pass');
      window.localStorage.removeItem('hs_saved_mobile_tenant');
      window.location.href = 'https://holospace.com.ar/';
      return;
    }
    if (onLogout) onLogout();
  };

  const paddingTopVal = Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 8 : 44;

  return (
    <>
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
                {orgName.split(' ')[0]}
              </Text>
            </View>
          </View>
        </View>

        {/* Botón de Usuario Desplegable idéntico a Web */}
        <TouchableOpacity
          style={[
            styles.btnUserPill,
            {
              backgroundColor: isOmarchy ? '#181825' : '#21262D',
              borderColor: isOmarchy ? (isDropdownOpen ? theme.emerald : '#313244') : (isDropdownOpen ? theme.emerald : theme.cardBorder),
              borderRadius: btnRadius,
              borderWidth: borderWidthVal
            }
          ]}
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnUserText, { color: isOmarchy ? (theme.primary || '#FF79C6') : '#FF79C6', fontFamily: fontFamilyMono as any }]}>
            {displayUser}
          </Text>
          <Text style={[styles.btnUserArrow, { color: theme.textMuted, fontFamily: fontFamilyMono as any }]}>
            {isDropdownOpen ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal / Popover de Usuario Idéntico al de Web */}
      <Modal
        visible={isDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsDropdownOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[
                styles.dropdownCard,
                {
                  backgroundColor: isOmarchy ? '#181825' : theme.cardBg,
                  borderColor: isOmarchy ? (theme.primary || '#FF79C6') : theme.cardBorder,
                  borderRadius: cardRadius,
                  borderWidth: borderWidthVal,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.5,
                  shadowRadius: 16
                }
              ]}>
                {/* Cabecera con Nombre y Badge de Rol */}
                <View style={styles.dropdownHeaderRow}>
                  <View style={styles.dropdownUserInfo}>
                    <Text style={[styles.dropdownName, { color: theme.textMain, fontFamily: fontFamilyMain as any }]}>
                      {userFullName}
                    </Text>
                    <Text style={[styles.dropdownUsername, { color: theme.textMuted, fontFamily: fontFamilyMono as any }]}>
                      (@{displayUser})
                    </Text>
                  </View>

                  <View style={[
                    styles.roleBadge,
                    {
                      backgroundColor: 'rgba(166, 218, 149, 0.15)',
                      borderColor: theme.emerald,
                      borderRadius: badgeRadius,
                      borderWidth: borderWidthVal
                    }
                  ]}>
                    <Text style={[styles.roleBadgeText, { color: theme.emerald, fontFamily: fontFamilyMono as any }]}>
                      {userRole}
                    </Text>
                  </View>
                </View>

                {/* Email del Usuario */}
                <Text style={[styles.dropdownEmail, { color: theme.textMuted, fontFamily: fontFamilyMono as any }]}>
                  {userEmail}
                </Text>

                {/* Organización */}
                <Text style={[styles.dropdownOrg, { color: theme.emerald, fontFamily: fontFamilyMain as any }]}>
                  ORGANIZACIÓN: {orgName.toUpperCase()}
                </Text>

                {/* Línea Divisoria */}
                <View style={[styles.divider, { backgroundColor: isOmarchy ? '#313244' : theme.cardBorder }]} />

                {/* Botón Rojo de Cerrar Sesión */}
                <TouchableOpacity
                  style={[
                    styles.btnLogout,
                    {
                      borderColor: isOmarchy ? (theme.red || '#FF5555') : '#FF5252',
                      backgroundColor: 'rgba(255, 85, 85, 0.08)',
                      borderRadius: btnRadius,
                      borderWidth: borderWidthVal
                    }
                  ]}
                  onPress={handleLogoutPress}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnLogoutText, { color: isOmarchy ? (theme.red || '#FF5555') : '#FF5252', fontFamily: fontFamilyMain as any }]}>
                    Cerrar Sesión
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10
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
    fontSize: 13,
    fontWeight: '800'
  },
  btnUserArrow: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 1
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 88,
    paddingRight: 20
  },
  dropdownCard: {
    width: 320,
    maxWidth: '92%',
    padding: 18,
    gap: 10
  },
  dropdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8
  },
  dropdownUserInfo: {
    flex: 1
  },
  dropdownName: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18
  },
  dropdownUsername: {
    fontSize: 12,
    marginTop: 2
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start'
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  dropdownEmail: {
    fontSize: 12
  },
  dropdownOrg: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2
  },
  divider: {
    height: 1,
    marginVertical: 4
  },
  btnLogout: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  btnLogoutText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  }
});
