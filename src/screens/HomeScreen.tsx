import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Header } from '../components/Header';
import { useOrderStore } from '../store/useOrderStore';

interface HomeScreenProps {
  onNavigateToSummary: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToSummary }) => {
  const { activeOrder, operatorId, loadInitialOrders, releaseOrder } = useOrderStore();

  useEffect(() => {
    loadInitialOrders();
  }, []);

  const handleClaimOrder = async (orderNumber: string) => {
    // Regla estricta: 1 operario = 1 pedido activo en doing
    if (activeOrder && activeOrder.status !== 'CLOSED' && activeOrder.status !== 'PARTIAL_DISPATCH') {
      Alert.alert(
        'Límite de Pedido Activo (1 a 1)',
        `Ya tienes el Pedido #${activeOrder.orderNumber} en proceso.\n\nDebes finalizar la auditoría o liberarlo a ./delivery/backlog/ antes de tomar un pedido nuevo.`,
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
      const claimedOrder = await claimOrder(orderNumber);
      Alert.alert(
        'Pedido Asignado',
        `Has tomado el Pedido #${orderNumber}.\nEl archivo se movió a: ./delivery/doing/${orderNumber}-${operatorId}.pdf`,
        [
          {
            text: 'Iniciar Auditoría',
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
      `¿Deseas liberar el Pedido #${activeOrder.orderNumber}?\nEl archivo volverá a ./delivery/backlog/ limpio para que otro operario lo tome.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Liberar',
          style: 'destructive',
          onPress: async () => {
            await releaseOrder(activeOrder.orderNumber);
            Alert.alert('Pedido Liberado', `El Pedido #${activeOrder.orderNumber} fue devuelto al backlog.`);
          }
        }
      ]
    );
  };

  const hasActiveDoingOrder = activeOrder && activeOrder.status !== 'CLOSED' && activeOrder.status !== 'PARTIAL_DISPATCH';

  return (
    <View style={styles.container}>
      <Header title="Phone-Ware Depósito" badgeText={`OP: ${operatorId}`} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Si el operario ya tiene un pedido activo en proceso (doing) */}
        {hasActiveDoingOrder ? (
          <View style={styles.activeDoingCard}>
            <View style={styles.activeBadgeCircle}>
              <Text style={styles.activeBadgeText}>⚡</Text>
            </View>
            <Text style={styles.activeTitle}>TU PEDIDO EN PROCESO #{activeOrder.orderNumber}</Text>
            <Text style={styles.activeSubtitle}>
              Ubicación: ./delivery/doing/{activeOrder.pdfFileName}
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
              <Text style={styles.btnReleaseHomeText}>🔓 LIBERAR PEDIDO A BACKLOG</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Backlog Section Card */}
        <View style={styles.uploadCard}>
          <View style={styles.pdfIconCircle}>
            <Text style={styles.pdfIconText}>PDF</Text>
          </View>
          <Text style={styles.uploadTitle}>Pedidos Libres en ./delivery/backlog/</Text>
          <Text style={styles.uploadSubtitle}>
            {hasActiveDoingOrder
              ? `[BLOQUEADO] Tienes el Pedido #${activeOrder.orderNumber} en proceso. Libéralo para tomar otro.`
              : `Presiona "TOMAR PEDIDO" para asignarlo a tu dispositivo (${operatorId}) y moverlo a ./delivery/doing/:`}
          </Text>

          <TouchableOpacity
            style={[styles.btnUpload, hasActiveDoingOrder && styles.btnDisabled]}
            onPress={() => handleClaimOrder('34512175')}
            activeOpacity={hasActiveDoingOrder ? 1 : 0.8}
          >
            <Text style={[styles.btnUploadText, hasActiveDoingOrder && styles.textDisabled]}>
              TOMAR PEDIDO 34512175 (Lunfa - 3 U)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnUpload, styles.btnSecondary, hasActiveDoingOrder && styles.btnDisabled]}
            onPress={() => handleClaimOrder('34409313')}
            activeOpacity={hasActiveDoingOrder ? 1 : 0.8}
          >
            <Text style={[styles.btnSecondaryText, hasActiveDoingOrder && styles.textDisabled]}>
              TOMAR PEDIDO 34409313 (Diego Poke)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnUpload, styles.btnSecondary, hasActiveDoingOrder && styles.btnDisabled]}
            onPress={() => handleClaimOrder('34512173')}
            activeOpacity={hasActiveDoingOrder ? 1 : 0.8}
          >
            <Text style={[styles.btnSecondaryText, hasActiveDoingOrder && styles.textDisabled]}>
              TOMAR PEDIDO 34512173 (Diego Pascual)
            </Text>
          </TouchableOpacity>
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
    minHeight: 64, // Ergonomía > 64px
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
    width: '100%',
    minHeight: 52,
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  btnReleaseHomeText: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center'
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
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center'
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
    paddingHorizontal: 16,
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
  btnDisabled: {
    backgroundColor: '#161B22',
    borderColor: '#30363D',
    opacity: 0.5
  },
  textDisabled: {
    color: '#8B949E'
  }
});
