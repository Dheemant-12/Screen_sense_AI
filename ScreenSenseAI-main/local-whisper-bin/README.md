Place bundled local Whisper server binaries here before building the Electron app.

Expected paths:

- Windows x64: `local-whisper-bin/win/local-whisper-server.exe`
- macOS x64/arm64: `local-whisper-bin/mac/local-whisper-server`
- Linux x64: `local-whisper-bin/linux/local-whisper-server`

Build them on the matching operating system with:

```bash
npm run build:whisper
```

Then build the Electron installer for that same operating system.
