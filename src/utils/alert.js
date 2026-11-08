import { Alert, Platform } from 'react-native';

// Alert.alert does nothing on the web build, so use the browser's own dialog there.
export function showAlert(title, message) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
