import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useOrderStore } from '../store/useOrderStore';

interface BarcodeScannerScreenProps {
  onClose: () => void;
}

export const BarcodeScannerScreen: React.FC<BarcodeScannerScreenProps> = ({ onClose }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [isManualModalOpen, setManualModalOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const { scanBarcode, lastScanToast, clearToast } = useOrderStore();

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Se requiere permiso de cámara para escanear los códigos de barras de depósito.
        </Text>
        <TouchableOpacity style={styles.btnPermission} onPress={requestPermission}>
          <Text style={styles.btnPermissionText}>Otorgar Permiso de Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (data) {
      const result = await scanBarcode(data);
      if (result === 'SUCCESS') {
        setTimeout(() => {
          onClose();
        }, 400);
      }
    }
  };

  const handleManualSubmit = async () => {
    if (manualCode.trim()) {
      const result = await scanBarcode(manualCode.trim());
      setManualCode('');
      setManualModalOpen(false);
      if (result === 'SUCCESS') {
        setTimeout(() => {
          onClose();
        }, 400);
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'code128', 'qr', 'ean8', 'code39']
        }}
        onBarcodeScanned={handleBarcodeScanned}
      >
        <View style={styles.overlay}>
          {/* Top Real-Time Notification Toast */}
          {lastScanToast && (
            <View
              style={[
                styles.toast,
                lastScanToast.type === 'SUCCESS' && styles.toastSuccess,
                lastScanToast.type === 'ERROR' && styles.toastError,
                lastScanToast.type === 'EXCESS' && styles.toastExcess
              ]}
            >
              <Text style={styles.toastIcon}>
                {lastScanToast.type === 'SUCCESS' ? '✓' : '⚠️'}
              </Text>
              <View style={styles.toastTextGroup}>
                <Text style={styles.toastMessage}>{lastScanToast.message}</Text>
                <Text style={styles.toastCode}>{lastScanToast.code}</Text>
              </View>
              <TouchableOpacity style={styles.toastClose} onPress={clearToast}>
                <Text style={styles.toastCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Reticle Box Box Frame */}
          <View style={styles.reticleFrame}>
            <View style={styles.laserLine} />
          </View>

          {/* Bottom Control Bar */}
          <View style={styles.controlBar}>
            <View style={styles.tacticalRow}>
              <TouchableOpacity
                style={[styles.btnTactical, torch && styles.btnTacticalActive]}
                onPress={() => setTorch(!torch)}
              >
                <Text style={styles.tacticalIcon}>💡</Text>
                <Text style={styles.tacticalText}>
                  {torch ? 'Linterna ON' : 'Flash Linterna'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnTactical}
                onPress={() => setManualModalOpen(true)}
              >
                <Text style={styles.tacticalIcon}>⌨️</Text>
                <Text style={styles.tacticalText}>Entrada Manual</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btnClose} onPress={onClose}>
              <Text style={styles.btnCloseText}>CERRAR ESCÁNER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      {/* Manual Input Backup Modal */}
      <Modal visible={isManualModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Entrada Manual por Teclado</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa el código EAN-13 o SKU del producto impreso en la caja:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Ej: 7794450008275"
              placeholderTextColor="#8B949E"
              keyboardType="numeric"
              value={manualCode}
              onChangeText={setManualCode}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setManualModalOpen(false)}
              >
                <Text style={styles.btnModalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnModalSubmit} onPress={handleManualSubmit}>
                <Text style={styles.btnModalSubmitText}>Validar EAN</Text>
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
    backgroundColor: '#0B0E14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24
  },
  btnPermission: {
    backgroundColor: '#00E676',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16
  },
  btnPermissionText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center'
  },
  camera: {
    flex: 1
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    gap: 12,
    marginTop: 40,
    elevation: 8
  },
  toastSuccess: {
    backgroundColor: '#00E676'
  },
  toastError: {
    backgroundColor: '#FF5252'
  },
  toastExcess: {
    backgroundColor: '#F59E0B'
  },
  toastIcon: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000'
  },
  toastTextGroup: {
    flex: 1
  },
  toastMessage: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900'
  },
  toastCode: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700'
  },
  toastClose: {
    padding: 8
  },
  toastCloseText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '900'
  },
  reticleFrame: {
    width: 280,
    height: 180,
    borderWidth: 3,
    borderColor: '#00E676',
    borderRadius: 20,
    alignSelf: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  laserLine: {
    width: '100%',
    height: 3,
    backgroundColor: '#FF5252'
  },
  controlBar: {
    backgroundColor: '#161B22',
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#30363D'
  },
  tacticalRow: {
    flexDirection: 'row',
    gap: 12
  },
  btnTactical: {
    flex: 1,
    minHeight: 64, // Ergonomía > 64px
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 4
  },
  btnTacticalActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)'
  },
  tacticalIcon: {
    fontSize: 20
  },
  tacticalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center'
  },
  btnClose: {
    minHeight: 64, // Ergonomía > 64px
    backgroundColor: '#FF5252',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  btnCloseText: {
    color: '#FFFFFF',
    fontSize: 18,
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
    backgroundColor: '#161B22',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#00E676',
    padding: 24,
    gap: 16
  },
  modalTitle: {
    color: '#00E676',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center'
  },
  modalSubtitle: {
    color: '#8B949E',
    fontSize: 14,
    textAlign: 'center'
  },
  modalInput: {
    backgroundColor: '#0B0E14',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 14,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12
  },
  btnModalCancel: {
    flex: 1,
    minHeight: 56,
    backgroundColor: '#21262D',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  btnModalCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center'
  },
  btnModalSubmit: {
    flex: 1,
    minHeight: 56,
    backgroundColor: '#00E676',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  btnModalSubmitText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center'
  }
});
