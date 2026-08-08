import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useOrderStore } from '../store/useOrderStore';
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
  const { activeOrder, closeOrder } = useOrderStore();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [isSupervisorModalOpen, setSupervisorModalOpen] = useState(false);

  if (!activeOrder) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No hay pedido activo seleccionado.</Text>
        <TouchableOpacity style={styles.btnBack} onPress={onBack}>
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
    return true;
  });

  const handlePressDispatch = () => {
    if (is100Percent || isClosed) {
      onNavigateToDispatch();
    } else {
      Alert.alert(
        'Bloqueo Estricto de Cierre (US-05)',
        `No se puede cerrar el pedido. Faltan ${
          activeOrder.totalItemsRequired - activeOrder.totalItemsScanned
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

  return (
    <View style={styles.container}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Text style={styles.orderTitle}>DETALLE DE VENTA #{activeOrder.orderNumber}</Text>
          <Text style={styles.clientTitle}>Cliente: {activeOrder.clientName}</Text>
        </View>

        <View style={{ width: 44 }} />
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
          style={[styles.tab, filter === 'ALL' && styles.tabActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabText, filter === 'ALL' && styles.tabTextActive]}>
            Todos ({activeOrder.items.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filter === 'PENDING' && styles.tabActive]}
          onPress={() => setFilter('PENDING')}
        >
          <Text style={[styles.tabText, filter === 'PENDING' && styles.tabTextActive]}>
            Pendientes ({activeOrder.items.filter((i) => i.quantityScanned < i.quantityRequired).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filter === 'COMPLETED' && styles.tabActive]}
          onPress={() => setFilter('COMPLETED')}
        >
          <Text style={[styles.tabText, filter === 'COMPLETED' && styles.tabTextActive]}>
            Verificados ({activeOrder.items.filter((i) => i.quantityScanned >= i.quantityRequired).length})
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
      <View style={styles.bottomBar}>
        {!isClosed && (
          <TouchableOpacity style={styles.btnScan} onPress={onNavigateToScanner} activeOpacity={0.8}>
            <Text style={styles.btnScanText}>📷 INICIAR ESCANEO</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.btnDispatch,
            is100Percent ? styles.btnDispatchActive : styles.btnDispatchDisabled
          ]}
          onPress={handlePressDispatch}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.btnDispatchText,
              is100Percent ? styles.textDispatchActive : styles.textDispatchDisabled
            ]}
          >
            {isClosed ? 'VER RESUMEN DE DESPACHO' : 'CERRAR Y DESPACHAR PEDIDO'}
          </Text>
        </TouchableOpacity>
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
    flex: 1,
    backgroundColor: '#0B0E14'
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0B0E14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20
  },
  btnBack: {
    backgroundColor: '#00E676',
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
    backgroundColor: '#161B22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D'
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#21262D',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900'
  },
  headerTitles: {
    alignItems: 'center'
  },
  orderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900'
  },
  clientTitle: {
    color: '#8B949E',
    fontSize: 13,
    fontWeight: '700'
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
    backgroundColor: '#161B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    alignItems: 'center'
  },
  tabActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676'
  },
  tabText: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '800'
  },
  tabTextActive: {
    color: '#000000',
    fontWeight: '900'
  },
  itemsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12
  },
  bottomBar: {
    padding: 20,
    backgroundColor: '#161B22',
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    gap: 12
  },
  btnScan: {
    minHeight: 64, // Ergonomía > 64px
    backgroundColor: '#00E676',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6
  },
  btnScanText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  btnDispatch: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2
  },
  btnDispatchActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6'
  },
  btnDispatchDisabled: {
    backgroundColor: '#21262D',
    borderColor: '#30363D'
  },
  btnDispatchText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  textDispatchActive: {
    color: '#FFFFFF'
  },
  textDispatchDisabled: {
    color: '#8B949E'
  }
});
