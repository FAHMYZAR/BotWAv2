const BaseFeature = require('../core/BaseFeature');
const KeynoteSystem = require('../utils/KeynoteSystem');

class KeynoteFeature extends BaseFeature {
    constructor() {
        super('addkeynote', 'Tambah catatan', false, 'info');
        this.useKeyPrefix = true;
    }

    getMessageText(ctx) {
        return ctx.body || ctx.text || '';
    }

    async execute(ctx, client, args) {
        try {
            if (args.length < 2) {
                await client.send(ctx.remoteJid).text('❌ Format: !addkeynote [nama] [isi]\n\n⚠️ Max 100 karakter\n📝 Nama: huruf, angka, underscore saja');
                return;
            }

            const body = this.getMessageText(ctx);
            const noteName = args[0];
            const noteContent = body.substring(
                body.indexOf(noteName) + noteName.length + 1
            ).trim();

            // Blacklist reserved keywords (Prototype Pollution Protection)
            const blacklist = [
                'proto', 'prototype', 'constructor',
                'defineGetter', 'defineSetter', 'lookupGetter', 'lookupSetter',
                'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toString',
                'valueOf', 'toLocaleString', 'freeze', 'seal', 'preventExtensions'
            ];

            const lowerName = noteName.toLowerCase();
            
            // Check blacklist
            if (blacklist.some(word => lowerName.includes(word))) {
                await client.send(ctx.remoteJid).text(`🚫 *NAMA TERLARANG!*\n\n` +
                          `⚠️ "${noteName}" mengandung reserved keyword\n` +
                          `🛡️ Proteksi: Prototype Pollution Attack\n` +
                          `❌ Gunakan nama lain!`);
                return;
            }
            
            // Block double underscore pattern (__xxx__)
            if (/^__.*__$/.test(noteName) || /^__/.test(noteName)) {
                await client.send(ctx.remoteJid).text(`🚫 *NAMA TERLARANG!*\n\n` +
                          `⚠️ Nama tidak boleh dimulai dengan "__"\n` +
                          `🛡️ Proteksi: Reserved Pattern\n` +
                          `❌ Gunakan nama lain!`);
                return;
            }

            if (!/^[a-zA-Z0-9_]+$/.test(noteName)) {
                await client.send(ctx.remoteJid).text(`❌ *Nama keynote tidak valid!*\n\n` +
                          `📝 Nama: ${noteName}\n` +
                          `⚠️ Hanya boleh: huruf (a-z, A-Z), angka (0-9), underscore (_)\n` +
                          `❌ Tidak boleh: spasi, simbol, emoji`);
                return;
            }

            if (noteName.length === 0 || noteName.length > 50) {
                await client.send(ctx.remoteJid).text(`❌ *Nama keynote tidak valid!*\n\n` +
                          `⚠️ Panjang nama: 1-50 karakter`);
                return;
            }

            // Validasi content tidak kosong
            if (noteContent.length === 0) {
                await client.send(ctx.remoteJid).text(`❌ *Content tidak boleh kosong!*`);
                return;
            }

            // Validasi panjang karakter
            if (noteContent.length > 100) {
                await client.send(ctx.remoteJid).text(`❌ *Teks terlalu panjang!*\n\n` +
                          `📊 Panjang: ${noteContent.length} karakter\n` +
                          `⚠️ Maksimal: 100 karakter\n` +
                          `❌ Kelebihan: ${noteContent.length - 100} karakter`);
                return;
            }

            // Sanitize content (escape karakter berbahaya untuk JSON)
            const sanitizedContent = noteContent
                .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
                .trim();

            const success = await KeynoteSystem.addKeynote(
                noteName,
                sanitizedContent,
                ctx.senderJid || ctx.remoteJid
            );
            
            if (!success) {
                await client.send(ctx.remoteJid).text('❌ Gagal menyimpan keynote!');
                return;
            }

            const prefix = await KeynoteSystem.getPrefix();
            await client.send(ctx.remoteJid).text(`📝 *Catatan "${noteName}" Tersimpan!*\n` +
                      `🔖 Prefix: ${prefix}\n` +
                      `📌 Contoh akses: ${prefix}${noteName}\n` +
                      `📄 Content: ${sanitizedContent}\n` +
                      `📊 Panjang: ${sanitizedContent.length}/100 karakter`);
        } catch (error) {
            await this.handleError(client, ctx, error);
        }
    }

    async handleKeynote(ctx, client) {
        try {
            const body = this.getMessageText(ctx).trim();
            const prefix = await KeynoteSystem.getPrefix();
            
            let noteName;

            if (this.useKeyPrefix) {
                if (!body.startsWith(prefix)) return false;
                noteName = body.slice(prefix.length).split(/\s+/)[0];
            } else {
                noteName = body.split(/\s+/)[0];
            }

            const note = await KeynoteSystem.getKeynote(noteName);
            if (!note || !note.content) return false;

            await client.send(ctx.remoteJid).text(`_${note.content}_`);
            return true;
        } catch (error) {
            console.error('Keynote Error:', error);
            return false;
        }
    }

    async setKeynotePrefix(ctx, client, args) {
        try {
            if (args.length < 2) {
                await client.send(ctx.remoteJid).text('❌ Format: !setkeyprefix keynote [newPrefix]');
                return;
            }

            const success = await KeynoteSystem.setPrefix(args[1]);
            if (success) {
                await client.send(ctx.remoteJid).text(`✅ Prefix keynote diubah ke: ${args[1]}`);
            } else {
                await client.send(ctx.remoteJid).text('❌ Gagal mengubah prefix!');
            }
        } catch (error) {
            await this.handleError(client, ctx, error);
        }
    }

    async setUseKeynotePrefix(ctx, client, args) {
        try {
            if (!args.length) {
                await client.send(ctx.remoteJid).text('❌ Format: !useprefixnote [1/0]\n' +
                          '1 = Gunakan prefix\n' +
                          '0 = Tanpa prefix\n' +
                          `Status: ${this.useKeyPrefix ? 'Menggunakan Prefix ✅' : 'Tanpa Prefix ❌'}`);
                return;
            }

            const value = parseInt(args[0]);
            if (value !== 0 && value !== 1) {
                await client.send(ctx.remoteJid).text('❌ Nilai tidak valid! Gunakan 1 atau 0');
                return;
            }

            this.useKeyPrefix = value === 1;
            const prefix = await KeynoteSystem.getPrefix();
            
            await client.send(ctx.remoteJid).text(`✅ *Keynote Prefix Setting Updated!*\n\n` +
                      `Mode: ${this.useKeyPrefix ? 'Menggunakan Prefix' : 'Tanpa Prefix'}\n` +
                      `Prefix: ${prefix}\n` +
                      `Contoh: ${this.useKeyPrefix ? `${prefix}note` : 'note'}`);
        } catch (error) {
            await this.handleError(client, ctx, error);
        }
    }

    async handleError(client, ctx, error) {
        console.error(`${this.name} error:`, error);
        await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan!');
    }
}

module.exports = KeynoteFeature;
