import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity } from 'react-native';
import { showThemedAlert } from './ThemedAlertModal';
import { useThemeStore } from '../store/useThemeStore';

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
  const { theme } = useThemeStore();

  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (theme.borderRadius || 4);
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (theme.borderRadius || 4);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono');
  const fontFamilyMono = theme.fontMono || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'monospace');

  const handleConfirm = () => {
    if (pin.trim() !== '9999') {
      showThemedAlert('PIN incorrecto', 'El PIN no es válido. Probá de nuevo.', [{ text: 'Entendido', style: 'default' }]);
      return;
    }
    if (!reason.trim()) {
      showThemedAlert('Falta el motivo', 'Contanos por qué se cierra el pedido con faltantes.', [{ text: 'Entendido', style: 'default' }]);
      return;
    }
    onConfirm(pin, reason);
    setPin('');
    setReason('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.amber, borderRadius: cardRadius, borderWidth: borderWidthVal }]}>
          <Text style={[styles.title, { color: theme.amber, fontFamily: fontFamilyMain }]}>Autorización de un supervisor</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>
            Faltan productos por escanear. Un supervisor debe ingresar su PIN para cerrar el pedido con faltantes:
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>PIN del supervisor (4 números)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal, color: theme.textMain, fontFamily: fontFamilyMono }]}
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              value={pin}
              onChangeText={setPin}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Motivo</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.background, borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal, color: theme.textMain, fontFamily: fontFamilyMono }]}
              placeholder="Ej: no hay más stock en el depósito"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              value={reason}
              onChangeText={setReason}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnCancel, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnCancelText, { color: theme.textMuted, fontFamily: fontFamilyMain }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnConfirm, { backgroundColor: theme.amber, borderColor: theme.amber, borderRadius: btnRadius, borderWidth: borderWidthVal }]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnConfirmText, { color: theme.background, fontFamily: fontFamilyMain }]}>Autorizar y cerrar</Text>
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
    padding: 24,
    gap: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center'
  },
  inputGroup: {
    gap: 6
  },
  label: {
    fontSize: 12,
    fontWeight: '700'
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700'
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  btnCancel: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center'
  },
  btnConfirm: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  btnConfirmText: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center'
  }
});
