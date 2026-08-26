import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { showThemedAlert } from '../components/ThemedAlertModal';
import { Header } from '../components/Header';
import { useOrderStore } from '../store/useOrderStore';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { SERVER_URL } from '../config';

interface HomeScreenProps {
  onNavigate?: (screen: 'HOME' | 'SUMMARY' | 'SCANNER' | 'DISPATCH') => void;
  onNavigateToSummary?: () => void;
}

interface ReadyOrder {
  orderNumber: string;
  clientName: string;
  totalItems: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onNavigateToSummary }) => {
  const goToSummary = () => {
    if (onNavigate) onNavigate('SUMMARY');
    else if (onNavigateToSummary) onNavigateToSummary();
  };
  const { activeOrder, myDoingOrders, operatorId, loadInitialOrders, releaseOrder, focusDoingOrder } = useOrderStore();
  const { theme, fetchTheme } = useThemeStore();
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReadyOrders = async () => {
    try {
      const token = useAuthStore.getState().token;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${SERVER_URL}/api/scanban/available-orders`, { headers });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.orders)) {
        setReadyOrders(data.orders);
      }
    } catch (e) {
      console.log('Error fetching ready orders:', e);
    }
  };

  const syncData = async () => {
    const token = useAuthStore.getState().token;
    await fetchTheme(token);
    await loadInitialOrders();
    await fetchReadyOrders();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await syncData();
    setRefreshing(false);
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClaimOrder = async (orderNumber: string) => {
    if (myDoingOrders.length > 0) {
      showThemedAlert(
        'Límite de Pedidos Activos',
        `Ya tienes ${myDoingOrders.length} pedido(s) en proceso.\n\nDebes finalizar la auditoría o liberar tus pedidos antes de tomar uno nuevo de la lista general.`,
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }

    try {
      const { claimOrder } = useOrderStore.getState();
      const claimed = await claimOrder(orderNumber);
      if (claimed) {
        goToSummary();
      } else {
        showThemedAlert('Error al Tomar Pedido', 'El pedido fue asignado a otro operario o no está disponible.', [{ text: 'Entendido', style: 'default' }]);
      }
    } catch (e) {
      console.log('Error claiming order:', e);
      showThemedAlert('Error al Tomar Pedido', 'No se pudo tomar el pedido.', [{ text: 'Entendido', style: 'default' }]);
    }
  };

  const handleSelectOrderToAudit = async (orderId: string, orderNumber: string) => {
    await focusDoingOrder(orderId || orderNumber);
    goToSummary();
  };

  const handleReleaseOrder = async (orderId: string, orderNumber: string) => {
    showThemedAlert(
      'Liberar Pedido',
      `¿Deseas devolver el Pedido #${orderNumber} a la columna LISTO?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Liberar',
          style: 'destructive',
          onPress: async () => {
            await releaseOrder(orderId || orderNumber);
            await syncData();
          }
        }
      ]
    );
  };

  const hasDoingOrders = myDoingOrders && myDoingOrders.length > 0;
  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (theme.borderRadius || 4);
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (theme.borderRadius || 4);
  const badgeRadius = theme.radiusBadge !== undefined ? theme.radiusBadge : (theme.borderRadius || 2);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono');
  const fontFamilyMono = theme.fontMono || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'monospace');

  // Ordenar para que el pedido actualmente en foco / abierto aparezca siempre primero en la lista
  const sortedDoingOrders = [...myDoingOrders].sort((a, b) => {
    const aIsFocused = activeOrder && (activeOrder.id === a.id || activeOrder.orderNumber === a.orderNumber);
    const bIsFocused = activeOrder && (activeOrder.id === b.id || activeOrder.orderNumber === b.orderNumber);
    if (aIsFocused && !bIsFocused) return -1;
    if (!aIsFocused && bIsFocused) return 1;
    return 0;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="HoloSpace · ScanBan Scanner" badgeText={`OP: ${operatorId}`} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.emerald} />}
      >
        {/* SECCIÓN 1: MIS PEDIDOS EN PROCESO (DOING) */}
        {hasDoingOrders ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: theme.emerald, fontFamily: fontFamilyMain, letterSpacing: 0.5 }}>
                MIS PEDIDOS EN PROCESO ({myDoingOrders.length})
              </Text>
            </View>

            {sortedDoingOrders.map((doingItem) => {
              const isFocused = activeOrder && (activeOrder.id === doingItem.id || activeOrder.orderNumber === doingItem.orderNumber);
              const percent = doingItem.totalItemsRequired > 0
                ? Math.round(((doingItem.totalItemsScanned || 0) / doingItem.totalItemsRequired) * 100)
                : 0;

              return (
                <View
                  key={doingItem.id || doingItem.orderNumber}
                  style={[
                    styles.activeDoingCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: isFocused ? theme.emerald : theme.cardBorder,
                      borderRadius: cardRadius,
                      borderWidth: isFocused ? Math.max(2, borderWidthVal) : borderWidthVal
                    }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.activeTitle, { color: isFocused ? theme.emerald : theme.textMain, fontFamily: fontFamilyMain }]}>
                      PEDIDO #{doingItem.orderNumber}
                    </Text>
                    {isFocused && (
                      <View style={{ backgroundColor: `${theme.emerald}25`, borderColor: theme.emerald, borderWidth: borderWidthVal, paddingHorizontal: 8, paddingVertical: 2, borderRadius: badgeRadius }}>
                        <Text style={{ color: theme.emerald, fontSize: 11, fontWeight: '900', fontFamily: fontFamilyMono }}>EN FOCO</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.activeSubtitle, { color: theme.textMain, fontFamily: fontFamilyMain }]}>
                    Cliente: {doingItem.clientName || 'Cliente Logística'}
                  </Text>

                  <Text style={[styles.activeProgressText, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>
                    Verificado: {doingItem.totalItemsScanned || 0} / {doingItem.totalItemsRequired || 0} U ({percent}%)
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' }}>
                    <TouchableOpacity
                      style={[styles.btnContinue, { backgroundColor: theme.emerald, borderRadius: btnRadius, flex: 1 }]}
                      onPress={() => handleSelectOrderToAudit(doingItem.id, doingItem.orderNumber)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.btnContinueText, { fontFamily: fontFamilyMain, color: theme.background }]}>
                        {isFocused ? 'CONTINUAR ESCANEO' : 'AUDITAR ESTE PEDIDO'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btnReleaseHome, { borderColor: theme.amber, borderWidth: borderWidthVal, borderRadius: btnRadius, paddingHorizontal: 14 }]}
                      onPress={() => handleReleaseOrder(doingItem.id, doingItem.orderNumber)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.btnReleaseHomeText, { color: theme.amber, fontFamily: fontFamilyMain }]}>LIBERAR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* SECCIÓN 2: PEDIDOS DISPONIBLES EN LISTO (READY) */}
        <View style={[styles.uploadCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: borderWidthVal, borderRadius: cardRadius }]}>
          <Text style={[styles.uploadTitle, { color: theme.emerald, fontFamily: fontFamilyMain }]}>
            PEDIDOS LISTOS PARA TOMAR {readyOrders.length > 0 ? `(${readyOrders.length})` : ''}
          </Text>

          {readyOrders.length > 0 && (
            <Text style={[styles.uploadSubtitle, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>
              {hasDoingOrders
                ? `[BLOQUEADO] Tienes ${myDoingOrders.length} pedido(s) en proceso. Finalízalos o libéralos para tomar otro de la lista general.`
                : 'Selecciona un pedido validado por el Administrador para asignártelo e iniciar el escaneo:'}
            </Text>
          )}

          {readyOrders.map((item) => (
            <TouchableOpacity
              key={item.orderNumber}
              style={[
                styles.btnUpload,
                { backgroundColor: theme.emerald, borderColor: theme.emerald, borderWidth: borderWidthVal, borderRadius: btnRadius },
                hasDoingOrders && styles.btnDisabled
              ]}
              onPress={() => handleClaimOrder(item.orderNumber)}
              activeOpacity={hasDoingOrders ? 1 : 0.8}
            >
              <Text style={[styles.btnUploadText, { fontFamily: fontFamilyMain, color: theme.background }, hasDoingOrders && { color: theme.textMuted }]}>
                TOMAR PEDIDO #{item.orderNumber} ({item.clientName} - {item.totalItems} U)
              </Text>
            </TouchableOpacity>
          ))}

          {readyOrders.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>
                No hay pedidos en estado LISTO en este momento.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 20,
    gap: 20
  },
  activeDoingCard: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 20,
    gap: 10
  },
  activeTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  activeSubtitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  activeProgressText: {
    fontSize: 13,
    fontWeight: '700'
  },
  btnContinue: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4
  },
  btnContinueText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14
  },
  btnReleaseHome: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1
  },
  btnReleaseHomeText: {
    fontWeight: '800',
    fontSize: 12
  },
  uploadCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 14
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '900'
  },
  uploadSubtitle: {
    fontSize: 13,
    lineHeight: 18
  },
  btnUpload: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center'
  },
  btnUploadText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 13
  },
  btnDisabled: {
    opacity: 0.4
  },
  textDisabled: {
    color: '#8B949E'
  },
  emptyBox: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500'
  }
});
