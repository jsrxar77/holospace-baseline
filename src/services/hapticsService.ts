import * as Haptics from 'expo-haptics';

export const hapticsService = {
  // 1 pulso háptico corto (50ms) para coincidencia de código
  notifySuccess: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log('Haptics error:', e);
    }
  },

  // 2 pulsos hápticos largos e intensos (200ms) para error de producto
  notifyError: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e) {
      console.log('Haptics error:', e);
    }
  },

  // Vibración ligera para acciones táctiles en botones
  notifyImpact: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.log('Haptics error:', e);
    }
  }
};
