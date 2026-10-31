# ScreenSense AI — Setup Guide (Windows)

## What You're Installing

A floating AI orb that lives on your Windows desktop. Click it to get:
- **Live Captions** — real-time subtitles on any video or Google Meet
- **Scene Explainer** — AI reads what's being *taught* on screen (not just described)
- **Transcript Notes** — full session notes exported as Markdown/PDF
- **Video Summarizer** — NotebookLM-style summary with chapters
- **AI Fake Detector** — checks if the on-screen video looks AI-generated or deepfake

---

## Prerequisites

### 1. Node.js (v18 or higher)
Download from https://nodejs.org and install.
Verify: open Command Prompt and run `node --version`

### 2. VB-Cable (FREE — for system audio capture)
This lets ScreenSense hear what's playing through your speakers.

1. Download from: https://vb-audio.com/Cable/
2. Run `VBCABLE_Setup_x64.exe` as Administrator
3. After install, go to **Control Panel → Sound → Recording**
4. You'll see "CABLE Output" — right-click → Set as Default Device
5. Go to **Playback** → right-click "CABLE Input" → Properties → Listen tab → check "Listen to this device" → select your speakers

> **Note for Google Meet specifically:** Chrome will pick up your microphone directly via the browser. VB-Cable is for capturing video audio (YouTube, VLC, etc.)

### 3. Live Caption Transcription

Live captions can run through the local faster-whisper server or through your configured Groq/OpenAI API key. Choose the source when you start Live Captions. Local Whisper is still the recommended default, and ScreenSense can fall back to API transcription if local Whisper is unavailable.

Release builds start the bundled local Whisper server automatically in the background. End users should not need to install Python or run `start-local-whisper.bat`.

Developers can still run it manually:

```bash
py -3.13 -m pip install -r requirements-local-whisper.txt
py -3.13 local_whisper_server.py
```

Keep this terminal open while using Live Captions or Transcript Notes. The default model is `tiny` for faster local captions. To use a more accurate Whisper size, set `WHISPER_MODEL` before launching, for example `WHISPER_MODEL=base` or `WHISPER_MODEL=small`. You can also tune `WHISPER_DEVICE` and `WHISPER_COMPUTE_TYPE` for your hardware.

Local Whisper also needs `ffmpeg` on PATH so it can read browser audio chunks.

On Windows development builds, you can also double-click `start-local-whisper.bat`. If `python --version` opens Microsoft Store, install Python from python.org and tick "Add python.exe to PATH", or disable the Python app execution aliases in Windows Settings.

### 4. API Keys

**Bring Your Own Key (BYOK)** — use your own free provider keys for scene analysis and summaries.
- Sign up for Groq, Google AI Studio, Mistral, and Together AI. Each provider offers a free tier with daily limits.
- Store your keys in `.env.local` in the project root using names like `GROQ_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_STUDIO_API_KEY`, `MISTRAL_API_KEY`, and `TOGETHER_AI_KEY`.
- Example `.env.local`:

```env
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk_...
GOOGLE_AI_STUDIO_API_KEY=...
MISTRAL_API_KEY=...
TOGETHER_AI_KEY=...
```
- Live transcription only needs this when you choose API transcription or want API fallback for local Whisper.
- Scene Explainer, chat, summaries, and translated/cleaned captions can use your configured BYOK provider.

**Anthropic API Key** (optional — for superior summaries)
- Sign up at https://console.anthropic.com
- Go to API Keys → Create key
- Used only for the Summarizer mode

---

## Installation

```bash
# 1. Clone or download this folder to your desktop

# 2. Open Command Prompt in the screensense-ai folder:
cd path\to\screensense-ai

# 3. Install dependencies
npm install

# 4. In a separate terminal, start local Whisper for development
py -3.13 -m pip install -r requirements-local-whisper.txt
py -3.13 local_whisper_server.py

# 5. Launch the app
npm start
```

The orb will appear in the bottom-right of your screen.

---

## First-Time Setup

1. Click the orb → click ⚙ (Settings)
2. Paste your own Groq or OpenAI API key for scene/chat/summary features, or create a `.env.local` file with your BYOK provider keys.
3. Optionally paste your Anthropic key
4. Set your preferred output language
5. Click Save Settings

---

## How Each Mode Works

### Live Captions
- Click orb → Select source → Live Captions
- Choose **Local Whisper** or **API transcription**
- Local Whisper captures audio in chunks and sends it to `http://127.0.0.1:5001/transcribe`
- API transcription sends audio chunks to your configured Groq/OpenAI transcription endpoint.
- A bundled local Whisper server runs faster-whisper locally with zero API cost in release builds.
- If the app keeps waiting for local Whisper on `127.0.0.1:5001`, the build may be missing the bundled server, antivirus may have blocked it, or the first model download may still be running.
- Captions appear in the overlay at the bottom of your screen
- Works on YouTube, VLC, Google Meet, Zoom, Teams

### Scene Explainer
- Same as above but also captures a screenshot every 4 seconds
- Screenshot + recent audio → GPT-4o Vision → intelligent scene description
- Output: "Teacher is explaining quadratic equations by writing ax²+bx+c=0 on the board"
- NOT: "A man is standing in front of a whiteboard"

### Transcript Notes
- Records everything said during the session
- At end: click Export → full notes file saved to Downloads
- LLM formats it with headings, bullets, and timestamps

### Video Summarizer
- Records captions + scene descriptions throughout
- At end: generates chapter breakdown, key points, and action items
- Exports as Markdown (open in Obsidian, Notion, etc.)

## Google Meet Specific Setup

For Meet, you don't need VB-Cable. The browser captures mic audio directly.

1. Open Google Meet in Chrome
2. Launch ScreenSense → Click orb → Live Captions
3. Select the Chrome window from the source dropdown
4. ScreenSense will transcribe all spoken audio in the meeting

For **capturing other participants' audio** in Meet:
- Go to Meet Settings → Audio → check your microphone is set
- In Windows Sound settings → Recording → enable "Stereo Mix" if available
- Or use VB-Cable with loopback enabled (see VB-Cable step 3 above)

---

## Language Support

ScreenSense uses local faster-whisper, based on Whisper models with broad multilingual support.

In Settings → Output Language, choose your preferred language.
All transcripts, captions, and scene explanations will be delivered in that language
regardless of what language the video is in.

Supported (among others): English, Hindi, Telugu, Tamil, French, German, Spanish,
Chinese, Japanese, Korean, Arabic, Portuguese, Russian, Italian, Dutch, Polish,
Turkish, Vietnamese, Thai, Indonesian, and 79 more.

---

## Building for Distribution (optional)

```bash
npm run build
```

This creates an `.exe` installer in the `dist/` folder.

---

## Troubleshooting

**Orb doesn't appear:** Check Task Manager for `Electron` process. Try `npm start` again.

**No audio captured:** Make sure VB-Cable is set as default recording device. Check Windows Sound settings.

**"API key invalid":** Double-check your key in Settings. Make sure you have credits on your OpenAI account.

**Scene explainer is slow:** Increase the interval in Settings (every 6 or 10 seconds) to reduce API calls.

**Captions in wrong language:** Go to Settings → Output Language and set your preferred language.

---

## File Structure

```
screensense-ai/
├── package.json
├── src/
│   ├── main/
│   │   ├── main.js          ← Electron main process (windows, IPC, tray)
│   │   └── preload.js       ← Secure IPC bridge
│   └── renderer/
│       ├── orb/             ← The floating orb UI
│       ├── panel/           ← Mode selector panel
│       ├── overlay/         ← Caption/scene overlay
│       ├── settings/        ← Settings window
│       └── selector/        ← Region picker
└── areaselector/
    └── code.py              ← Standalone Python prototype
```
