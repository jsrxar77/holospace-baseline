import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useOrderStore } from '../store/useOrderStore';

interface DispatchScreenProps {
  onBackToHome: () => void;
}

export const DispatchScreen: React.FC<DispatchScreenProps> = ({ onBackToHome }) => {
  const { activeOrder, setActiveOrder } = useOrderStore();

  if (!activeOrder) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No hay orden seleccionada.</Text>
        <TouchableOpacity style={styles.btnHome} onPress={onBackToHome}>
          <Text style={styles.btnHomeText}>Volver al Inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isComplete = activeOrder.totalItemsScanned === activeOrder.totalItemsRequired;
  const isPartial = activeOrder.status === 'PARTIAL_DISPATCH';

  const handleExportAuditReport = async () => {
    try {
      const csvHeader = 'EAN,Descripcion,Requerido,Escaneado,Estado\n';
      const csvRows = activeOrder.items
        .map(
          (item) =>
            `"${item.code}","${item.description}",${item.quantityRequired},${item.quantityScanned},"${item.status}"`
        )
        .join('\n');

      const csvContent = `${csvHeader}${csvRows}`;
      const filePath = `${FileSystem.documentDirectory}Reporte_Auditoria_${activeOrder.orderNumber}.csv`;

      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: `Compartir Reporte de Auditoría #${activeOrder.orderNumber}`
        });
      } else {
        Alert.alert('Reporte Creado', `Se generó el archivo en: ${filePath}`);
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el reporte CSV de auditoría.');
    }
  };

  const handleFinishDispatch = () => {
    setActiveOrder(null);
    onBackToHome();
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
              ? 'El pedido fue cerrado con autorización de supervisor por faltantes físicos.'
              : 'La auditoría de stock ha finalizado con éxito. Todas las unidades han sido confirmadas.'}
          </Text>

          {/* Audit Summary Details Box */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cliente / Razón Social:</Text>
              <Text style={styles.detailValue}>{activeOrder.clientName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Unidades Verificadas:</Text>
              <Text style={styles.detailValueHighlight}>
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

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ubicación de Salida:</Text>
              <Text style={styles.detailValue}>Pasillo B-14 (Depósito #1)</Text>
            </View>

            {activeOrder.exceptionReason && (
              <View style={[styles.detailRow, { flexDirection: 'column', gap: 4 }]}>
                <Text style={styles.detailLabel}>Motivo de Excepción:</Text>
                <Text style={styles.textAmber}>{activeOrder.exceptionReason}</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.btnExport} onPress={handleExportAuditReport} activeOpacity={0.8}>
            <Text style={styles.btnExportText}>📄 Exportar Reporte de Auditoría (CSV)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnHome} onPress={handleFinishDispatch} activeOpacity={0.8}>
            <Text style={styles.btnHomeText}>PROCESAR NUEVO COMPROBANTE PDF</Text>
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
    paddingTop: 60,
    alignItems: 'center'
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#161B22',
    borderWidth: 2,
    borderColor: '#00E676',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    elevation: 10
  },
  iconCircle: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 3,
    borderColor: '#00E676',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconCirclePartial: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B'
  },
  iconText: {
    fontSize: 40,
    color: '#00E676',
    fontWeight: '900'
  },
  iconTextPartial: {
    color: '#F59E0B'
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28
  },
  subtitle: {
    color: '#8B949E',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#0B0E14',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#30363D'
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailLabel: {
    color: '#8B949E',
    fontSize: 14,
    fontWeight: '700'
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  detailValueHighlight: {
    color: '#00E676',
    fontSize: 15,
    fontWeight: '900'
  },
  textEmerald: {
    color: '#00E676',
    fontWeight: '900'
  },
  textAmber: {
    color: '#F59E0B',
    fontWeight: '900'
  },
  btnExport: {
    width: '100%',
    minHeight: 56,
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnExportText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  btnHome: {
    width: '100%',
    minHeight: 64, // Ergonomía > 64px
    backgroundColor: '#00E676',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6
  },
  btnHomeText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5
  }
});
