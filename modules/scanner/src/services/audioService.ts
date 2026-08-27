import { Audio } from 'expo-av';

const SUCCESS_BEEP_URI = 'data:audio/wav;base64,UklGRsQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAFAACA4fGlOQg5pPHggB8OW8X2xVsPIH/f8KQ6Cjqk79+AIRBbxPXEWxAhf97uozsLO6Pu3X8iEVzD88NcEiJ/3O2jPA08o+zcfyMTXMLxwlwUJH/b66I9Dz2i69uAJRVdwfDBXRUlgNrqoj4QPqLp2YAmFl3A7sBdFyZ/2OihPxI/oefYgCcYXr/sv14YKIDX5qFAFECh5teAKRlevuu+Xhopf9bloEEVQaDk1YAqG1++6b1fGyp/1OOgQhdCoOPUgCsdX73nvF8dLIDT4p9DGUOf4dKALR5gvOa7YB8tf9Lgn0QaRJ/g0YAuIGC75LphIC9/0N6eRRxFnt7QgC8hYbriuWEiMH/P3Z5GHkae3M5/MSNhueG5YiMxgM7bnUcfR53bzYAyJWK437hiJTN/zNqdSCFIndnMgDMmYrfdt2MnNH/L2JxJI0mc2Mp/NShjtty2Yyg1f8rXnEokSpzWyYA2KWS12rVkKjd/yNWbSyZLm9TIgDcrZLTYtGQrOH/H05tMKEyb08aAOSxls9ezZS05gMbSmk0pTZrRxYA6LmWy1bJlLzt/xNCaTitOmtDEgDswZrHTsWYwPH/Dz5lPLU+ZzsKAPTFmsNKwZjI9f8LNmVAuUJnNwYA+M2ev0K9nMz9/wMuYUTBRmMvAgEA0Z67Ormc1QH+/yphSMlKYyb6AQTZorc2taDZBf73Il1MzU5fIvYBCOGisy6xoOEOAvMeXVDVUlsa8f0Q5aavJq2k6RIC7xZZVN1WWxbqARTtpqsiqaTtFf7nEllY4VpXDuYBGPGqpxqlqPUd/uMKVVzpXlcG4gEg+aqjEqGo+SH+3wJVYPFiUwLZ/ST9rp8Ona0BJf7W/lFk9WZS+tYBKQWumwaZrQkuAtL2UWT9ak72zgExDbKW/pWxDTH+zvJNaQVuTu7KATURspL6kbEVOf7G6kltCXJK6sYBORm2jvKNtRk9/sLiSXERdkrivgFBHbaK6om1IUH+vt5FdRl6Rtq6AUUluobmhbklSf621kV5HXpG1rX9SS26gt6BuS1N/rLSQX0lfkLOrgFRMb5+1n29NVICrspBgS2CQsqqAVU5vnrSeb05Wf6mwj2FMYY+wqYBWT3Cdsp1wUFd/qK+PYk5ij66ngFhRcJywnHBRWH+nrY5jUGOOraaAWVJxm6+bcVNaf6WsjmRRZI6rpYBaVHGarZpyVVt/pKqNZVNljaqjf1xWcpmrmXJWXH+iqY1mVWaNqKKAXVdymKqYc1hef6GnjGdWZ4ymoYBfWXOXqJdzWV9/oKWMaFhojKWfgGBac5amlnRbYH+epItpWmmLo56AYVx0laWVdFxif52ii2pbaouinYBjXnWUo5R1XmN/nKGKa11riqCbgGRfdZOhk3VgZH+an4psX2yKn5p/ZWF2kqCSdmFmf5mdiW1gbYmdmYBnYnaRnpF2Y2eAmJyJbmJuiZuXgGhkd5CckHdkaYCWmohvZG+ImpaAaWZ3j5uPd2ZqgJWZiHBlcIiYlIBrZ3iOmY54aGt/lJeHcWdxh5eTgGxpeI6XjXhpbX+SlodyaXKHlZKAbWp5jZaMeWtuf5GUhnNqc4aTkIBvbHmMlIt5bG9/kJKGdGx0hpKPgHBteouSinpucX+OkYV1bnWFkI5/cW96ipGJem9yf42PhXZvdoSPjIBzcXuJj4l7cXOAjI6Ed3F3hI2LgHRye4iNiHtzdX+KjIR4c3iDjIp/dXR8h4yHfHR2f4mKg3l0eYOKiIB3dXyGioZ8dneAiImDenZ6goiHgHh3fYWIhX13eX+Gh4J7eHuCh4Z/eXl9hIeEfXl6f4WGgXx5fIGFhH97en6DhYN+e3t/g4SBfXt9gYSDgHx8foKDgn58fX+Cg4B+fX6AgoKAfn1/gYKBf35+f4GBgH9+f4CAgIB/f3+AgIB/f38=';

const ERROR_BUZZER_URI = 'data:audio/wav;base64,UklGRhQLAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YfAKAAAg39/f39/f39/f39/f39/f39/fICAgICAgICAgICAhISEhISEh3t7e3t7e3t7e3t7e3t7e3t7eISEhISIiIiIiIiIiIiIiIiIi3d3d3d3d3d3d3d3d3d3d3NzcIyMjIyMjIyMjIyMjIyMjIyMjI9zc3Nzc3Nzb29vb29vb29vb2yQkJCQkJCQkJCQkJCQkJCQkJNra2tra2tra2tra2tra2tra2iUlJSUlJSUlJSUlJiYmJiYmJtnZ2dnZ2dnZ2dnZ2dnZ2dnZ2SYmJiYmJycnJycnJycnJycnJyfY2NjY2NjY2NjY2NjY2NjX19coKCgoKCgoKCgoKCgoKCgoKCjX19fX19fX19bW1tbW1tbW1tYpKSkpKSkpKSkpKSkpKSkpKSnW1dXV1dXV1dXV1dXV1dXV1dXVKioqKioqKioqKiorKysrKysr1NTU1NTU1NTU1NTU1NTU1NTUKysrKywsLCwsLCwsLCwsLCws09PT09PT09PT09PT09PT09LSLS0tLS0tLS0tLS0tLS0tLS0t0tLS0tLS0tLS0dHR0dHR0dHR0S4uLi4uLi4uLi4uLi4uLi4uLtHQ0NDQ0NDQ0NDQ0NDQ0NDQ0C8vLy8vLy8vLy8vLzAwMDAwMM/Pz8/Pz8/Pz8/Pz8/Pz8/PzzAwMDAwMTExMTExMTExMTExMTHOzs7Ozs7Ozs7Ozs7Ozs7Ozc0yMjIyMjIyMjIyMjIyMjIyMjLNzc3Nzc3Nzc3MzMzMzMzMzMwzMzMzMzMzMzMzMzMzMzMzMzPMzMvLy8vLy8vLy8vLy8vLy8vLNDQ0NDQ0NDQ0NDQ0NTU1NTU1ysrKysrKysrKysrKysrKysrKNTU1NTU2NjY2NjY2NjY2NjY2ycnJycnJycnJycnJycnJycjINzc3Nzc3Nzc3Nzc3Nzc3Nzc3yMjIyMjIyMjIyMfHx8fHx8fHxzg4ODg4ODg4ODg4ODg4ODg4OMfHxsbGxsbGxsbGxsbGxsbGxjk5OTk5OTk5OTk5OTk6Ojo6OsXFxcXFxcXFxcXFxcXFxcXFxTo6Ojo6Ojs7Ozs7Ozs7Ozs7O8TExMTExMTExMTExMTExMTEw8M8PDw8PDw8PDw8PDw8PDw8PDzDw8PDw8PDw8PCwsLCwsLCwsI9PT09PT09PT09PT09PT09PT3CwsLBwcHBwcHBwcHBwcHBwcE+Pj4+Pj4+Pj4+Pj4+Pj8/Pz8/wMDAwMDAwMDAwMDAwMDAwMDAPz8/Pz8/QEBAQEBAQEBAQEBAv7+/v7+/v7+/v7+/v7+/v7++QUFBQUFBQUFBQUFBQUFBQUFBvr6+vr6+vr6+vr29vb29vb29QkJCQkJCQkJCQkJCQkJCQkJCQr29vLy8vLy8vLy8vLy8vLy8vENDQ0NDQ0NDQ0NDQ0NERERERLu7u7u7u7u7u7u7u7u7u7u7u0RERERERERFRUVFRUVFRUVFRbq6urq6urq6urq6urq6urq6urlGRkZGRkZGRkZGRkZGRkZGRka5ubm5ubm5ubm5uLi4uLi4uLhHR0dHR0dHR0dHR0dHR0dHR0e4uLi3t7e3t7e3t7e3t7e3t7dISEhISEhISEhISEhISElJSUlJtra2tra2tra2tra2tra2tra2SUlJSUlJSkpKSkpKSkpKSkpKtbW1tbW1tbW1tbW1tbW1tbW1S0tLS0tLS0tLS0tLS0tLS0tLtLS0tLS0tLS0tLSzs7Ozs7OzTExMTExMTExMTExMTExMTExMTLOzs7KysrKysrKysrKysrKysk1NTU1NTU1NTU1NTU1NTk5OTrGxsbGxsbGxsbGxsbGxsbGxsU5OTk5OTk5PT09PT09PT09PT7CwsLCwsLCwsLCwsLCwsLCwsLBQUFBQUFBQUFBQUFBQUFBQUFCvr6+vr6+vr6+vr66urq6urq5RUVFRUVFRUVFRUVFRUVFRUVGurq6ura2tra2tra2tra2tra1SUlJSUlJSUlJSUlJSUlJTU1OsrKysrKysrKysrKysrKysrKysU1NTU1NTU1RUVFRUVFRUVFRUq6urq6urq6urq6urq6urq6urVVVVVVVVVVVVVVVVVVVVVVVVqqqqqqqqqqqqqqqqqampqampVlZWVlZWVlZWVlZWVlZWVlZWqampqamoqKioqKioqKioqKioqFdXV1dXV1dXV1dXV1dXV1hYWKenp6enp6enp6enp6enp6enp1hYWFhYWFhYWVlZWVlZWVlZWaampqampqampqampqampqampllaWlpaWlpaWlpaWlpaWlpaWlqlpaWlpaWlpaWlpaSkpKSkpKRbW1tbW1tbW1tbW1tbW1tbW1ukpKSkpKOjo6Ojo6Ojo6Ojo6NcXFxcXFxcXFxcXFxcXFxcXV2ioqKioqKioqKioqKioqKioqJdXV1dXV1dXV1eXl5eXl5eXl5eoaGhoaGhoaGhoaGhoaGhoaGhXl9fX19fX19fX19fX19fX19foKCgoKCgoKCgoKCgn5+fn5+fYGBgYGBgYGBgYGBgYGBgYGBgn5+fn5+enp6enp6enp6enp6enmFhYWFhYWFhYWFhYWFhYWJiYp2dnZ2dnZ2dnZ2dnZ2dnZ2dnWJiYmJiYmJiYmNjY2NjY2NjY5ycnJycnJycnJycnJycnJycnGNjZGRkZGRkZGRkZGRkZGRkZJubm5ubm5ubm5ubm5uampqampplZWVlZWVlZWVlZWVlZWVlZWWampqampmZmZmZmZmZmZmZmZlmZmZmZmZmZmZmZmZmZmZmZ2eYmJiYmJiYmJiYmJiYmJiYmJhnZ2dnZ2dnZ2doaGhoaGhoaGhol5eXl5eXl5eXl5eXl5eXl5eXaGhpaWlpaWlpaWlpaWlpaWlplpaWlpaWlpaWlpaWlpWVlZWVampqampqampqampqampqampqlZWVlZWVlJSUlJSUlJSUlJSUa2tra2tra2tra2tra2tra2tsbJOTk5OTk5OTk5OTk5OTk5OTk2xsbGxsbGxsbG1tbW1tbW1tbZKSkpKSkpKSkpKSkpKSkpKSkm1tbm5ubm5ubm5ubm5ubm5ubpGRkZGRkZGRkZGRkZGRkJCQkJBvb29vb29vb29vb29vb29vb2+QkJCQkJCPj4+Pj4+Pj4+Pj49wcHBwcHBwcHBwcHBwcHBwcHGOjo6Ojo6Ojo6Ojo6Ojo6Ojo5xcXFxcXFxcXFxcnJycnJycnJyjY2NjY2NjY2NjY2NjY2NjY2NcnJzc3Nzc3Nzc3Nzc3Nzc3NzjIyMjIyMjIyMjIyMjIyLi4uLdHR0dHR0dHR0dHR0dHR0dHR0i4uLi4uLi4qKioqKioqKioqKdXV1dXV1dXV1dXV1dXV1dXV1domJiYmJiYmJiYmJiYmJiYmJiXZ2dnZ2dnZ2dnZ3d3d3d3d3d4iIiIiIiIiIiIiIiIiIiIiIiHd3d3h4eHh4eHh4eHh4eHh4eIeHh4eHh4eHh4eHh4eHhoaGhnl5eXl5eXl5eXl5eXl5eXl5eXmGhoaGhoaGhYWFhYWFhYWFhYV6enp6enp6enp6enp6enp6enqEhISEhISEhISEhISEhISEhIR7e3t7e3t7e3t7e3x8fHx8fHyDg4ODg4ODg4ODg4ODg4ODg4ODfHx8fX19fX19fX19fX19fX19goKCgoKCgoKCgoKCgoKBgYGBfn5+fn5+fn5+fn5+fn5+fn5+gYGBgYGBgYCAgICAgICAgICAf39/f39/f39/f39/f39/f39/';

let isAudioConfigured = false;

const ensureAudioMode = async () => {
  if (!isAudioConfigured) {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
      isAudioConfigured = true;
    } catch (e) {
      console.log('Error configurando AudioMode:', e);
    }
  }
};

export const audioService = {
  // Beep agudo (1200Hz) de confirmación exitosa
  playSuccessBeep: async () => {
    try {
      await ensureAudioMode();
      const { sound } = await Audio.Sound.createAsync(
        { uri: SUCCESS_BEEP_URI },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.log('Error reproduciendo beep de éxito:', e);
    }
  },

  // Buzzer grave (220Hz) de alerta por código incorrecto o exceso
  playErrorBuzzer: async () => {
    try {
      await ensureAudioMode();
      const { sound } = await Audio.Sound.createAsync(
        { uri: ERROR_BUZZER_URI },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.log('Error reproduciendo buzzer de error:', e);
    }
  }
};
