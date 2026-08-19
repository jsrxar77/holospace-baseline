import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { showThemedAlert } from '../components/ThemedAlertModal';
import { useOrderStore } from '../store/useOrderStore';

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

  if (!activeOrder) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No hay orden seleccionada.</Text>
        <TouchableOpacity style={styles.btnHome} onPress={goHome}>
          <Text style={styles.btnHomeText}>Volver al Inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPartial = activeOrder.status === 'PARTIAL_DISPATCH';

  const handleCorroborateAndFinish = async () => {
    try {
      if (activeOrder.status !== 'CLOSED' && activeOrder.status !== 'PARTIAL_DISPATCH') {
        await closeOrder();
      }
      showThemedAlert(
        'Despacho Concluido',
        `El Pedido #${activeOrder.orderNumber} fue corroborado y archivado físicamente en ./delivery/done/.\n\nAhora puedes tomar un nuevo pedido.`,
        [
          {
            text: 'Ir a Pedidos Libres',
            style: 'default',
            onPress: () => {
              setActiveOrder(null);
              goHome();
            }
          }
        ]
      );
    } catch (e) {
      setActiveOrder(null);
      goHome();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.modalCard}>
          {/* Top Checkmark Icon */}
          <View style={[styles.iconCircle, isPartial && styles.iconCirclePartial]}>
            <Text style={[styles.iconText, isPartial && styles.iconTextPartial]}>
              {isPartial ? '⚠️' : '✓'}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {isPartial
              ? `¡Pedido #${activeOrder.orderNumber} Despachado Parcialmente!`
              : `¡Pedido #${activeOrder.orderNumber} Verificado al 100%!`}
          </Text>

          <Text style={styles.subtitle}>
            {isPartial
              ? 'El pedido fue verificado con autorización de supervisor por faltantes físicos.'
              : 'La auditoría de stock ha finalizado con éxito. Todas las unidades han sido confirmadas.'}
          </Text>

          {/* Audit Summary Details Box */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Operario Auditador:</Text>
              <Text style={[styles.detailValue, styles.textEmerald]} numberOfLines={1} ellipsizeMode="tail">
                {activeOrder.operatorEmail || 'jsrxar@gmail.com'}
              </Text>
            </View>

            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Cliente / Razón Social:</Text>
              <Text style={styles.detailValueBlock}>{activeOrder.clientName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Unidades Verificadas:</Text>
              <Text style={[styles.detailValue, styles.textEmerald]}>
                {activeOrder.totalItemsScanned} / {activeOrder.totalItemsRequired} U (
                {Math.round((activeOrder.totalItemsScanned / activeOrder.totalItemsRequired) * 100)}%)
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estado Auditoría:</Text>
              <Text style={[styles.detailValue, isPartial ? styles.textAmber : styles.textEmerald]}>
                {isPartial ? 'DESPACHO PARCIAL OK' : 'APROBADO AL 100%'}
              </Text>
            </View>

            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Comprobante Registrado:</Text>
              <Text style={styles.detailValuePath} numberOfLines={1} ellipsizeMode="middle">
                {activeOrder.pdfFileName || `Pedido #${activeOrder.orderNumber}`}
              </Text>
            </View>

            {activeOrder.exceptionReason && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Marca de Agua / Auditoría:</Text>
                <Text style={styles.textEmerald}>{activeOrder.exceptionReason}</Text>
              </View>
            )}
          </View>

          {/* Single Action Button: Corroborar y Finalizar */}
          <TouchableOpacity style={styles.btnHome} onPress={handleCorroborateAndFinish} activeOpacity={0.8}>
            <Text style={styles.btnHomeText}>VOLVER A LISTA DE PEDIDOS</Text>
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
    padding: 16,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center'
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#161B22',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(166, 218, 149, 0.15)',
    borderWidth: 2,
    borderColor: '#A6DA95',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  iconCirclePartial: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B'
  },
  iconText: {
    fontSize: 32,
    color: '#A6DA95',
    fontWeight: '900'
  },
  iconTextPartial: {
    color: '#F59E0B'
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 26
  },
  subtitle: {
    fontSize: 13,
    color: '#8B949E',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 8
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#0B0E14',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    gap: 12,
    marginBottom: 24
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailBlock: {
    gap: 4
  },
  detailLabel: {
    fontSize: 12,
    color: '#8B949E',
    fontWeight: '600'
  },
  detailValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  detailValueBlock: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800'
  },
  detailValuePath: {
    fontSize: 12,
    color: '#8B949E',
    fontFamily: 'monospace'
  },
  textEmerald: {
    color: '#A6DA95'
  },
  textAmber: {
    color: '#F59E0B'
  },
  btnHome: {
    width: '100%',
    backgroundColor: '#A6DA95',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A6DA95',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  btnHomeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5
  }
});
