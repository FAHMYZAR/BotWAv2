# TODO Audit & Rewrite Zaileys Migration BotWAv2

## STATUS: DONE ✅

## Perubahan yang dilakukan

### Phase 1: Bridge & Compatibility Layer (sekarang dihapus)
- `src/utils/JidHelper.js` — normalisasi JID pusat
- `src/core/ZaileysBridge.js` — **DELETED** setelah semua fitur migrasi
- Bridge handle: `edit: key`, `react: { text, key }`, `quoted`, `delete: key`
- Bridge wrap return jadi `{ key }` kompatibel Baileys-style

### Phase 2: Rewrite ke Native Zaileys
- **76 fitur** sudah migrate ke `execute(ctx, client, args)`
- `ctx.reply()`, `ctx.react()`, `ctx.senderId`, `ctx.roomId` — semua fitur pakai native
- `client.send(jid).text/image/video/audio/sticker/buttons` — semua fitur pakai native builder
- `client.group.metadata/addMember/removeMember/promote/demote` — fitur admin pakai native
- `client.edit(key).text()` — progress editing pakai native
- `client.delete(key)` — delete messages pakai native
- `await ctx.replied()` — quoted message lookup pakai native
- `ctx.media?.buffer()` / `quoted.media?.buffer()` — media download pakai native

### Phase 3: Cleanup
- `src/core/ZaileysBridge.js` — **DELETED**
- `src/utils/wa.js` — masih ada tapi sudah tidak di-import di fitur manapun
- `config.ownerNumberFormatted = @c.us` — tidak dipakai di flow baru
- `commandPrefix` di Client tetap ada, bisa diaktifkan kalau mau pakai `client.command()`

### Grep Results (final)
```
execute\(m, sock   → 0 matches
sock\.sendMessage  → 0 matches
m\.key             → 0 matches (di fitur)
m\.message         → 0 matches (di fitur)
downloadMediaMessage → 0 matches (di fitur)
relayMessage       → 0 matches
generateWAMessage  → 0 matches
externalAdReply    → 0 matches
ZaileysBridge      → deleted
```

### Dead code cleanup: DONE ✅
- `src/utils/wa.js` — **DELETED**
- `config.ownerNumberFormatted` — **REMOVED**

### Syntax Check
- Semua file fitur pass `node --check`
- Startup `bun run src/index.js` load features OK

## Arsitektur Baru

```
index.js → client.on('text', ctx => ...) → CommandHandler → feature.execute(ctx, client, args)
                                                        ↓
                                              feature pakai ctx.reply() / client.send()
```

- Bridge layer: **DIHAPUS**
- Event model: **Native Zaileys** (`client.on('text', 'group-join', 'group-leave', 'disconnect')`)
- Media download: **Native Zaileys** (`ctx.media?.buffer()`, `ctx.replied()?.media?.buffer()`)
- Command dispatch: **Custom** (FeatureRegistry + CommandHandler)
- Group ops: **Native Zaileys** (`client.group.*`)
