<!-- Project Root README for Capstone-Assistant / Theia -->

# Theia — AI Visual Assistant for Accessibility

Theia is a mobile AI assistant that helps people with visual impairments understand their surroundings by describing scenes and transcribing text from the camera in a single tap. Built with Expo + React Native and powered by OpenAI GPT‑4o Vision.

> Tap anywhere → capture an image → Theia analyzes and reads back what it sees. Text‑to‑speech is coming soon; for now results are shown in an alert.


## Table of contents

- Overview
- Features
- Tech stack
- Project structure
- Quick start
- Usage
- Configuration
- Troubleshooting
- Cost
- Roadmap
- Acknowledgements


## Overview

Theia is designed as a sighted assistant: when the user points their camera, Theia describes the object closest to the center of the frame or transcribes any visible text verbatim. The experience is optimized for low‑friction, eyes‑free use.


## Features

- Tap‑to‑capture on the full‑screen camera view
- Scene description and OCR via GPT‑4o Vision
- Clear, concise responses suitable for speech output
- Permission handling and simple error states
- Works on iOS, Android, and the web (camera features vary)


## Tech stack

- React Native + Expo (Router, Camera, Status Bar, System UI)
- TypeScript
- OpenAI GPT‑4o Vision API
- React Navigation (bottom tabs)


## Project structure

This repository contains the Expo app in the `Theia/` folder.

```
Theia/
	app/                  # Screens & routing (Expo Router)
		(tabs)/
			index.tsx         # Camera + tap‑to‑capture analysis
			transcribe.tsx    # Transcription screen (scaffold)
		_layout.tsx         # Root stack + theme
	components/           # Themed UI components
	utils/vision.ts       # GPT‑4o Vision request helper & prompts
	QUICK_REFERENCE.md    # One‑page setup & usage
	package.json          # Expo app package
```


## Quick start

All app code and commands live under `Theia/`.

1) Prerequisites

- Node.js and npm
- Xcode (for iOS), Android Studio (for Android)
- An OpenAI API key with access to GPT‑4o

2) Clone and install

```bash
cd Theia
npm install
```

3) Configure environment

Create `Theia/.env` and add your key:

```
EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-...
```

4) Run

```bash
npx expo start
```

Open on a device/simulator, or build a development client:

```bash
npx expo run:ios
npx expo run:android
```


## Usage

1) Open the app — the camera fills the screen.
2) Point at an object or text and tap anywhere to capture.
3) Theia sends the image to GPT‑4o Vision and returns a concise description or verbatim transcription. The result displays in an alert (TTS coming soon).

## Troubleshooting

| Problem | Solution |
| --- | --- |
| “Please set your OpenAI API key” | Add `EXPO_PUBLIC_OPENAI_API_KEY` to `.env` and restart the dev server |
| Camera not working | Grant camera permissions in system settings |
| API error | Verify API key validity and available credits |
| No response | Check internet connectivity |

See also `Theia/QUICK_REFERENCE.md`.


## Cost

Approx. $0.01 per image analysis with GPT‑4o (varies by image size and tokens). Monitor usage in your OpenAI dashboard.

## Acknowledgements

- Built with [Expo](https://expo.dev) and [React Native](https://reactnative.dev)
- Vision capabilities powered by [OpenAI GPT‑4o](https://platform.openai.com/docs/overview)


---

For more details, work inside the `Theia/` app directory. If you’re presenting or handing off, consider including screenshots or a short screen recording of tap‑to‑capture in action under `Theia/assets/images/` and linking them here.
