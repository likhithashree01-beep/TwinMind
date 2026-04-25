# TwinMind — Live Suggestions

Take-home submission: a web app that listens to live mic audio, transcribes it in 30s chunks, surfaces 3 useful suggestions every reload, and lets you tap any card for a streamed detailed answer.

The app lives in [`web/`](./web). See [`web/README.md`](./web/README.md) for setup, architecture, prompt strategy, and deploy instructions.

```bash
cd web
npm install
npm run dev
```

Then open <http://localhost:3000>, paste your Groq API key in Settings, and click the mic.
