import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { speakText } from '@/lib/speak';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const prompt = 'You are an sighted assistant for visually impaired users. The user points their camera at an object or text. Describe or transcribe the item closest to the center of the frame or ANY/ALL text in frame to the user. Be concise and clear when describing. Copy all text verbatim when transcribing. Simply provide the description or transcription without additional commentary, e.g. DO NOT SAY "the image..." or similar phrases. If a person is present, describe their actions and appearance. Your response will be converted to speech, so do not use any special characters or formatting. Do not tell the user that you are an AI model. Do not tell the user you are unable to describe people or things.';

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string>('');
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Request permission on mount if not determined
    if (!permission) return;
    // On web/iOS Safari, camera permission prompts must be triggered by a user gesture.
    // Auto-calling requestPermission() on mount can cause an immediate denied state without a prompt.
    // So only auto-request on native; on web we show a button the user can tap.
    if (Platform.OS !== 'web') {
      if (!permission.granted && permission.canAskAgain) {
        requestPermission();
      }
    }
    setGranted(permission.granted);
  }, [permission, requestPermission]);

  const handleTap = async () => {
    if (!cameraRef.current || isAnalyzing) {
      console.log('[Flow] Tap ignored - cameraRef?', !!cameraRef.current, 'isAnalyzing?', isAnalyzing);
      return;
    }

    try {
      const t0 = Date.now();
      console.log('[Flow] Tap -> start capture');
      setIsAnalyzing(true);
      setResult('');

      // Take a picture
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });
      console.log('[Capture] done in', Date.now() - t0, 'ms', {
        hasBase64: !!photo?.base64,
        width: (photo as any)?.width,
        height: (photo as any)?.height,
        base64Len: photo?.base64?.length,
      });

      if (!photo || !photo.base64) {
        console.log('[Capture] Missing photo/base64');
        Alert.alert('Error', 'Failed to capture image');
        return;
      }

      // Guess MIME from URI, default to JPEG
      const uri = (photo as any)?.uri as string | undefined;
      const lower = uri?.toLowerCase() ?? '';
      const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
      console.log('[Vision] inferred mime:', mime, 'from uri:', uri);

      // Send to GPT-4o Vision
      const t1 = Date.now();
      console.log('[Vision] analyze -> start, base64Len:', photo.base64.length, 'mime:', mime);
      await analyzeImage(photo.base64, mime);
      console.log('[Vision] analyze -> done in', Date.now() - t1, 'ms');
    } catch (error) {
      console.error('[Flow] Error capturing/analyzing image:', error);
      Alert.alert('Error', 'Failed to capture or analyze image');
    } finally {
      setIsAnalyzing(false);
      console.log('[Flow] done');
    }
  };

  const analyzeImage = async (base64Image: string, contentType: 'image/jpeg' | 'image/png' = 'image/jpeg') => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      console.log('[Vision] Missing API key');
      Alert.alert('Error', 'Please set your OpenAI API key in the .env file');
      return;
    }

    try {
      const tReq = Date.now();
      console.log('[Vision] POST /v1/chat/completions start');
      // Sanitize base64 and construct data URL
      const cleanedBase64 = base64Image.replace(/\s+/g, '');
      const isDataUrl = cleanedBase64.startsWith('data:');
      const imageUrl = isDataUrl ? cleanedBase64 : `data:${contentType};base64,${cleanedBase64}`;
      console.log('[Vision] imageUrl prefix:', imageUrl.slice(0, 40));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });
      console.log('[Vision] response status:', response.status, 'elapsed', Date.now() - tReq, 'ms');
      const data = await response.json();
      console.log('[Vision] response json keys:', Object.keys(data || {}));
      
      if (!response.ok) {
        console.log('[Vision] error body:', data);
        throw new Error(data.error?.message || 'Failed to analyze image');
      }

      const description = data.choices[0]?.message?.content || 'No description available';
      setResult(description);
      console.log('[Vision] description length:', description.length, 'preview:', description.slice(0, 80));
      // Speak the result immediately instead of showing a popup
      try {
        const tTts = Date.now();
        console.log('[TTS] start, textLen:', description.length);
        await speakText(description);
        console.log('[TTS] done in', Date.now() - tTts, 'ms');
      } catch (err) {
        console.error('[TTS] error:', err);
        Alert.alert('Audio Error', err instanceof Error ? err.message : 'Failed to play audio');
      }
    } catch (error) {
      console.error('[Vision] analyze error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to analyze image');
    }
  };

  // Web-specific: show an explicit enable-camera UI to ensure permission request happens via user gesture
  if (Platform.OS === 'web' && (!permission || permission.granted !== true)) {
    const onEnableCamera = async () => {
      try {
        // Safari requires secure context for camera
        const isSecure = typeof window !== 'undefined' && (window.isSecureContext || window.location.protocol === 'https:');
        if (!isSecure) {
          console.warn('[Permissions] Insecure context: camera requires HTTPS or localhost');
          Alert.alert(
            'Camera requires HTTPS',
            'Open this site over HTTPS (or localhost) to enable the camera.'
          );
          return;
        }
        console.log('[Permissions] Requesting camera permission (user gesture)');
        const resp: any = await requestPermission();
        console.log('[Permissions] Response:', resp);
        if (resp && typeof resp.granted === 'boolean') {
          setGranted(resp.granted);
        }
      } catch (e) {
        console.error('[Permissions] Error requesting camera permission:', e);
        Alert.alert('Permission Error', e instanceof Error ? e.message : 'Failed to request camera permission');
      }
    };

    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.permissionTitle}>Enable camera to continue</ThemedText>
        <ThemedText style={styles.permissionBody}>
          We need access to your camera to describe objects and read text. Tap the button below to allow access.
        </ThemedText>
        <TouchableOpacity
          onPress={onEnableCamera}
          accessibilityRole="button"
          style={styles.permissionButton}
        >
          <ThemedText style={styles.permissionButtonText}>Enable Camera</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.permissionHelp}>
          If you previously denied access, open your browser settings for this site and set Camera to Allow.
        </ThemedText>
      </ThemedView>
    );
  }

  if (granted === false) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Camera permission is required for object detection and transcription.</ThemedText>
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
      <TouchableOpacity 
        style={StyleSheet.absoluteFill} 
        activeOpacity={1}
        onPress={handleTap}
        disabled={isAnalyzing}
      >
        <CameraView 
          ref={cameraRef}
          style={StyleSheet.absoluteFill} 
          facing={Platform.OS === 'ios' ? 'back' : 'back'} 
        />
        <View style={[styles.borderOverlay, borderInsets]} pointerEvents="none" />
        
        {isAnalyzing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <ThemedText style={styles.loadingText}>Analyzing image...</ThemedText>
          </View>
        )}
      </TouchableOpacity>
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
    shadowColor: 'white',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: 'white',
    fontSize: 16,
  },
  permissionTitle: {
    fontSize: 20,
    marginBottom: 6,
    textAlign: 'center',
  },
  permissionBody: {
    opacity: 0.8,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#2f80ed',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionHelp: {
    marginTop: 12,
    opacity: 0.6,
    textAlign: 'center',
    paddingHorizontal: 24,
    fontSize: 12,
  },
});
