# AE Render Agent

Render agent pro automatizaci After Effects. Bezi na Windows pocitaci s nainstalovanym AE, polluje server pro joby a automaticky renderuje videa.

## Pozadavky

- **Node.js** 18+
- **Adobe After Effects 2024** (nebo novejsi)
- **FFmpeg** (pro audio mixing a TTS)
- Pristup k **S3** (nebo MinIO) bucketu
- Pristup k **API serveru** (AE Render Automat webapp)

## Instalace

```bash
cd render-agent
npm install
cp .env.example .env
# Upravte .env dle vaseho prostredi
```

## Konfigurace

1. V admin UI webove aplikace vytvorte noveho agenta (Agenti > Pridat agenta)
2. Zkopirujte vygenerovany API klic
3. Vlozte API klic do `.env` jako `AGENT_API_KEY`
4. Nastavte `API_BASE_URL` na adresu vaseho serveru
5. Nastavte `AE_PATH` na cestu k After Effects
6. Nastavte `FFMPEG_PATH` na cestu k ffmpeg
7. Nastavte S3 credentials

## Spusteni

### Development (s TypeScript)
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Jak to funguje

1. Agent polluje server kazdych 5 sekund pro nove joby
2. Kdyz dostane job:
   - Stahne AEP sablonu a assety z S3
   - Vygeneruje TTS voiceover (pokud je nastaveny)
   - Vygeneruje ExtendScript (JSX) a spusti After Effects
   - Smixuje audio (voiceover + background)
   - Nahraje vysledek zpet na S3
3. Agent posila heartbeat kazdych 30 sekund
4. Pokud agent presta odpovedat, server ho automaticky oznaci jako offline
