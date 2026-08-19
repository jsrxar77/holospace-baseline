import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
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

  const { scanBarcode, lastScanToast, clearToast, loadInitialOrders, unassignedOrderNotification } = useOrderStore();
  const { theme } = useThemeStore();

  const isOmarchy = theme.borderRadius === 4;
  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (isOmarchy ? 4 : 16);
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (isOmarchy ? 4 : 12);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || 'JetBrains Mono';
  const fontFamilyMono = theme.fontMono || 'monospace';

  React.useEffect(() => {
    loadInitialOrders();
    const interval = setInterval(() => {
      loadInitialOrders();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (unassignedOrderNotification) {
      handleCloseScanner();
    }
  }, [unassignedOrderNotification]);

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.permissionText, { color: theme.textMain, fontFamily: fontFamilyMain }]}>
          Se requiere permiso de cámara para escanear los códigos de barras de depósito.
        </Text>
        <TouchableOpacity style={[styles.btnPermission, { backgroundColor: theme.emerald, borderRadius: btnRadius }]} onPress={requestPermission}>
          <Text style={[styles.btnPermissionText, { fontFamily: fontFamilyMain, color: '#11111B' }]}>Otorgar Permiso de Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (data) {
      const result = await scanBarcode(data);
      if (result === 'SUCCESS') {
        setTimeout(() => {
          handleCloseScanner();
        }, 400);
      }
    }
  };

  const handleManualSubmit = async () => {
    if (manualCode.trim()) {
      const codeToScan = manualCode.trim();
      setManualModalOpen(false);
      setManualCode('');
      const result = await scanBarcode(codeToScan);
      if (result === 'SUCCESS') {
        setTimeout(() => {
          handleCloseScanner();
        }, 400);
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

      {/* Target Reticle */}
      <View style={styles.overlayCenter}>
        <View style={[styles.scanFrame, { borderColor: theme.emerald, borderRadius: cardRadius }]}>
          <View style={[styles.cornerTopLeft, { borderColor: theme.emerald }]} />
          <View style={[styles.cornerTopRight, { borderColor: theme.emerald }]} />
          <View style={[styles.cornerBottomLeft, { borderColor: theme.emerald }]} />
          <View style={[styles.cornerBottomRight, { borderColor: theme.emerald }]} />
        </View>
      </View>

      {/* Scan Toast Feedback */}
      {lastScanToast && (
        <View
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
        </View>
      )}

      {/* Top Floating Action Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity
          style={[styles.btnCircle, { backgroundColor: isOmarchy ? '#181825' : '#161B22', borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
          onPress={() => setTorch(!torch)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>{torch ? '🔦' : '💡'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnCircle, { backgroundColor: isOmarchy ? '#181825' : '#161B22', borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
          onPress={() => setManualModalOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>⌨️</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sticky Action: Finalizar Escaneo */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.btnClose, { backgroundColor: isOmarchy ? '#1E1E2E' : '#21262D', borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
          onPress={handleCloseScanner}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnCloseText, { color: theme.textMain, fontFamily: fontFamilyMain }]}>FINALIZAR ESCANEO</Text>
        </TouchableOpacity>
      </View>

      {/* Manual Barcode Input Modal */}
      <Modal visible={isManualModalOpen} transparent animationType="fade" onRequestClose={() => setManualModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isOmarchy ? '#181825' : theme.cardBg, borderColor: theme.emerald, borderRadius: cardRadius, borderWidth: borderWidthVal }]}>
            <Text style={[styles.modalTitle, { color: theme.emerald, fontFamily: fontFamilyMain }]}>Ingreso Manual de EAN-13</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>
              Ingresa los dígitos del código de barras si la etiqueta está dañada:
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: isOmarchy ? '#11111B' : '#0B0E14', borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal, color: theme.textMain, fontFamily: fontFamilyMono }]}
              placeholder="Ej: 7791234567890"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={manualCode}
              onChangeText={setManualCode}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btnModalCancel, { backgroundColor: isOmarchy ? '#1E1E2E' : theme.cardBg, borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
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
                <Text style={[styles.btnModalConfirmText, { color: '#11111B', fontFamily: fontFamilyMain }]}>Procesar Código</Text>
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
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 100
  },
  toastText: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center'
  },
  topControls: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    gap: 12
  },
  btnCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnIcon: {
    fontSize: 18
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20
  },
  btnClose: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnCloseText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
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
