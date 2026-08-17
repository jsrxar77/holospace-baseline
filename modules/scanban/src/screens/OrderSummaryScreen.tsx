import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useOrderStore } from '../store/useOrderStore';
import { useThemeStore } from '../store/useThemeStore';
import { ItemCard } from '../components/ItemCard';
import { ProgressBar } from '../components/ProgressBar';
import { SupervisorModal } from '../components/SupervisorModal';

interface OrderSummaryScreenProps {
  onNavigateToScanner: () => void;
  onNavigateToDispatch: () => void;
  onBack: () => void;
}

export const OrderSummaryScreen: React.FC<OrderSummaryScreenProps> = ({
  onNavigateToScanner,
  onNavigateToDispatch,
  onBack
}) => {
  const { activeOrder, closeOrder, loadInitialOrders, unassignedOrderNotification, clearUnassignedNotification } = useOrderStore();
  const { theme } = useThemeStore();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'READY'>('ALL');
  const [isSupervisorModalOpen, setSupervisorModalOpen] = useState(false);

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
      Alert.alert(
        'Pedido Desasignado por Administrador',
        `El Pedido #${orderNum} fue desasignado o liberado a la columna LISTO por el Administrador desde ScanBan Board.`,
        [
          {
            text: 'Entendido',
            onPress: () => onBack()
          }
        ],
        { cancelable: false }
      );
    }
  }, [unassignedOrderNotification]);

  if (!activeOrder) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.textMain }]}>No hay pedido activo seleccionado.</Text>
        <TouchableOpacity style={[styles.btnBack, { backgroundColor: theme.emerald }]} onPress={onBack}>
          <Text style={styles.btnBackText}>Volver al Inicio</Text>
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
      onNavigateToDispatch();
    } else {
      Alert.alert(
        'Bloqueo Estricto de Cierre (US-05)',
        `No se puede cerrar el pedido. Faltan ${activeOrder.totalItemsRequired - activeOrder.totalItemsScanned
        } unidades por verificar.`,
        [
          { text: 'Continuar Escaneando', onPress: onNavigateToScanner },
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
      onNavigateToDispatch();
    }
  };

  const handleReleaseOrder = async () => {
    Alert.alert(
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
            onBack();
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header Row */}
      <View style={[styles.headerRow, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity style={[styles.backBtn, { borderColor: theme.cardBorder }]} onPress={onBack}>
          <Text style={[styles.backIcon, { color: theme.textMain }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Text style={[styles.orderTitle, { color: theme.textMain }]}>PEDIDO #{activeOrder.orderNumber}</Text>
          <Text style={[styles.clientTitle, { color: theme.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
            Cliente: {activeOrder.clientName}
          </Text>
        </View>

        <TouchableOpacity style={[styles.releaseBtn, { borderColor: theme.amber }]} onPress={handleReleaseOrder}>
          <Text style={[styles.releaseIcon, { color: theme.amber }]}>LIBERAR</Text>
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
          style={[styles.tab, { borderColor: theme.cardBorder }, filter === 'ALL' && { backgroundColor: theme.emerald, borderColor: theme.emerald }]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabText, { color: theme.textMuted }, filter === 'ALL' && { color: '#000', fontWeight: '900' }]}>
            Todos ({activeOrder.items.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, { borderColor: theme.cardBorder }, filter === 'PENDING' && { backgroundColor: theme.emerald, borderColor: theme.emerald }]}
          onPress={() => setFilter('PENDING')}
        >
          <Text style={[styles.tabText, { color: theme.textMuted }, filter === 'PENDING' && { color: '#000', fontWeight: '900' }]}>
            Pendientes ({activeOrder.items.filter((i) => i.quantityScanned < i.quantityRequired).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, { borderColor: theme.cardBorder }, filter === 'COMPLETED' && { backgroundColor: theme.emerald, borderColor: theme.emerald }]}
          onPress={() => setFilter('COMPLETED')}
        >
          <Text style={[styles.tabText, { color: theme.textMuted }, filter === 'COMPLETED' && { color: '#000', fontWeight: '900' }]}>
            Verificados ({activeOrder.items.filter((i) => i.quantityScanned >= i.quantityRequired).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, { borderColor: theme.cardBorder }, filter === 'READY' && { backgroundColor: theme.emerald, borderColor: theme.emerald }]}
          onPress={() => setFilter('READY')}
        >
          <Text style={[styles.tabText, { color: theme.textMuted }, filter === 'READY' && { color: '#000', fontWeight: '900' }]}>
            Listo ({activeOrder.status === 'READY' ? activeOrder.items.length : 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Items Scrollable List */}
      <ScrollView contentContainerStyle={styles.itemsList}>
        {filteredItems.map((item) => (
          <ItemCard key={item.id} item={item} onPress={onNavigateToScanner} />
        ))}
      </ScrollView>

      {/* Bottom Sticky Action Buttons */}
      <View style={[styles.bottomBar, { backgroundColor: theme.cardBg, borderTopColor: theme.cardBorder }]}>
        {!isClosed && (
          <TouchableOpacity style={[styles.btnScan, { backgroundColor: theme.emerald }]} onPress={onNavigateToScanner} activeOpacity={0.8}>
            <Text style={styles.btnScanText}>INICIAR ESCANEO</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.btnDispatch,
            is100Percent ? { backgroundColor: theme.emerald, opacity: 1 } : { backgroundColor: theme.cardBorder, opacity: 0.6 }
          ]}
          onPress={handlePressDispatch}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.btnDispatchText,
              is100Percent ? { color: '#000', fontWeight: '900' } : { color: theme.textMuted }
            ]}
          >
            {isClosed ? 'VER RESUMEN DE DESPACHO' : 'CERRAR Y DESPACHAR PEDIDO'}
          </Text>
        </TouchableOpacity>

        {!isClosed && (
          <TouchableOpacity style={[styles.btnRelease, { borderColor: theme.amber }]} onPress={handleReleaseOrder} activeOpacity={0.8}>
            <Text style={[styles.btnReleaseText, { color: theme.amber }]}>LIBERAR PEDIDO A BACKLOG</Text>
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
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20
  },
  btnBack: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14
  },
  btnBackText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900'
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '900'
  },
  headerTitles: {
    alignItems: 'center'
  },
  orderTitle: {
    fontSize: 17,
    fontWeight: '900'
  },
  clientTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  releaseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
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
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700'
  },
  itemsList: {
    paddingHorizontal: 20,
    paddingBottom: 140,
    gap: 12
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    gap: 10
  },
  btnScan: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnScanText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900'
  },
  btnDispatch: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnDispatchText: {
    fontSize: 13
  },
  btnRelease: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  btnReleaseText: {
    fontSize: 12,
    fontWeight: '800'
  }
});
