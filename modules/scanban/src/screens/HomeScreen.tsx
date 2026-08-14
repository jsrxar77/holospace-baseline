import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, RefreshControl } from 'react-native';
import { Header } from '../components/Header';
import { useOrderStore } from '../store/useOrderStore';
import { useThemeStore } from '../store/useThemeStore';
import { SERVER_URL } from '../config';

interface HomeScreenProps {
  onNavigateToSummary: () => void;
}

interface ReadyOrder {
  orderNumber: string;
  clientName: string;
  totalItems: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToSummary }) => {
  const { activeOrder, operatorId, loadInitialOrders, releaseOrder } = useOrderStore();
  const { theme, fetchTheme } = useThemeStore();
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReadyOrders = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/scanban/available-orders`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.orders)) {
        setReadyOrders(data.orders);
      }
    } catch (e) {
      console.log('Error fetching ready orders:', e);
    }
  };

  const syncData = async () => {
    await fetchTheme();
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
    if (activeOrder && activeOrder.status !== 'CLOSED' && activeOrder.status !== 'PARTIAL_DISPATCH') {
      Alert.alert(
        'Límite de Pedido Activo (1 a 1)',
        `Ya tienes el Pedido #${activeOrder.orderNumber} en proceso.\n\nDebes finalizar la auditoría o liberarlo antes de tomar un pedido nuevo.`,
        [
          { text: 'Ir al Pedido Activo', onPress: onNavigateToSummary },
          { text: 'Entendido', style: 'cancel' }
        ]
      );
      return;
    }

    const { claimOrder } = useOrderStore.getState();
    const success = await claimOrder(orderNumber);
    if (success) {
      await fetchReadyOrders();
      onNavigateToSummary();
    } else {
      Alert.alert('Error al Tomar Pedido', 'El pedido fue asignado a otro operario o no está disponible.');
    }
  };

  const handleReleaseCurrentOrder = async () => {
    if (!activeOrder) return;
    Alert.alert(
      'Liberar Pedido Activo',
      `¿Deseas devolver el Pedido #${activeOrder.orderNumber} a la columna LISTO?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Liberar',
          style: 'destructive',
          onPress: async () => {
            await releaseOrder(activeOrder.orderNumber);
            await fetchReadyOrders();
            Alert.alert('Pedido Liberado', `El Pedido #${activeOrder.orderNumber} fue devuelto a la columna LISTO (READY).`);
          }
        }
      ]
    );
  };

  const hasActiveDoingOrder = activeOrder && activeOrder.status !== 'CLOSED' && activeOrder.status !== 'PARTIAL_DISPATCH';

  const cardRadius = theme.radiusCard || (theme.borderRadius === 4 ? 4 : (theme.borderRadius === 12 ? 12 : 32));
  const btnRadius = theme.radiusBtn || (theme.borderRadius === 4 ? 4 : (theme.borderRadius === 12 ? 20 : 16));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="HoloWare · ScanBan Scanner" badgeText={`OP: ${operatorId}`} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.emerald} />}
      >
        {/* Si el operario ya tiene un pedido activo en proceso (doing) */}
        {hasActiveDoingOrder ? (
          <View style={[styles.activeDoingCard, { backgroundColor: theme.cardBg, borderColor: theme.cobalt, borderRadius: cardRadius }]}>
            <Text style={[styles.activeTitle, { color: theme.emerald }]}>PEDIDO EN PROCESO #{activeOrder.orderNumber}</Text>
            <Text style={[styles.activeSubtitle, { color: theme.textMain }]}>
              Cliente: {activeOrder.clientName}
            </Text>
            <Text style={[styles.activeProgressText, { color: theme.textMuted }]}>
              Verificado: {activeOrder.totalItemsScanned} / {activeOrder.totalItemsRequired} U (
              {Math.round((activeOrder.totalItemsScanned / activeOrder.totalItemsRequired) * 100)}%)
            </Text>

            <TouchableOpacity
              style={[styles.btnContinue, { backgroundColor: theme.emerald, borderRadius: btnRadius }]}
              onPress={onNavigateToSummary}
              activeOpacity={0.8}
            >
              <Text style={styles.btnContinueText}>CONTINUAR AUDITORÍA #{activeOrder.orderNumber}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnReleaseHome, { borderColor: theme.amber, borderRadius: btnRadius }]}
              onPress={handleReleaseCurrentOrder}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnReleaseHomeText, { color: theme.amber }]}>LIBERAR PEDIDO A LISTO (READY)</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Sección de Pedidos Disponibles en LISTO (Verde) */}
        <View style={[styles.uploadCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderRadius: cardRadius }]}>
          <Text style={[styles.uploadTitle, { color: theme.emerald }]}>Pedidos Listos para Tomar</Text>

          {readyOrders.length > 0 && (
            <Text style={[styles.uploadSubtitle, { color: theme.textMuted }]}>
              {hasActiveDoingOrder
                ? `[BLOQUEADO] Tienes el Pedido #${activeOrder.orderNumber} en proceso. Libéralo para tomar otro.`
                : 'Selecciona un pedido validado por el Administrador para asignártelo e iniciar el escaneo:'}
            </Text>
          )}

          {readyOrders.map((item) => (
            <TouchableOpacity
              key={item.orderNumber}
              style={[styles.btnUpload, { backgroundColor: theme.emerald, borderColor: theme.emerald, borderRadius: btnRadius }, hasActiveDoingOrder && styles.btnDisabled]}
              onPress={() => handleClaimOrder(item.orderNumber)}
              activeOpacity={hasActiveDoingOrder ? 1 : 0.8}
            >
              <Text style={[styles.btnUploadText, hasActiveDoingOrder && styles.textDisabled]}>
                TOMAR PEDIDO #{item.orderNumber} ({item.clientName} - {item.totalItems} U)
              </Text>
            </TouchableOpacity>
          ))}

          {readyOrders.length === 0 && !hasActiveDoingOrder && (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No hay pedidos en estado LISTO. Espera a que el Administrador valide un comprobante desde ScanBan Board.
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
