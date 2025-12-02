const BaseFeature = require('../core/BaseFeature');
const { loadKeynotes, saveKeynotes } = require('../../keynoteDB');

class KeynoteFeature extends BaseFeature {
    constructor() {
        super('addkeynote', 'Tambah catatan', false);
        this.useKeyPrefix = true;
    }

    getMessageText(m) {
        return m.message.conversation || 
               m.message.extendedTextMessage?.text || 
               m.message.imageMessage?.caption || 
               m.message.videoMessage?.caption || '';
    }

    async execute(m, sock, args) {
        try {
            if (args.length < 2) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Format: !addkeynote [nama] [isi]\n\n⚠️ Max 100 karakter\n📝 Nama: huruf, angka, underscore saja' 
                });
                return;
            }

            const body = this.getMessageText(m);
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
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `🚫 *NAMA TERLARANG!*\n\n` +
                          `⚠️ "${noteName}" mengandung reserved keyword\n` +
                          `🛡️ Proteksi: Prototype Pollution Attack\n` +
                          `❌ Gunakan nama lain!`
                });
                return;
            }
            
            // Block double underscore pattern (__xxx__)
            if (/^__.*__$/.test(noteName) || /^__/.test(noteName)) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `🚫 *NAMA TERLARANG!*\n\n` +
                          `⚠️ Nama tidak boleh dimulai dengan "__"\n` +
                          `🛡️ Proteksi: Reserved Pattern\n` +
                          `❌ Gunakan nama lain!`
                });
                return;
            }

            if (!/^[a-zA-Z0-9_]+$/.test(noteName)) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ *Nama keynote tidak valid!*\n\n` +
                          `📝 Nama: ${noteName}\n` +
                          `⚠️ Hanya boleh: huruf (a-z, A-Z), angka (0-9), underscore (_)\n` +
                          `❌ Tidak boleh: spasi, simbol, emoji`
                });
                return;
            }

            if (noteName.length === 0 || noteName.length > 50) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ *Nama keynote tidak valid!*\n\n` +
                          `⚠️ Panjang nama: 1-50 karakter`
                });
                return;
            }

            // Validasi content tidak kosong
            if (noteContent.length === 0) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ *Content tidak boleh kosong!*`
                });
                return;
            }

            // Validasi panjang karakter
            if (noteContent.length > 100) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ *Teks terlalu panjang!*\n\n` +
                          `📊 Panjang: ${noteContent.length} karakter\n` +
                          `⚠️ Maksimal: 100 karakter\n` +
                          `❌ Kelebihan: ${noteContent.length - 100} karakter`
                });
                return;
            }

            // Sanitize content (escape karakter berbahaya untuk JSON)
            const sanitizedContent = noteContent
                .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
                .trim();

            const store = loadKeynotes();
            store.notes[noteName] = {
                content: sanitizedContent,
                author: m.key.participant || m.key.remoteJid,
                created: new Date().toISOString()
            };
            saveKeynotes(store);

            await sock.sendMessage(m.key.remoteJid, { 
                text: `📝 *Catatan "${noteName}" Tersimpan!*\n` +
                      `🔖 Prefix: ${store.prefix}\n` +
                      `📌 Contoh akses: ${store.prefix}${noteName}\n` +
                      `📄 Content: ${sanitizedContent}\n` +
                      `📊 Panjang: ${sanitizedContent.length}/100 karakter`
            });
        } catch (error) {
            await this.handleError(m, sock, error);
        }
    }

    async handleKeynote(m, sock) {
        try {
            const store = loadKeynotes();
            const body = this.getMessageText(m).trim();

            let noteName;

            if (this.useKeyPrefix) {
                if (!body.startsWith(store.prefix)) return false;
                noteName = body.slice(store.prefix.length).split(/\s+/)[0];
            } else {
                noteName = body.split(/\s+/)[0];
            }

            // CRITICAL: Use hasOwnProperty to prevent prototype pollution access
            if (!Object.prototype.hasOwnProperty.call(store.notes, noteName)) {
                return false;
            }

            const note = store.notes[noteName];
            if (!note || typeof note !== 'object' || !note.content) return false;

            await sock.sendMessage(m.key.remoteJid, { 
                text: `_${note.content}_`
            });
            return true;
        } catch (error) {
            console.error('Keynote Error:', error);
            return false;
        }
    }

    async setKeynotePrefix(m, sock, args) {
        try {
            if (args.length < 2) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Format: !setkeyprefix keynote [newPrefix]' 
                });
                return;
            }

            const store = loadKeynotes();
            store.prefix = args[1];
            saveKeynotes(store);
            
            await sock.sendMessage(m.key.remoteJid, { 
                text: `✅ Prefix keynote diubah ke: ${args[1]}` 
            });
        } catch (error) {
            await this.handleError(m, sock, error);
        }
    }

    async setUseKeynotePrefix(m, sock, args) {
        try {
            if (!args.length) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Format: !useprefixnote [1/0]\n' +
                          '1 = Gunakan prefix\n' +
                          '0 = Tanpa prefix\n' +
                          `Status: ${this.useKeyPrefix ? 'Menggunakan Prefix ✅' : 'Tanpa Prefix ❌'}`
                });
                return;
            }

            const value = parseInt(args[0]);
            if (value !== 0 && value !== 1) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Nilai tidak valid! Gunakan 1 atau 0' 
                });
                return;
            }

            this.useKeyPrefix = value === 1;
            const store = loadKeynotes();
            
            await sock.sendMessage(m.key.remoteJid, { 
                text: `✅ *Keynote Prefix Setting Updated!*\n\n` +
                      `Mode: ${this.useKeyPrefix ? 'Menggunakan Prefix' : 'Tanpa Prefix'}\n` +
                      `Prefix: ${store.prefix}\n` +
                      `Contoh: ${this.useKeyPrefix ? `${store.prefix}note` : 'note'}`
            });
        } catch (error) {
            await this.handleError(m, sock, error);
        }
    }

    async handleError(m, sock, error) {
        console.error(`${this.name} error:`, error);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan!' });
    }
}

module.exports = KeynoteFeature;
