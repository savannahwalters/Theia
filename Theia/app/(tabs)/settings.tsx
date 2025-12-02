import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppSettings, DEFAULT_PROMPT, getSettings, setSettings } from '@/lib/settings';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import appConfig from '../../app.json';

export default function SettingsScreen() {
  const [settings, setLocalSettings] = useState<AppSettings>({ apiKey: '', visionPrompt: DEFAULT_PROMPT, stackTranscripts: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setLocalSettings(s);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const merged = await setSettings(settings);
    setLocalSettings(merged);
    setSaving(false);
  };

  const pasteApiKey = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setLocalSettings(prev => ({ ...prev, apiKey: text.trim() }));
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Settings</ThemedText>

      <View style={styles.section}>
        <ThemedText style={styles.label}>OpenAI API Key</ThemedText>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={settings.apiKey}
            onChangeText={(t) => setLocalSettings(prev => ({ ...prev, apiKey: t }))}
            placeholder="sk-..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
            accessibilityLabel="OpenAI API key"
          />
          <TouchableOpacity style={styles.pasteBtn} onPress={pasteApiKey} accessibilityRole="button">
            <ThemedText style={styles.pasteText}>Paste</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Vision Prompt</ThemedText>
        <TextInput
          style={styles.textarea}
          value={settings.visionPrompt}
          onChangeText={(t) => setLocalSettings(prev => ({ ...prev, visionPrompt: t }))}
          placeholder="Describe or transcribe..."
          multiline
          accessibilityLabel="Vision prompt"
        />
      </View>

      <View style={styles.sectionRow}>
        <ThemedText style={styles.label}>Stack Transcripts</ThemedText>
        <TouchableOpacity
          style={[styles.toggle, settings.stackTranscripts && styles.toggleOn]}
          onPress={() => setLocalSettings(prev => ({ ...prev, stackTranscripts: !prev.stackTranscripts }))}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.stackTranscripts }}
        >
          <View style={[styles.knob, settings.stackTranscripts && styles.knobOn]} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={save} accessibilityRole="button" disabled={saving}>
        <ThemedText style={styles.saveText}>{saving ? 'Saving…' : 'Save Settings'}</ThemedText>
      </TouchableOpacity>

      <View style={styles.meta}>
        <ThemedText style={styles.version}>Theia version {appConfig?.expo?.version ?? 'dev'}</ThemedText>
        <ThemedText style={styles.dev}>DEVELOPMENT BUILD</ThemedText>
        <ThemedText style={styles.credits}>Savannah Walters, Desmond Jones, Jonah Layton</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionRow: {
    marginTop: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    marginBottom: 8,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pasteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  pasteText: {
    fontWeight: '600',
  },
  textarea: {
    minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: '#2f80ed',
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: '#2f80ed',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    marginTop: 24,
    alignItems: 'center',
  },
  version: {
    opacity: 0.7,
    marginBottom: 4,
  },
  dev: {
    opacity: 0.7,
    marginBottom: 4,
  },
  credits: {
    opacity: 0.6,
    fontSize: 12,
    textAlign: 'center',
  },
});
