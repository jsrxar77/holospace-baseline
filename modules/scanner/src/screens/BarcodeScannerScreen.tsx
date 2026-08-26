import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useOrderStore } from '../store/useOrderStore';
import { useThemeStore } from '../store/useThemeStore';

interface BarcodeScannerScreenProps {
  onNavigate?: (screen: 'HOME' | 'SUMMARY' | 'SCANNER' | 'DISPATCH') => void;
  onClose?: () => void;
}

export const BarcodeScannerScreen: React.FC<BarcodeScannerScreenProps> = ({ onNavigate, onClose }) => {
  const handleCloseScanner = () => {
    if (onNavigate) onNavigate('SUMMARY');
    else if (onClose) onClose();
  };
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [isManualModalOpen, setManualModalOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const { activeOrder, scanBarcode, lastScanToast, clearToast, loadInitialOrders, unassignedOrderNotification } = useOrderStore();
  const { theme } = useThemeStore();

  const [scanComparison, setScanComparison] = useState<{
    expectedCode: string;
    scannedCode: string;
    description: string;
    isMatch: boolean;
    timestamp: number;
  } | null>(null);

  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (theme.borderRadius || 4);
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (theme.borderRadius || 4);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono');
  const fontFamilyMono = theme.fontMono || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'monospace');

  // Determinar el producto pendiente prioritario a escanear
  const pendingItem = activeOrder?.items.find((i) => (i.quantityScanned || 0) < i.quantityRequired) || activeOrder?.items[0];

  React.useEffect(() => {
    clearToast();
    loadInitialOrders();
    const interval = setInterval(() => {
      loadInitialOrders();
    }, 3000);
    return () => {
      clearInterval(interval);
      clearToast();
    };
  }, []);

  // Auto-dismiss del toast tras 2.5 segundos para no trabar el flujo de escaneo
  React.useEffect(() => {
    if (lastScanToast) {
      const timer = setTimeout(() => {
        clearToast();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [lastScanToast]);

  React.useEffect(() => {
    if (unassignedOrderNotification) {
      handleCloseScanner();
    }
  }, [unassignedOrderNotification]);

  if (!permission && Platform.OS !== 'web') {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  if (permission && !permission.granted && Platform.OS !== 'web') {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.permissionText, { color: theme.textMain, fontFamily: fontFamilyMain }]}>
          Se requiere permiso de cámara para escanear los códigos de barras de depósito.
        </Text>
        <TouchableOpacity style={[styles.btnPermission, { backgroundColor: theme.emerald, borderRadius: btnRadius }]} onPress={requestPermission}>
          <Text style={[styles.btnPermissionText, { fontFamily: fontFamilyMain, color: theme.background }]}>Otorgar Permiso de Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (data) {
      const currentTarget = activeOrder?.items.find((i) => (i.quantityScanned || 0) < i.quantityRequired) || activeOrder?.items[0];
      const result = await scanBarcode(data);
      const isSuccess = result === 'SUCCESS';
      
      setScanComparison({
        expectedCode: currentTarget?.code || 'N/A',
        scannedCode: data,
        description: currentTarget?.description || 'Producto',
        isMatch: isSuccess,
        timestamp: Date.now()
      });

      if (isSuccess) {
        setTimeout(() => {
          handleCloseScanner();
        }, 500);
      }
    }
  };

  const handleManualSubmit = async () => {
    if (manualCode.trim()) {
      const codeToScan = manualCode.trim();
      setManualModalOpen(false);
      setManualCode('');
      const currentTarget = activeOrder?.items.find((i) => (i.quantityScanned || 0) < i.quantityRequired) || activeOrder?.items[0];
      const result = await scanBarcode(codeToScan);
      const isSuccess = result === 'SUCCESS';

      setScanComparison({
        expectedCode: currentTarget?.code || 'N/A',
        scannedCode: codeToScan,
        description: currentTarget?.description || 'Producto',
        isMatch: isSuccess,
        timestamp: Date.now()
      });

      if (isSuccess) {
        setTimeout(() => {
          handleCloseScanner();
        }, 500);
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'qr']
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Top Floating Controls Container */}
      <View style={styles.topSection}>
        {/* Fila de Botones: Volver, Flash, Manual */}
        <View style={styles.topControlsRow}>
          <TouchableOpacity
            style={[styles.btnHeaderBack, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
            onPress={handleCloseScanner}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnHeaderBackText, { color: theme.emerald, fontFamily: fontFamilyMain }]}>← RESUMEN</Text>
          </TouchableOpacity>

          <View style={styles.topRightActions}>
            <TouchableOpacity
              style={[styles.btnPill, { backgroundColor: theme.cardBg, borderColor: torch ? theme.amber : theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
              onPress={() => setTorch(!torch)}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnPillText, { color: torch ? theme.amber : theme.textMain, fontFamily: fontFamilyMono }]}>{torch ? 'FLASH ON' : 'FLASH'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
              onPress={() => setManualModalOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnPillText, { color: theme.textMain, fontFamily: fontFamilyMono }]}>MANUAL</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta de Producto Objetivo (Debajo de Resumen) */}
        {pendingItem && (
          <View style={[styles.targetProductCard, { backgroundColor: theme.cardBg, borderColor: theme.emerald, borderRadius: cardRadius, borderWidth: borderWidthVal }]}>
            <View style={styles.targetHeaderRow}>
              <Text style={[styles.targetBadge, { color: theme.emerald, fontFamily: fontFamilyMono }]}>
                PRODUCTO A ESCANEAR
              </Text>
              <Text style={[styles.targetQty, { color: theme.amber, fontFamily: fontFamilyMono }]}>
                {pendingItem.quantityScanned} / {pendingItem.quantityRequired} U
              </Text>
            </View>
            <Text style={[styles.targetDescription, { color: theme.textMain, fontFamily: fontFamilyMain }]} numberOfLines={2}>
              {pendingItem.description}
            </Text>
            <Text style={[styles.targetCode, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>
              EAN Requerido: {pendingItem.code}
            </Text>
          </View>
        )}
      </View>

      {/* Target Reticle (Cuadrado con Línea Central Láser) */}
      <View style={styles.overlayCenter}>
        <View style={[styles.scanFrame, { borderColor: theme.emerald, borderRadius: cardRadius }]}>
          <View style={[styles.cornerTopLeft, { borderColor: theme.emerald }]} />
          <View style={[styles.cornerTopRight, { borderColor: theme.emerald }]} />
          <View style={[styles.cornerBottomLeft, { borderColor: theme.emerald }]} />
          <View style={[styles.cornerBottomRight, { borderColor: theme.emerald }]} />

          {/* Línea Central de Alineación Láser */}
          <View style={[styles.centerLaserLine, { backgroundColor: theme.emerald }]} />
        </View>

        {/* Panel Comparativo Post-Lectura (Esperado vs. Escaneado) */}
        {scanComparison && (
          <View style={[
            styles.comparisonCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: scanComparison.isMatch ? theme.emerald : theme.red,
              borderRadius: cardRadius,
              borderWidth: borderWidthVal
            }
          ]}>
            <View style={styles.comparisonHeader}>
              <Text style={[
                styles.comparisonStatusText,
                { color: scanComparison.isMatch ? theme.emerald : theme.red, fontFamily: fontFamilyMain }
              ]}>
                {scanComparison.isMatch ? 'LECTURA CORRECTA' : 'DISCREPANCIA DE CODIGO'}
              </Text>
              <TouchableOpacity onPress={() => setScanComparison(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={[styles.comparisonClose, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.comparisonRow}>
              <View style={styles.comparisonCol}>
                <Text style={[styles.comparisonLabel, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>ESPERADO</Text>
                <Text style={[styles.comparisonVal, { color: theme.emerald, fontFamily: fontFamilyMono }]}>
                  {scanComparison.expectedCode}
                </Text>
              </View>
              <View style={[styles.comparisonColDivider, { backgroundColor: theme.cardBorder }]} />
              <View style={styles.comparisonCol}>
                <Text style={[styles.comparisonLabel, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>ESCANEADO</Text>
                <Text style={[styles.comparisonVal, { color: scanComparison.isMatch ? theme.emerald : theme.red, fontFamily: fontFamilyMono }]}>
                  {scanComparison.scannedCode}
                </Text>
              </View>
            </View>

            {!scanComparison.isMatch && (
              <Text style={[styles.comparisonHelpText, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>
                Verifica los digitos o toma una captura de pantalla para auditoria.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Scan Toast Feedback */}
      {lastScanToast && (
        <TouchableOpacity
          onPress={clearToast}
          activeOpacity={0.9}
          style={[
            styles.toastContainer,
            {
              backgroundColor: lastScanToast.type === 'SUCCESS' ? theme.emerald : theme.red,
              borderRadius: btnRadius
            }
          ]}
        >
          <Text style={[styles.toastText, { fontFamily: fontFamilyMain, color: lastScanToast.type === 'SUCCESS' ? '#11111B' : '#FFFFFF' }]}>
            {lastScanToast.message}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bottom Sticky Action: Finalizar Escaneo */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.btnClose, { backgroundColor: theme.cardBg, borderColor: theme.emerald, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
          onPress={handleCloseScanner}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnCloseText, { color: theme.emerald, fontFamily: fontFamilyMain }]}>VOLVER AL RESUMEN</Text>
        </TouchableOpacity>
      </View>

      {/* Manual Barcode Input Modal */}
      <Modal visible={isManualModalOpen} transparent animationType="fade" onRequestClose={() => setManualModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.emerald, borderRadius: cardRadius, borderWidth: borderWidthVal }]}>
            <Text style={[styles.modalTitle, { color: theme.emerald, fontFamily: fontFamilyMain }]}>Ingreso Manual de EAN-13</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>
              Ingresa los dígitos del código de barras si la etiqueta está dañada:
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal, color: theme.textMain, fontFamily: fontFamilyMono }]}
              placeholder="Ej: 7791234567890"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={manualCode}
              onChangeText={setManualCode}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnModalCancel, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
                onPress={() => setManualModalOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnModalCancelText, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnModalConfirm, { backgroundColor: theme.emerald, borderColor: theme.emerald, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
                onPress={handleManualSubmit}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnModalConfirmText, { color: theme.background, fontFamily: fontFamilyMain }]}>Procesar Código</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  btnPermission: {
    paddingVertical: 14,
    paddingHorizontal: 24
  },
  btnPermissionText: {
    fontSize: 14,
    fontWeight: '900'
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scanFrame: {
    width: 260,
    height: 180,
    borderWidth: 2,
    position: 'relative'
  },
  cornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderLeftWidth: 4
  },
  cornerTopRight: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderRightWidth: 4
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderLeftWidth: 4
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderRightWidth: 4
  },
  centerLaserLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '50%',
    height: 2,
    opacity: 0.85
  },
  topSection: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    left: 16,
    right: 16,
    gap: 10,
    zIndex: 100
  },
  topControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  targetProductCard: {
    padding: 12,
    gap: 4
  },
  targetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  targetBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  targetQty: {
    fontSize: 12,
    fontWeight: '900'
  },
  targetDescription: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18
  },
  targetCode: {
    fontSize: 11,
    letterSpacing: 0.5
  },
  comparisonCard: {
    marginTop: 16,
    width: 280,
    padding: 12,
    gap: 8,
    zIndex: 100
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  comparisonStatusText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  comparisonClose: {
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 4
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  comparisonCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2
  },
  comparisonColDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 8
  },
  comparisonLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  comparisonVal: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  comparisonHelpText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 110
  },
  toastText: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center'
  },
  btnHeaderBack: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnHeaderBackText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  btnPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 100
  },
  btnClose: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  btnCloseText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    padding: 24,
    gap: 14
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18
  },
  modalInput: {
    padding: 14,
    fontSize: 16,
    fontWeight: '700'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  btnModalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnModalCancelText: {
    fontSize: 13,
    fontWeight: '800'
  },
  btnModalConfirm: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnModalConfirmText: {
    fontSize: 13,
    fontWeight: '900'
  }
});
