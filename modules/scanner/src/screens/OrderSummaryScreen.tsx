import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { showThemedAlert } from '../components/ThemedAlertModal';
import { useOrderStore } from '../store/useOrderStore';
import { useThemeStore } from '../store/useThemeStore';
import { ItemCard } from '../components/ItemCard';
import { ProgressBar } from '../components/ProgressBar';
import { SupervisorModal } from '../components/SupervisorModal';

interface OrderSummaryScreenProps {
  onNavigate?: (screen: 'HOME' | 'SUMMARY' | 'SCANNER' | 'DISPATCH') => void;
  onNavigateToScanner?: () => void;
  onNavigateToDispatch?: () => void;
  onBack?: () => void;
}

export const OrderSummaryScreen: React.FC<OrderSummaryScreenProps> = ({
  onNavigate,
  onNavigateToScanner,
  onNavigateToDispatch,
  onBack
}) => {
  const handleGoBack = () => {
    if (onNavigate) onNavigate('HOME');
    else if (onBack) onBack();
  };
  const handleGoScanner = () => {
    if (onNavigate) onNavigate('SCANNER');
    else if (onNavigateToScanner) onNavigateToScanner();
  };
  const handleGoDispatch = () => {
    if (onNavigate) onNavigate('DISPATCH');
    else if (onNavigateToDispatch) onNavigateToDispatch();
  };
  const { activeOrder, closeOrder, loadInitialOrders, unassignedOrderNotification, clearUnassignedNotification } = useOrderStore();
  const { theme } = useThemeStore();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'READY'>('ALL');
  const [isSupervisorModalOpen, setSupervisorModalOpen] = useState(false);

  const isOmarchy = theme.borderRadius === 4;
  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (isOmarchy ? 4 : 16);
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (isOmarchy ? 4 : 12);
  const badgeRadius = theme.radiusBadge !== undefined ? theme.radiusBadge : (isOmarchy ? 2 : 8);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || 'JetBrains Mono';
  const fontFamilyMono = theme.fontMono || 'monospace';

  React.useEffect(() => {
    loadInitialOrders();
    const interval = setInterval(() => {
      loadInitialOrders();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (unassignedOrderNotification) {
      const orderNum = unassignedOrderNotification;
      clearUnassignedNotification();
      showThemedAlert(
        'Pedido Desasignado por Administrador',
        `El Pedido #${orderNum} fue desasignado o liberado a la columna LISTO por el Administrador desde ScanBan Board.`,
        [
          {
            text: 'Entendido',
            onPress: () => handleGoBack()
          }
        ]
      );
    }
  }, [unassignedOrderNotification]);

  if (!activeOrder) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.textMain, fontFamily: fontFamilyMain }]}>No hay pedido activo seleccionado.</Text>
        <TouchableOpacity style={[styles.btnBack, { backgroundColor: theme.emerald, borderRadius: btnRadius }]} onPress={handleGoBack}>
          <Text style={[styles.btnBackText, { fontFamily: fontFamilyMain }]}>Volver al Inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const is100Percent = activeOrder.totalItemsScanned === activeOrder.totalItemsRequired;
  const isClosed = activeOrder.status === 'CLOSED' || activeOrder.status === 'PARTIAL_DISPATCH';

  const filteredItems = activeOrder.items.filter((item) => {
    if (filter === 'PENDING') return item.quantityScanned < item.quantityRequired;
    if (filter === 'COMPLETED') return item.quantityScanned >= item.quantityRequired;
    if (filter === 'READY') return activeOrder.status === 'READY';
    return true;
  });

  const handlePressDispatch = () => {
    if (is100Percent || isClosed) {
      handleGoDispatch();
    } else {
      showThemedAlert(
        'Bloqueo Estricto de Cierre',
        `No se puede cerrar el pedido. Faltan ${activeOrder.totalItemsRequired - activeOrder.totalItemsScanned} unidades por verificar.\n\n¿Deseas continuar escaneando o solicitar autorización de supervisor?`,
        [
          { text: 'Continuar Escaneando', style: 'default', onPress: handleGoScanner },
          {
            text: 'Cierre Parcial (PIN)',
            style: 'destructive',
            onPress: () => setSupervisorModalOpen(true)
          }
        ]
      );
    }
  };

  const handleSupervisorConfirm = async (pin: string, reason: string) => {
    setSupervisorModalOpen(false);
    const success = await closeOrder(pin, reason);
    if (success) {
      handleGoDispatch();
    }
  };

  const handleReleaseOrder = async () => {
    showThemedAlert(
      'Liberar Pedido',
      `¿Deseas liberar el Pedido #${activeOrder.orderNumber}?\nEl pedido se devolverá a la columna LISTO para que lo tome otro operario.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Liberar',
          style: 'destructive',
          onPress: async () => {
            const { releaseOrder } = useOrderStore.getState();
            await releaseOrder(activeOrder.orderNumber);
            handleGoBack();
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header Row */}
      <View style={[styles.headerRow, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder, borderBottomWidth: borderWidthVal }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: theme.cardBorder, backgroundColor: isOmarchy ? '#181825' : '#21262D', borderRadius: btnRadius, borderWidth: borderWidthVal }]}
          onPress={handleGoBack}
          activeOpacity={0.7}
        >
          <Text style={[styles.backIcon, { color: theme.textMain, fontFamily: fontFamilyMono }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Text style={[styles.orderTitle, { color: theme.textMain, fontFamily: fontFamilyMain }]}>PEDIDO #{activeOrder.orderNumber}</Text>
          <Text style={[styles.clientTitle, { color: theme.textMuted, fontFamily: fontFamilyMono }]} numberOfLines={1} ellipsizeMode="tail">
            Cliente: {activeOrder.clientName}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.releaseBtn, { borderColor: theme.amber, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
          onPress={handleReleaseOrder}
          activeOpacity={0.8}
        >
          <Text style={[styles.releaseIcon, { color: theme.amber, fontFamily: fontFamilyMain }]}>LIBERAR</Text>
        </TouchableOpacity>
      </View>

      {/* Global Progress Bar */}
      <View style={styles.progressContainer}>
        <ProgressBar
          scanned={activeOrder.totalItemsScanned}
          total={activeOrder.totalItemsRequired}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: filter === 'ALL' ? theme.emerald : theme.cardBg,
              borderColor: filter === 'ALL' ? theme.emerald : theme.cardBorder,
              borderRadius: btnRadius,
              borderWidth: borderWidthVal
            }
          ]}
          onPress={() => setFilter('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, { fontFamily: fontFamilyMain, color: filter === 'ALL' ? '#11111B' : theme.textMuted, fontWeight: filter === 'ALL' ? '900' : '700' }]}>
            Todos ({activeOrder.items.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: filter === 'PENDING' ? theme.emerald : theme.cardBg,
              borderColor: filter === 'PENDING' ? theme.emerald : theme.cardBorder,
              borderRadius: btnRadius,
              borderWidth: borderWidthVal
            }
          ]}
          onPress={() => setFilter('PENDING')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, { fontFamily: fontFamilyMain, color: filter === 'PENDING' ? '#11111B' : theme.textMuted, fontWeight: filter === 'PENDING' ? '900' : '700' }]}>
            Pendientes ({activeOrder.items.filter((i) => i.quantityScanned < i.quantityRequired).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: filter === 'COMPLETED' ? theme.emerald : theme.cardBg,
              borderColor: filter === 'COMPLETED' ? theme.emerald : theme.cardBorder,
              borderRadius: btnRadius,
              borderWidth: borderWidthVal
            }
          ]}
          onPress={() => setFilter('COMPLETED')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, { fontFamily: fontFamilyMain, color: filter === 'COMPLETED' ? '#11111B' : theme.textMuted, fontWeight: filter === 'COMPLETED' ? '900' : '700' }]}>
            Verificados ({activeOrder.items.filter((i) => i.quantityScanned >= i.quantityRequired).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: filter === 'READY' ? theme.emerald : theme.cardBg,
              borderColor: filter === 'READY' ? theme.emerald : theme.cardBorder,
              borderRadius: btnRadius,
              borderWidth: borderWidthVal
            }
          ]}
          onPress={() => setFilter('READY')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, { fontFamily: fontFamilyMain, color: filter === 'READY' ? '#11111B' : theme.textMuted, fontWeight: filter === 'READY' ? '900' : '700' }]}>
            Listo ({activeOrder.status === 'READY' ? activeOrder.items.length : 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Items Scrollable List */}
      <ScrollView contentContainerStyle={styles.itemsList}>
        {filteredItems.map((item) => (
          <ItemCard key={item.id} item={item} onPress={handleGoScanner} />
        ))}
      </ScrollView>

      {/* Bottom Sticky Action Buttons */}
      <View style={[styles.bottomBar, { backgroundColor: theme.cardBg, borderTopColor: theme.cardBorder, borderTopWidth: borderWidthVal }]}>
        {!isClosed && (
          <TouchableOpacity
            style={[styles.btnScan, { backgroundColor: theme.emerald, borderRadius: btnRadius, borderWidth: borderWidthVal, borderColor: theme.emerald }]}
            onPress={handleGoScanner}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnScanText, { fontFamily: fontFamilyMain, color: '#11111B' }]}>INICIAR ESCANEO</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.btnDispatch,
            {
              backgroundColor: is100Percent ? theme.emerald : 'transparent',
              borderColor: is100Percent ? theme.emerald : theme.cardBorder,
              borderWidth: borderWidthVal,
              borderRadius: btnRadius,
              opacity: is100Percent ? 1 : 0.6
            }
          ]}
          onPress={handlePressDispatch}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.btnDispatchText,
              { fontFamily: fontFamilyMain, color: is100Percent ? '#11111B' : theme.textMuted, fontWeight: is100Percent ? '900' : '700' }
            ]}
          >
            {isClosed ? 'VER RESUMEN DE DESPACHO' : 'CERRAR Y DESPACHAR PEDIDO'}
          </Text>
        </TouchableOpacity>

        {!isClosed && (
          <TouchableOpacity
            style={[styles.btnRelease, { borderColor: theme.amber, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
            onPress={handleReleaseOrder}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnReleaseText, { color: theme.amber, fontFamily: fontFamilyMain }]}>LIBERAR PEDIDO A BACKLOG</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Supervisor Exception PIN Modal */}
      <SupervisorModal
        visible={isSupervisorModalOpen}
        onClose={() => setSupervisorModalOpen(false)}
        onConfirm={handleSupervisorConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 20
  },
  btnBack: {
    paddingHorizontal: 24,
    paddingVertical: 14
  },
  btnBackText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900'
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backIcon: {
    fontSize: 18,
    fontWeight: '900'
  },
  headerTitles: {
    alignItems: 'center'
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  clientTitle: {
    fontSize: 12,
    marginTop: 2
  },
  releaseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  releaseIcon: {
    fontSize: 11,
    fontWeight: '800'
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 16
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabText: {
    fontSize: 11
  },
  itemsList: {
    paddingHorizontal: 20,
    paddingBottom: 160,
    gap: 10
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 8
  },
  btnScan: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnScanText: {
    fontSize: 13,
    fontWeight: '900'
  },
  btnDispatch: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnDispatchText: {
    fontSize: 12
  },
  btnRelease: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnReleaseText: {
    fontSize: 11,
    fontWeight: '800'
  }
});
