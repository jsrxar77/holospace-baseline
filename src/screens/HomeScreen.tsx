import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Header } from '../components/Header';
import { useOrderStore } from '../store/useOrderStore';
import { Order } from '../types';

interface HomeScreenProps {
  onNavigateToSummary: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToSummary }) => {
  const { orders, loadInitialOrders, loadPdfOrder, setActiveOrder } = useOrderStore();

  useEffect(() => {
    loadInitialOrders();
  }, []);

  const handleSelectSamplePdf = async (fileName: string) => {
    try {
      const loadedOrder = await loadPdfOrder(fileName);
      Alert.alert(
        'Pedido Cargado',
        `Se procesó el comprobante ${fileName} exitosamente (${loadedOrder.items.length} productos).`,
        [
          {
            text: 'Ir al Resumen',
            onPress: () => {
              setActiveOrder(loadedOrder);
              onNavigateToSummary();
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Error', 'No se pudo procesar el archivo PDF.');
    }
  };

  const handleOpenOrder = (order: Order) => {
    setActiveOrder(order);
    onNavigateToSummary();
  };

  return (
    <View style={styles.container}>
      <Header title="Phone-Ware Depósito" badgeText="Depósito #1" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Upload Card */}
        <View style={styles.uploadCard}>
          <View style={styles.pdfIconCircle}>
            <Text style={styles.pdfIconText}>PDF</Text>
          </View>
          <Text style={styles.uploadTitle}>Cargar Pedido PDF</Text>
          <Text style={styles.uploadSubtitle}>
            Selecciona un comprobante de pedido PDF para iniciar la auditoría de stock:
          </Text>

          <TouchableOpacity
            style={styles.btnUpload}
            onPress={() => handleSelectSamplePdf('34512175.pdf')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnUploadText}>Pedido 34512175</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnUpload, styles.btnSecondary]}
            onPress={() => handleSelectSamplePdf('34409313.pdf')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>Pedido 34409313</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnUpload, styles.btnSecondary]}
            onPress={() => handleSelectSamplePdf('34512173.pdf')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>Pedido 34512173</Text>
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <Text style={styles.sectionTitle}>Pedidos Recientes en Depósito</Text>

        {/* Orders History List */}
        <View style={styles.ordersList}>
          {orders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No hay pedidos cargados recientemente.</Text>
            </View>
          ) : (
            orders.map((order) => {
              const isClosed = order.status === 'CLOSED' || order.status === 'PARTIAL_DISPATCH';
              const isVerified = order.status === 'VERIFIED';
              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => handleOpenOrder(order)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber}>Pedido #{order.orderNumber}</Text>
                    <Text style={styles.orderClient}>Cliente: {order.clientName}</Text>
                    <Text style={styles.orderDate}>Fecha: {order.issueDate}</Text>
                  </View>

                  <View style={styles.orderBadgeGroup}>
                    <View
                      style={[
                        styles.statusBadge,
                        isClosed && styles.badgeClosed,
                        isVerified && styles.badgeVerified,
                        !isClosed && !isVerified && styles.badgePending
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          isClosed && styles.badgeTextClosed,
                          isVerified && styles.badgeTextVerified,
                          !isClosed && !isVerified && styles.badgeTextPending
                        ]}
                      >
                        {order.status}
                      </Text>
                    </View>
                    <Text style={styles.itemsCountText}>
                      {order.totalItemsScanned} / {order.totalItemsRequired} U
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
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
  uploadCard: {
    backgroundColor: '#161B22',
    borderWidth: 2,
    borderColor: '#00E676',
    borderStyle: 'dashed',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 14
  },
  pdfIconCircle: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pdfIconText: {
    color: '#00E676',
    fontSize: 18,
    fontWeight: '900'
  },
  uploadTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900'
  },
  uploadSubtitle: {
    color: '#8B949E',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  btnUpload: {
    width: '100%',
    minHeight: 64, // Ergonomía > 64px
    backgroundColor: '#00E676',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  },
  btnUploadText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  btnSecondary: {
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D'
  },
  btnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  sectionTitle: {
    color: '#8B949E',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  ordersList: {
    gap: 12
  },
  emptyCard: {
    backgroundColor: '#161B22',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center'
  },
  emptyText: {
    color: '#8B949E',
    fontSize: 14
  },
  orderCard: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  orderInfo: {
    gap: 4
  },
  orderNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900'
  },
  orderClient: {
    color: '#8B949E',
    fontSize: 14,
    fontWeight: '700'
  },
  orderDate: {
    color: '#8B949E',
    fontSize: 12
  },
  orderBadgeGroup: {
    alignItems: 'flex-end',
    gap: 6
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)'
  },
  badgeVerified: {
    backgroundColor: '#00E676'
  },
  badgeClosed: {
    backgroundColor: '#3B82F6'
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900'
  },
  badgeTextPending: { color: '#F59E0B' },
  badgeTextVerified: { color: '#000000' },
  badgeTextClosed: { color: '#FFFFFF' },
  itemsCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900'
  }
});
