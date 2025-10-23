import { useEffect, useState, useRef } from 'react';
import { Platform, StyleSheet, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const prompt = 'You are an sighted assistant for visually impaired users. The user points their camera at an object or text. Describe or transcribe the item closest to the center of the frame or ANY/ALL text in frame to the user. Be concise and clear when describing. Copy all text verbatim when transcribing. Simply provide the description or transcription without additional commentary, e.g. DO NOT SAY "the image..." or similar phrases. Your response will be converted to speech, so do not use any special characters or formatting.';

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
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    setGranted(permission.granted);
  }, [permission, requestPermission]);

  const handleTap = async () => {
    if (!cameraRef.current || isAnalyzing) return;

    try {
      setIsAnalyzing(true);
      setResult('');

      // Take a picture
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (!photo || !photo.base64) {
        Alert.alert('Error', 'Failed to capture image');
        return;
      }

      // Send to GPT-4o Vision
      await analyzeImage(photo.base64);
    } catch (error) {
      console.error('Error capturing/analyzing image:', error);
      Alert.alert('Error', 'Failed to capture or analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      Alert.alert('Error', 'Please set your OpenAI API key in the .env file');
      return;
    }

    try {
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
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to analyze image');
      }

      const description = data.choices[0]?.message?.content || 'No description available';
      setResult(description);
      Alert.alert('Analysis Result', description);
    } catch (error) {
      console.error('Error analyzing image:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to analyze image');
    }
  };

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
});
