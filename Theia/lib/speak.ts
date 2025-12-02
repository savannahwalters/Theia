import { encode as btoa } from 'base-64';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { getApiKey } from './settings';

// Converts an ArrayBuffer to a Base64 string without external heavy deps
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // process in chunks to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export type SpeakOptions = {
  voice?: 'alloy' | 'verse' | 'aria' | 'breeze' | 'luna' | string; // allow custom voices when available
  format?: 'mp3' | 'wav' | 'aac' | 'flac' | 'ogg';
};

/**
 * Fetches TTS audio from    gpt-4o-mini-tts and plays it immediately via Expo AV.
 * - Requires EXPO_PUBLIC_OPENAI_API_KEY to be set.
 */
export async function speakText(text: string, opts: SpeakOptions = {}): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key is not set. Add it in Settings.');
  }

  const voice = opts.voice ?? 'alloy';
  const format = opts.format ?? 'mp3';
  const acceptMime = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;

  // Prepare audio session to play in iOS silent mode (native only)
  if (Platform.OS !== 'web') {
    console.log('[TTS] configure audio mode (native)');
    // Lazy-load expo-av to avoid throwing at module import time when the
    // native module isn't installed/linked yet (common during fast dev).
    let Audio: any;
    try {
      // Dynamic import keeps the top-level module resolution from failing
      // when native modules are missing at startup.
      const mod = await import('expo-av');
      Audio = mod.Audio;
    } catch (err) {
      throw new Error(
        "Missing native module 'ExponentAV'. Install and rebuild the iOS app (run `npm install` then `npx pod-install` and rebuild / restart the dev client)."
      );
    }

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      interruptionModeAndroid: 1,
      interruptionModeIOS: 1,
    });
  }

  // Call OpenAI TTS endpoint
  console.log('[TTS] request -> OpenAI audio/speech', { voice, format, accept: acceptMime });
  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': acceptMime,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      format,
    }),
  });

  if (!resp.ok) {
    let message = `TTS request failed (${resp.status})`;
    try {
      const data = await resp.json();
      console.log('[TTS] error response:', data);
      message = data?.error?.message || message;
    } catch {}
    throw new Error(message);
  }

  // Read binary audio
  console.log('[TTS] response ok, reading arrayBuffer');
  const arrayBuf = await resp.arrayBuffer();

  // Web: play using a Blob + HTMLAudioElement
  if (Platform.OS === 'web') {
    console.log('[TTS] web playback via Blob/Audio');
    const blob = new Blob([arrayBuf], { type: acceptMime });
    const url = URL.createObjectURL(blob);
    const audioEl: HTMLAudioElement = new (globalThis as any).Audio();
    audioEl.src = url;
    audioEl.preload = 'auto';
    audioEl.volume = 1.0;
    audioEl.muted = false;
    audioEl.autoplay = true;
    audioEl.onended = () => {
      URL.revokeObjectURL(url);
    };
    try {
      // Ensure the element is ready
      console.log('[TTS] web audio load() then play()');
      audioEl.load();
      await audioEl.play();
    } catch (err) {
      // Fallback: Web Speech API, if autoplay is blocked
      console.log('[TTS] web autoplay blocked or error, trying speechSynthesis');
      const w = globalThis as unknown as any;
      if (w && 'speechSynthesis' in w) {
        const utter = new w.SpeechSynthesisUtterance(text);
        w.speechSynthesis.speak(utter);
      } else {
        URL.revokeObjectURL(url);
        throw err;
      }
    }
    return;
  }

  // Native: try to write to a temp file and play via Expo AV. If no writable
  // directory is available (some runtime environments), fall back to using a
  // data URI so playback can proceed without filesystem access.
  console.log('[TTS] native write temp file and play (or fall back to data URI)');
  const base64 = arrayBufferToBase64(arrayBuf);
  const fsAny = FileSystem as unknown as any;
  const cacheDir: string | undefined = fsAny?.cacheDirectory ?? fsAny?.documentDirectory;

  let fileUri: string;
  let wroteToFs = false;
  if (cacheDir) {
    fileUri = `${cacheDir}speak-${Date.now()}.${format}`;
    console.log('[TTS] writing file:', fileUri);
    await fsAny.writeAsStringAsync(fileUri, base64, { encoding: fsAny.EncodingType?.Base64 ?? 'base64' });
    wroteToFs = true;
  } else {
    // Fallback: use a data URI. Expo AV supports data URIs for audio sources,
    // which avoids needing filesystem permissions or a writable directory.
    console.warn('[TTS] No writable file system directory available — falling back to data URI playback');
    fileUri = `data:${acceptMime};base64,${base64}`;
  }

  // Lazy-load Audio here as well so the import isn't required on module load.
  let AudioMod: any;
  try {
    const mod = await import('expo-av');
    AudioMod = mod;
  } catch (err) {
    throw new Error(
      "Missing native module 'ExponentAV' required for audio playback. Install and rebuild the iOS app (run `npm install` then `npx pod-install` and rebuild / restart the dev client)."
    );
  }

  const sound = new AudioMod.Audio.Sound();
  try {
    console.log('[TTS] load and play with Expo AV');
    await sound.loadAsync({ uri: fileUri }, { shouldPlay: true });
  } finally {
    // Unload after playback ends
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (!status.isLoaded) return;
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync();
        // Best-effort cleanup of the temp file (only when we actually wrote one)
            if (wroteToFs) {
              fsAny.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
            }
      }
    });
  }
}
