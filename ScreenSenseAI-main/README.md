# ScreenSense AI

A floating AI orb that lives on your desktop. Get live captions,
scene explanations, smart meeting notes, and AI-powered summaries
for anything on your screen — completely free.

## Download

Go to [Releases](../../releases) and download the installer for your OS:

| Platform | File |
|----------|------|
| Windows | [`ScreenSense-AI-Setup-1.0.0.exe`](dist/ScreenSense-AI-Setup-1.0.0.exe) |
| macOS | `ScreenSense-AI-x.x.x.dmg` |
| Linux | `ScreenSense-AI-x.x.x.AppImage` |

## Setup (5 minutes, completely free)

**Step 1 — Get a free Groq API key**
1. Go to https://console.groq.com
2. Sign up with Google or email (no credit card needed)
3. Click API Keys → Create API Key
4. Copy the key starting with `gsk_`

**Step 2 — Get a free Gemini API key**
1. Go to https://aistudio.google.com
2. Sign in with Google
3. Click "Get API key" → Create API key
4. Copy the key

**Step 3 — Configure the app**
1. Install and open ScreenSense AI
2. Click the floating orb → click the ⚙ Settings icon
3. Paste your Groq key in the Groq API Key field
4. Click Save Settings

That's it. No credit card. No monthly bill.

## Features

- **Live Captions** — real-time subtitles on any video, meeting, or call
- **Scene Explainer** — AI reads what's being taught, not just described
- **Transcript Notes** — full formatted notes exported as Markdown
- **Summarizer** — NotebookLM-style chapter breakdown at end of session
- **Face Analyzer** — detect expressions and emotional tone on screen
- **AI Fake Detector** — check if on-screen video looks AI-generated
- **Call Recording** — capture system audio and save as a file
- **Session Chat** — ask questions about what was just captured
- **Activity Insights** — track active apps and screen time to analyze daily productivity
- **Conversation History** — search and review all past transcripts, notes, and recordings locally
## Transcription

Live Captions can use the bundled local Whisper server or your configured Groq/OpenAI API key. Release builds include the local Whisper server, so users do not need to install Python for the default local mode. For development builds, or if the bundled server is missing, run:

```bash
pip install -r requirements-local-whisper.txt
python local_whisper_server.py
```

Or double-click `start-local-whisper.bat` on Windows.

## For developers

```bash
git clone https://github.com/chanikya07/ScreenSenseAI.git
cd ScreenSenseAI
npm install
npm start
```

To create a release with the bundled local Whisper server:

```bash
npm run build:whisper
npm run build:win
```

Build Windows, macOS, and Linux packages on their matching operating systems so each installer contains the correct local Whisper binary.

## License

MIT
