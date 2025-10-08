import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [granted, setGranted] = useState<boolean | null>(null);
  const insets = useSafeAreaInsets();

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
  const borderInsets = Platform.OS === 'web' ? {
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
  } : {
    top: insets.top,
    left: 10,
    right: 10,
    bottom: 10,
  };

  return (
    <ThemedView style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing={Platform.OS === 'ios' ? 'back' : 'back'} />
      <View style={[styles.borderOverlay, borderInsets]} pointerEvents="none" />
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
  borderOverlay: {
    position: 'absolute',
    borderWidth: 5,
    borderColor: 'white',
    borderRadius: 40,
  },
});
