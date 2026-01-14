# VoiceNote → Email PWA

This repository contains a **client-side only** Progressive Web App (PWA) that records voice notes, transcribes them using OpenAI, and reformats the transcript into a professional email. All processing happens in your browser — no server required.

## Features
- Record up to 5 minutes of audio from the device microphone
- Transcribe audio using OpenAI Whisper API (your API key, stored locally)
- Reformat transcript into an email using OpenAI text models
- Tweak the generated email by recording tweak instructions
- Copy final email to clipboard
- Installable PWA with offline-capable service worker
- No backend server required — entirely client-side processing

## Quick Start (Local Development)

1. Clone and open locally
```bash
git clone https://github.com/lightbulbheaduk/voicenote_to_email_pwa.git
cd voicenote_to_email_pwa
```

2. Start a simple local server
```bash
# Using Python 3
python3 -m http.server 8000 --directory public

# Or using Node (any version)
npx http-server public
```

3. Open http://localhost:8000 in your browser

4. Enter your OpenAI API key in the Settings section and click Save
   - Your key is stored **locally in your browser** and never sent to any server
   - Generate a key at https://platform.openai.com/account/api-keys

## API Key Management

**How your API key is used:**
- Your key is stored in browser `localStorage` (survives page refreshes within the same domain)
- The key is used **only** to make direct calls from your browser to OpenAI APIs
- The key is **never** sent to any third-party server or logged anywhere
- You can clear the stored key anytime using the "Clear" button

**Security considerations:**
- Anyone with access to your device can see the key in browser storage
- Treat your API key like a password — don't share it or use it in shared browsers
- Monitor your OpenAI usage and set spending limits in your account dashboard
- For public/shared instances, use temporary keys or per-user keys

**If you lose your key:**
- Click "Clear" to delete the stored key from the browser
- Generate a new key at https://platform.openai.com/account/api-keys

## Deployment

Since this is a client-side PWA, you can host it on any static web host.

### Static Hosting Options

- **GitHub Pages:** Push to `gh-pages` branch; enable in repo settings
- **Netlify/Vercel:** Drag & drop `public/` folder or connect GitHub repo
- **CloudFlare Pages, Firebase Hosting, AWS S3 + CloudFront, etc.** — any static host works

## Tests

TODO!

## Model Configuration

Users can select different models in the Settings panel:

- **Transcription:** `whisper-1` or `gpt-4o-mini-transcribe` (OpenAI's audio transcription models)
- **Text generation:** `gpt-4o-mini` or `gpt-4o` (choose based on budget/quality)
- **Email style:** Informal, Conversational, Formal, or Call to Action

Costs:
- Whisper: ~$0.006 per minute of audio
- GPT-4o-mini-transcribe: ~$0.003/min per minute of audio
- GPT-4o-mini: cheaper text model (~$0.00015 per 1K input tokens)
- GPT-4o: more capable (~$0.005 per 1K input tokens)

## Browser Requirements

- Modern browser with support for:
  - Web Audio API (microphone recording)
  - MediaRecorder API
  - Service Workers (PWA)
  - localStorage
  - fetch / CORS (for OpenAI API calls)
- iOS Safari 14.5+ / Android Chrome / modern Firefox / modern Edge

## Future Improvements

- Add cost estimation before generating emails
- Support for multiple audio formats
- Streaming transcription for faster feedback
- Offline drafting with sync when online
- Keyboard/accessibility improvements
- Integration with email clients (mailto:, draft saving)

## License

MIT

## Support & Issues

See GitHub Issues for bug reports and feature requests.

