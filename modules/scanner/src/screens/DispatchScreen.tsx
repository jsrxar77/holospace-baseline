import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, SafeAreaView } from 'react-native';
import { showThemedAlert } from '../components/ThemedAlertModal';
import { useOrderStore } from '../store/useOrderStore';
import { useThemeStore } from '../store/useThemeStore';

interface DispatchScreenProps {
  onNavigate?: (screen: 'HOME' | 'SUMMARY' | 'SCANNER' | 'DISPATCH') => void;
  onBackToHome?: () => void;
}

export const DispatchScreen: React.FC<DispatchScreenProps> = ({ onNavigate, onBackToHome }) => {
  const goHome = () => {
    if (onNavigate) onNavigate('HOME');
    else if (onBackToHome) onBackToHome();
  };
  const { activeOrder, setActiveOrder, closeOrder } = useOrderStore();
  const { theme } = useThemeStore();

  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (theme.borderRadius || 4);
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (theme.borderRadius || 4);
  const badgeRadius = theme.radiusBadge !== undefined ? theme.radiusBadge : (theme.borderRadius || 2);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono');
  const fontFamilyMono = theme.fontMono || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'monospace');

  if (!activeOrder) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.title, { color: theme.textMain, fontFamily: fontFamilyMain }]}>No elegiste ningún pedido.</Text>
          <TouchableOpacity style={[styles.btnHome, { backgroundColor: theme.emerald, borderRadius: btnRadius, marginTop: 16 }]} onPress={goHome}>
            <Text style={[styles.btnHomeText, { fontFamily: fontFamilyMain, color: theme.background }]}>Volver a mis pedidos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isPartial = activeOrder.status === 'PARTIAL_DISPATCH';

  const handleCorroborateAndFinish = () => {
    setActiveOrder(null);
    goHome();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: isPartial ? theme.amber : theme.emerald, borderRadius: cardRadius, borderWidth: borderWidthVal }]}>
          {/* Top Status Badge */}
          <View style={[styles.iconCircle, { borderColor: isPartial ? theme.amber : theme.emerald, backgroundColor: isPartial ? 'rgba(245, 158, 11, 0.15)' : 'rgba(166, 218, 149, 0.15)', borderRadius: badgeRadius, borderWidth: borderWidthVal }]}>
            <Text style={[styles.iconText, { color: isPartial ? theme.amber : theme.emerald, fontFamily: fontFamilyMono }]}>
              {isPartial ? '!' : 'OK'}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.textMain, fontFamily: fontFamilyMain }]}>
            {isPartial
              ? `¡Pedido #${(activeOrder.id || '').substring(0, 8).toUpperCase()} cerrado con faltantes!`
              : `¡Pedido #${(activeOrder.id || '').substring(0, 8).toUpperCase()} completo!`}
          </Text>

          <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>
            {isPartial
              ? 'Se cerró con la autorización de un supervisor porque faltaban productos en el depósito.'
              : 'Escaneaste todos los productos y todo coincide con el pedido.'}
          </Text>

          {/* Audit Summary Details Box */}
          <View style={[styles.detailsBox, { backgroundColor: theme.background, borderColor: theme.cardBorder, borderRadius: cardRadius, borderWidth: borderWidthVal }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Preparado por:</Text>
              <Text style={[styles.detailValue, { color: theme.emerald, fontFamily: fontFamilyMono }]} numberOfLines={1} ellipsizeMode="tail">
                {activeOrder.operatorEmail || 'operario@holospace.com.ar'}
              </Text>
            </View>

            <View style={styles.detailBlock}>
              <Text style={[styles.detailLabel, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Cliente:</Text>
              <Text style={[styles.detailValueBlock, { color: theme.textMain, fontFamily: fontFamilyMain }]}>{activeOrder.clientName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Unidades escaneadas:</Text>
              <Text style={[styles.detailValue, { color: theme.emerald, fontFamily: fontFamilyMono }]}>
                {activeOrder.totalItemsScanned} / {activeOrder.totalItemsRequired} U (
                {Math.round((activeOrder.totalItemsScanned / activeOrder.totalItemsRequired) * 100)}%)
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Estado:</Text>
              <Text style={[styles.detailValue, { color: isPartial ? theme.amber : theme.emerald, fontFamily: fontFamilyMono }]}>
                {isPartial ? 'DESPACHO PARCIAL OK' : 'APROBADO AL 100%'}
              </Text>
            </View>

            <View style={styles.detailBlock}>
              <Text style={[styles.detailLabel, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Remito:</Text>
              <Text style={[styles.detailValuePath, { color: theme.textMuted, fontFamily: fontFamilyMono }]} numberOfLines={1} ellipsizeMode="middle">
                {activeOrder.pdfFileName || `Pedido #${activeOrder.orderNumber}`}
              </Text>
            </View>

            {activeOrder.exceptionReason && (
              <View style={styles.detailBlock}>
                <Text style={[styles.detailLabel, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Motivo del cierre parcial:</Text>
                <Text style={[styles.detailValue, { color: theme.emerald, fontFamily: fontFamilyMono }]}>{activeOrder.exceptionReason}</Text>
              </View>
            )}
          </View>

          {/* Action Button */}
          <TouchableOpacity style={[styles.btnHome, { backgroundColor: theme.emerald, borderRadius: btnRadius, borderWidth: borderWidthVal, borderColor: theme.emerald }]} onPress={handleCorroborateAndFinish} activeOpacity={0.8}>
            <Text style={[styles.btnHomeText, { color: theme.background, fontFamily: fontFamilyMain }]}>VOLVER A MIS PEDIDOS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  emptyContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalCard: {
    width: '100%',
    padding: 20,
    alignItems: 'center'
  },
  iconCircle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  iconText: {
    fontSize: 22,
    fontWeight: '900'
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 22
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
    paddingHorizontal: 8
  },
  detailsBox: {
    width: '100%',
    padding: 14,
    gap: 10,
    marginBottom: 20
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailBlock: {
    gap: 2
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600'
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700'
  },
  detailValueBlock: {
    fontSize: 13,
    fontWeight: '800'
  },
  detailValuePath: {
    fontSize: 11
  },
  btnHome: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnHomeText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5
  }
});
