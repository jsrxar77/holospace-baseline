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
    else if (onBackToHome) goHome();
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
    borderWidth: 2,
    borderColor: '#00E676',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    gap: 16
  },
  iconCircle: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 3,
    borderColor: '#00E676',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconCirclePartial: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B'
  },
  iconText: {
    fontSize: 36,
    color: '#00E676',
    fontWeight: '900'
  },
  iconTextPartial: {
    color: '#F59E0B'
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 26
  },
  subtitle: {
    color: '#8B949E',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#0B0E14',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#30363D'
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  detailBlock: {
    flexDirection: 'column',
    gap: 4
  },
  detailLabel: {
    color: '#8B949E',
    fontSize: 13,
    fontWeight: '700'
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1
  },
  detailValueBlock: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20
  },
  detailValuePath: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18
  },
  textEmerald: {
    color: '#00E676',
    fontWeight: '900'
  },
  textAmber: {
    color: '#F59E0B',
    fontWeight: '900'
  },
  btnHome: {
    width: '100%',
    minHeight: 64, // Ergonomía > 64px
    backgroundColor: '#00E676',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8
  },
  btnHomeText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center'
  }
});
