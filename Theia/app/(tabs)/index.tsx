import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    // Request permission on mount if not determined
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    setGranted(permission.granted);
  }, [permission, requestPermission]);

  if (granted === false) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Camera permission is required to show the feed.</ThemedText>
      </ThemedView>
    );
  }

  if (granted === null) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Requesting camera permission…</ThemedText>
      </ThemedView>
    );
  }

  // Show camera preview full screen
  return (
    <ThemedView style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing={Platform.OS === 'ios' ? 'back' : 'back'} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
