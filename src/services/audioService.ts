import { Audio } from 'expo-av';

export const audioService = {
  // Beep agudo (1000Hz) de confirmación exitosa
  playSuccessBeep: async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' },
        { shouldPlay: true }
      );
      await sound.setVolumeAsync(1.0);
      await sound.playAsync();
    } catch (e) {
      console.log('Audio success beep triggered');
    }
  },

  // Buzzer grave (250Hz) de alerta por código incorrecto o exceso
  playErrorBuzzer: async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' },
        { shouldPlay: true }
      );
      await sound.setVolumeAsync(1.0);
      await sound.playAsync();
    } catch (e) {
      console.log('Audio error buzzer triggered');
    }
  }
};
