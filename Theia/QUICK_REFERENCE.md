# Quick Reference - Tap-to-Capture with GPT-4o Vision

## Setup (3 steps)
1. Get API key from https://platform.openai.com/api-keys
2. Add to `.env`: `EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-...`
3. Restart server: `npm start`

## Usage
**Tap anywhere on screen** → Image captured & analyzed → Result spoken aloud instantly (OpenAI gpt-4o-mini-tts)

## Troubleshooting
| Problem | Solution |
|---------|----------|
| "Please set your OpenAI API key" | Add key to `.env` and restart |
| Camera not working | Grant permissions in settings |
| API error | Check key validity and credits |
| No response | Check internet connection |

## Cost
~$0.01 per image analysis with GPT-4o