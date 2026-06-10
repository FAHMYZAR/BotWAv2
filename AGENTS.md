# EL-RUWET BotWA Developer Guide

## Core Architecture
- **Framework**: `@whiskeysockets/baileys` based WhatsApp bot
- **Structure**: OOP modular design (`src/core/BaseFeature.js`)
- **State**: Mix of in-memory store (`baileys_store.json`), SQLite via Bun (`data/botwa.db` for tracking/history)
- **Entry point**: `src/index.js`
- **Prefixes**: `/` for owner, `.` for user (defined in `src/config/config.js`)

## Creating New Features
- Use `FEATURE_TEMPLATE.js` as reference.
- Create feature class extending `BaseFeature` in `src/features/`.
- Features auto-register on bot start via `FeatureRegistry.js`.
- Use `src/utils/MessageHelper.js` for common operations (download media, get quoted msg).

## Commands
- **Dev mode (auto-reload)**: `npm run dev` (starts nodemon)
- **Production mode**: `npm start`
- **Docker build**: `docker build -t fahmyzzx/botwav2:latest .` (see `build-push.sh` for full flow)

## Verification Flow
- **Syntax Check**: No lint/typecheck configured. Run `bun run src/index.js` or `bun --watch src/index.js` to verify startup.
- **Database**: Uses `bun:sqlite` automatically writing to `data/botwa.db`. Make sure `bun` runtime is available.
