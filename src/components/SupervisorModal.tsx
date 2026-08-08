import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert } from 'react-native';

interface SupervisorModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (pin: string, reason: string) => void;
}

export const SupervisorModal: React.FC<SupervisorModalProps> = ({
  visible,
  onClose,
  onConfirm
}) => {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (pin.trim() !== '9999') {
      Alert.alert('PIN Incorrecto', 'El PIN de supervisor ingresado no es válido.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Motivo Requerido', 'Por favor ingresa un motivo para el cierre parcial por excepción.');
      return;
    }
    onConfirm(pin, reason);
    setPin('');
    setReason('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Autorización de Supervisor</Text>
          <Text style={styles.subtitle}>
            El pedido no alcanza el 100% verificado. Ingrese el PIN de supervisor para autorizar el despacho parcial.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PIN de Supervisor (Demo: 9999)</Text>
            <TextInput
              style={styles.input}
              placeholder="****"
              placeholderTextColor="#8B949E"
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={pin}
              onChangeText={setPin}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Motivo del Faltante / Excepción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ej: Mercadería faltante o rotura en depósito pasillo B-14..."
              placeholderTextColor="#8B949E"
              multiline
              numberOfLines={3}
              value={reason}
              onChangeText={setReason}
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnConfirm} onPress={handleSubmit}>
              <Text style={styles.btnConfirmText}>Autorizar Cierre</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#161B22',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 24,
    padding: 24,
    gap: 16
  },
  title: {
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center'
  },
  subtitle: {
    color: '#8B949E',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },
  inputGroup: {
    gap: 8
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  input: {
    backgroundColor: '#0B0E14',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  btnCancel: {
    flex: 1,
    minHeight: 56,
    backgroundColor: '#21262D',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  btnConfirm: {
    flex: 1,
    minHeight: 56,
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnConfirmText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900'
  }
});
