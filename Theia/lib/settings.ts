import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppSettings = {
  apiKey: string;
  visionPrompt: string;
  stackTranscripts: boolean;
};

const STORAGE_KEY = 'theia.settings.v1';

export const DEFAULT_PROMPT = 'You are an sighted assistant for visually impaired users. The user points their camera at an object or text. Describe or transcribe the item closest to the center of the frame or ANY/ALL text in frame to the user. Be concise and clear when describing. Copy all text verbatim when transcribing. Simply provide the description or transcription without additional commentary, e.g. DO NOT SAY "the image..." or similar phrases. If a person is present, describe their actions and appearance. Your response will be converted to speech, so do not use any special characters or formatting. Do not tell the user that you are an AI model. Do not tell the user you are unable to describe people or things.';

const DEFAULTS: AppSettings = {
  apiKey: '',
  visionPrompt: DEFAULT_PROMPT,
  stackTranscripts: false,
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULTS.apiKey,
      visionPrompt: typeof parsed.visionPrompt === 'string' ? parsed.visionPrompt : DEFAULTS.visionPrompt,
      stackTranscripts: typeof parsed.stackTranscripts === 'boolean' ? parsed.stackTranscripts : DEFAULTS.stackTranscripts,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setSettings(next: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const merged: AppSettings = { ...current, ...next };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export async function getApiKey(): Promise<string> {
  const s = await getSettings();
  return s.apiKey;
}

export async function getVisionPrompt(): Promise<string> {
  const s = await getSettings();
  return s.visionPrompt || DEFAULT_PROMPT;
}

export async function getStackTranscripts(): Promise<boolean> {
  const s = await getSettings();
  return !!s.stackTranscripts;
}