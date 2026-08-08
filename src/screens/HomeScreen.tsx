import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, RefreshControl } from 'react-native';
import { Header } from '../components/Header';
import { useOrderStore } from '../store/useOrderStore';

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
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReadyOrders = async () => {
    try {
      const res = await fetch('http://192.168.100.247:3001/api/available-orders');
      const data = await res.json();
      if (data && data.success && Array.isArray(data.orders)) {
        setReadyOrders(data.orders);
      }
    } catch (e) {
      console.log('Error fetching ready orders:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialOrders();
    await fetchReadyOrders();
    setRefreshing(false);
  };

  useEffect(() => {
    loadInitialOrders();
    fetchReadyOrders();
    const interval = setInterval(fetchReadyOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClaimOrder = async (orderNumber: string) => {
    if (activeOrder && activeOrder.status !== 'CLOSED' && activeOrder.status !== 'PARTIAL_DISPATCH') {
      Alert.alert(
        'Límite de Pedido Activo (1 a 1)',
        `Ya tienes el Pedido #${activeOrder.orderNumber} en proceso.\n\nDebes finalizar la auditoría o liberarlo antes de tomar un pedido nuevo.`,
        [
          { text: 'Ir al Pedido Activo', onPress: onNavigateToSummary },
          {
            text: 'Liberar Actual',
            style: 'destructive',
            onPress: () => handleReleaseCurrentOrder()
          }
        ]
      );
      return;
    }

    try {
      const { claimOrder } = useOrderStore.getState();
      await claimOrder(orderNumber);
      await fetchReadyOrders();
      Alert.alert(
        'Pedido Asignado',
        `Has tomado el Pedido #${orderNumber}.\nEl pedido se ha asignado a tu dispositivo (${operatorId}).`,
        [
          {
            text: 'Iniciar Escaneo',
            onPress: () => {
              onNavigateToSummary();
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Error', 'No se pudo tomar el pedido.');
    }
  };

  const handleReleaseCurrentOrder = async () => {
    if (!activeOrder) return;
    Alert.alert(
      'Liberar Pedido',
      `¿Deseas liberar el Pedido #${activeOrder.orderNumber}?\nEl pedido volverá a la columna LISTO (READY) para que otro operario lo tome.`,
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

  return (
    <View style={styles.container}>
      <Header title="PHONEWARE SCANNER" badgeText={`OP: ${operatorId}`} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E676" />}
      >
        {/* Si el operario ya tiene un pedido activo en proceso (doing) */}
        {hasActiveDoingOrder ? (
          <View style={styles.activeDoingCard}>
            <View style={styles.activeBadgeCircle}>
              <Text style={styles.activeBadgeText}>⚡</Text>
            </View>
            <Text style={styles.activeTitle}>PEDIDO EN PROCESO #{activeOrder.orderNumber}</Text>
            <Text style={styles.activeSubtitle}>
              Cliente: {activeOrder.clientName}
            </Text>
            <Text style={styles.activeProgressText}>
              Verificado: {activeOrder.totalItemsScanned} / {activeOrder.totalItemsRequired} U (
              {Math.round((activeOrder.totalItemsScanned / activeOrder.totalItemsRequired) * 100)}%)
            </Text>

            <TouchableOpacity
              style={styles.btnContinue}
              onPress={onNavigateToSummary}
              activeOpacity={0.8}
            >
              <Text style={styles.btnContinueText}>CONTINUAR AUDITORÍA #{activeOrder.orderNumber}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnReleaseHome}
              onPress={handleReleaseCurrentOrder}
              activeOpacity={0.8}
            >
              <Text style={styles.btnReleaseHomeText}>🔓 LIBERAR PEDIDO A LISTO (READY)</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Sección de Pedidos Disponibles en READY (Verde) */}
        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Pedidos Listos para Tomar (READY)</Text>
          <Text style={styles.uploadSubtitle}>
            {hasActiveDoingOrder
              ? `[BLOQUEADO] Tienes el Pedido #${activeOrder.orderNumber} en proceso. Libéralo para tomar otro.`
              : readyOrders.length === 0
              ? 'No hay pedidos en estado LISTO (READY). Espera a que el Administrador valide un comprobante.'
              : 'Selecciona un pedido validado por el Administrador para asignártelo e iniciar el escaneo:'}
          </Text>

          {readyOrders.map((item) => (
            <TouchableOpacity
              key={item.orderNumber}
              style={[styles.btnUpload, hasActiveDoingOrder && styles.btnDisabled]}
              onPress={() => handleClaimOrder(item.orderNumber)}
              activeOpacity={hasActiveDoingOrder ? 1 : 0.8}
            >
              <Text style={[styles.btnUploadText, hasActiveDoingOrder && styles.textDisabled]}>
                TOMAR PEDIDO #{item.orderNumber} ({item.clientName} - {item.totalItems} U)
              </Text>
            </TouchableOpacity>
          ))}

          {/* Botones de prueba fija si no hay pedidos recibidos de API */}
          {readyOrders.length === 0 && !hasActiveDoingOrder && (
            <View style={{ marginTop: 10, width: '100%', gap: 10 }}>
              <TouchableOpacity
                style={styles.btnUpload}
                onPress={() => handleClaimOrder('3010')}
                activeOpacity={0.8}
              >
                <Text style={styles.btnUploadText}>TOMAR PEDIDO #3010 (DIEGO POKE - 11 U)</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14'
  },
  scrollContent: {
    padding: 20,
    gap: 20
  },
  activeDoingCard: {
    backgroundColor: '#161B22',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12
  },
  activeBadgeCircle: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeBadgeText: {
    fontSize: 24
  },
  activeTitle: {
    color: '#3B82F6',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center'
  },
  activeSubtitle: {
    color: '#8B949E',
    fontSize: 13,
    textAlign: 'center'
  },
  activeProgressText: {
    color: '#00E676',
    fontSize: 16,
    fontWeight: '900'
  },
  btnContinue: {
    width: '100%',
    minHeight: 64,
    backgroundColor: '#00E676',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  btnContinueText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center'
  },
  btnReleaseHome: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#21262D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D'
  },
  btnReleaseHomeText: {
    color: '#FF5252',
    fontSize: 13,
    fontWeight: '700'
  },
  uploadCard: {
    backgroundColor: '#161B22',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#30363D'
  },
  uploadTitle: {
    color: '#00E676',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center'
  },
  uploadSubtitle: {
    color: '#8B949E',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8
  },
  btnUpload: {
    width: '100%',
    minHeight: 56,
    backgroundColor: '#00E676',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  btnUploadText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center'
  },
  btnDisabled: {
    opacity: 0.4
  },
  textDisabled: {
    color: '#8B949E'
  }
});
