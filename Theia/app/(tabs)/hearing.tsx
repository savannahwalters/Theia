import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getApiKey, getStackTranscripts } from '@/lib/settings';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TranscribeScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();

  const [stackingEnabled, setStackingEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      setStackingEnabled(await getStackTranscripts());
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      return true;
    }
    
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please enable microphone permissions to use transcription.');
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        interruptionModeIOS: 1,
      });

      console.log('[Transcribe] Starting recording...');
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      
      recordingRef.current = recording;
      setIsRecording(true);
      if (!stackingEnabled) {
        setTranscription('');
      }

      // Send audio chunks every 3 seconds for real-time transcription
      intervalRef.current = setInterval(() => {
        processRecordingChunk();
      }, 3000);

    } catch (err) {
      console.error('[Transcribe] Failed to start recording:', err);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;

      console.log('[Transcribe] Stopping recording...');
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      recordingRef.current = null;
      setIsRecording(false);

      // Process final chunk
      if (uri) {
        await transcribeAudio(uri);
      }

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

    } catch (err) {
      console.error('[Transcribe] Failed to stop recording:', err);
    }
  };

  const processRecordingChunk = async () => {
    try {
      if (!recordingRef.current) return;

      // Get current recording status
      const status = await recordingRef.current.getStatusAsync();
      if (!status.isRecording) return;

      // Stop current recording, get URI, then start a new one
      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Start new recording immediately
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      recordingRef.current = newRecording;

      // Transcribe the chunk in the background only if it contains enough audio
      if (uri) {
        // Check file size to filter out silent/empty chunks
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && fileInfo.size && fileInfo.size > 10000) {
          transcribeAudio(uri).catch(err => {
            console.error('[Transcribe] Chunk transcription error:', err);
          });
        } else {
          console.log('[Transcribe] Skipping chunk - file too small (likely silence)');
        }
      }
    } catch (err) {
      console.error('[Transcribe] Chunk processing error:', err);
    }
  };

  const transcribeAudio = async (uri: string) => {
    try {
      setIsProcessing(true);
      console.log('[Transcribe] Processing audio file:', uri);

      // Create form data with file URI
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      formData.append('response_format', 'text');
      // Suppress tokens parameter set to empty string to prevent hallucinations
      // on short clips or clips starting with silence
      formData.append('suppress_tokens', '');

      // Call OpenAI Whisper API
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key is not set. Add it in Settings.');
      }

      const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!transcribeResponse.ok) {
        const error = await transcribeResponse.text();
        console.error('[Transcribe] API error:', error);
        throw new Error(`Transcription failed: ${transcribeResponse.status}`);
      }

      const rawText = await transcribeResponse.text();
      console.log('[Transcribe] Got transcription:', rawText);

      // Normalize whitespace
      const text = rawText.replace(/\s+/g, ' ').trim();

      // Filter out common Whisper hallucinations
      const hallucinations = [
        'thank you for watching',
        'thanks for watching',
        'please subscribe',
        'like and subscribe',
        'please like',
        'thank you',
      ];

      const lowerText = text.toLowerCase();
      const isHallucination = hallucinations.some(phrase => lowerText.includes(phrase));

      if (text && !isHallucination) {
        // Avoid duplicating punctuation sequences when appending
        setTranscription(prev => {
          const cleanedPrev = prev.replace(/\s+([.!?…]+)$/g, '$1');
          if (!cleanedPrev) return text;
          // If previous ends without punctuation and new starts with punctuation, just append
          if (!/[.!?…]$/.test(cleanedPrev) && /^[.!?…]+$/.test(text)) {
            return cleanedPrev + text;
          }
          return cleanedPrev ? `${cleanedPrev} ${text}` : text;
        });
      } else if (isHallucination) {
        // Try to salvage terminal punctuation from hallucination
        const terminalPunct = text.match(/[.!?…]+$/)?.[0] ?? '';
        if (terminalPunct) {
          setTranscription(prev => {
            if (!prev) return prev;
            // Only append punctuation if prev doesn't already end with punctuation
            if (/[.!?…]$/.test(prev)) return prev;
            return prev + terminalPunct;
          });
        }
        console.log('[Transcribe] Filtered hallucination, kept punctuation if applicable:', text);
      }

    } catch (err) {
      console.error('[Transcribe] Transcription error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 20, 40) }
        ]}
      >
        <ThemedText type="title" style={styles.title}>
          Transcription
        </ThemedText>
        
        {transcription ? (
          <>
            <ThemedView style={styles.transcriptionBox}>
              <ThemedText style={styles.transcriptionText}>
                {transcription}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={async () => {
                  try {
                    await Clipboard.setStringAsync(transcription);
                    Alert.alert('Copied', 'Transcript copied to clipboard');
                  } catch (e) {
                    Alert.alert('Copy Failed', 'Unable to copy transcript');
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Copy transcript"
              >
                <IconSymbol name={'doc.on.doc'} size={20} color="#007AFF" />
                <ThemedText style={styles.actionText}>Copy</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={async () => {
                  try {
                    await Share.share({ message: transcription });
                  } catch (e) {
                    Alert.alert('Share Failed', 'Unable to share transcript');
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Share transcript"
              >
                <IconSymbol name={'square.and.arrow.up'} size={20} color="#007AFF" />
                <ThemedText style={styles.actionText}>Share</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </>
        ) : (
          <ThemedText style={styles.instructionText}>
            {isRecording 
              ? 'Listening...' 
              : 'Tap the button below to start transcribing'}
          </ThemedText>
        )}

        {isProcessing && (
          <ThemedText style={styles.processingText}>
            Processing...
          </ThemedText>
        )}
      </ScrollView>

      <ThemedView style={[styles.buttonContainer, { paddingBottom: 16 }]}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive
          ]}
          onPress={toggleRecording}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.buttonText}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // Space for sticky button
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  instructionText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
    marginTop: 40,
  },
  transcriptionBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  actionText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
  },
  processingText: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.6,
    marginTop: 16,
    fontStyle: 'italic',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  recordButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  recordButtonActive: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.41,
  },
});
