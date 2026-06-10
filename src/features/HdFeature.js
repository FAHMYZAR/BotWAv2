const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class HdFeature extends BaseFeature {
    constructor() {
        super('hdsw', 'Cv document video to media player HD (Max file 250Mb)', false, 'media');
    }

    async execute(m, sock, args) {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const documentMessage = m.message.documentMessage || quoted?.documentMessage;

            if (!documentMessage) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Reply document video dengan .hdsw [caption] untuk convert ke media player HD!'
                });
                return;
            }

            // Get custom caption dari args
            const customCaption = args.join(' ').trim();

            // Cek apakah document adalah video
            const mimetype = documentMessage.mimetype || '';
            if (!mimetype.includes('video')) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Document harus berupa video!'
                });
                return;
            }

            // Cek ukuran file (max 100MB)
            const fileSize = documentMessage.fileLength || 0;
            const sizeInMB = fileSize / (1024 * 1024);

            if (sizeInMB > 250) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: `❌ Video terlalu besar! (${sizeInMB.toFixed(2)} MB)\nMaksimal 250 MB.`
                });
                return;
            }

            const estimatedTime = Math.ceil(sizeInMB * 2.5);
            const progressMsg = await sock.sendMessage(m.key.remoteJid, {
                text: `⏳ Processing video HD...\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Estimasi: ~${estimatedTime}s\n📊 Progress: [░░░░░░░░░░] 0%`
            });

            // Update progress: Downloading
            await sock.sendMessage(m.key.remoteJid, {
                text: `⏳ Downloading video...\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Estimasi: ~${estimatedTime}s\n📊 Progress: [██░░░░░░░░] 20%`,
                edit: progressMsg.key
            });

            // Download document
            const buffer = await downloadMediaMessage(
                { message: { documentMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            if (!buffer) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Gagal download video!'
                });
                return;
            }

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const inputFile = path.join(tempDir, `hd_input_${Date.now()}.mp4`);
            const outputFile = path.join(tempDir, `hd_output_${Date.now()}.mp4`);
            fs.writeFileSync(inputFile, buffer);

            // Update progress: Analyzing
            await sock.sendMessage(m.key.remoteJid, {
                text: `⏳ Analyzing video...\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Estimasi: ~${estimatedTime}s\n📊 Progress: [████░░░░░░] 40%`,
                edit: progressMsg.key
            });

            // Detect video properties untuk optimasi
            const probeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,bit_rate -of json "${inputFile}"`;
            const { stdout: probeOutput } = await execPromise(probeCmd);
            const videoInfo = JSON.parse(probeOutput);
            const stream = videoInfo.streams[0];

            // Parse FPS dan limit max 60fps (prevent upscale)
            const fpsRatio = stream.r_frame_rate.split('/');
            const originalFps = Math.round(parseInt(fpsRatio[0]) / parseInt(fpsRatio[1]));
            const fps = Math.min(originalFps, 60); // Max 60fps

            // Determine optimal resolution (maintain aspect ratio)
            const width = stream.width;
            const height = stream.height;
            const isPortrait = height > width;

            // Smart scaling - preserve HD quality
            let scaleFilter;
            if (isPortrait) {
                // Portrait: max 1080 width, auto height
                scaleFilter = "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease";
            } else {
                // Landscape: max 1920 width, auto height
                scaleFilter = "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease";
            }

            // Optimized HD compression:
            // - preset medium = balance speed & quality
            // - CRF 23 = quality bagus dengan size kecil
            // - maxrate/bufsize = control bitrate untuk kompresi maksimal
            // - fps limit max 60 (prevent upscale)
            // - FPS dipertahankan sesuai asli (max 60fps)
            const ffmpegCmd = `ffmpeg -i "${inputFile}" \
                -c:v libx264 \
                -preset medium \
                -tune film \
                -crf 23 \
                -maxrate 2M \
                -bufsize 4M \
                -r ${fps} \
                -profile:v high \
                -level:v 4.1 \
                -vf "${scaleFilter},fps=${fps},format=yuv420p" \
                -c:a aac \
                -b:a 128k \
                -ar 44100 \
                -movflags +faststart \
                -max_muxing_queue_size 9999 \
                -y "${outputFile}"`;

            // Update progress: Compressing dengan animasi
            const startTime = Date.now();

            // Progress animation during FFmpeg processing
            const progressInterval = setInterval(async () => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
                const progress = Math.min(95, 60 + Math.floor(elapsed / 2)); // 60% -> 95% gradually
                const bars = Math.floor(progress / 10);
                const progressBar = '█'.repeat(bars) + '░'.repeat(10 - bars);

                await sock.sendMessage(m.key.remoteJid, {
                    text: `⏳ Compressing to HD...\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Elapsed: ${elapsed}s\n📊 Progress: [${progressBar}] ${progress}%`,
                    edit: progressMsg.key
                }).catch(() => { });
            }, 2000); // Update every 2 seconds

            await execPromise(ffmpegCmd);
            clearInterval(progressInterval);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

            // Update progress: Finalizing
            await sock.sendMessage(m.key.remoteJid, {
                text: `⏳ Finalizing...\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Elapsed: ${processingTime}s\n📊 Progress: [██████████] 100%`,
                edit: progressMsg.key
            });

            // Kirim video hasil kompresi
            const compressedBuffer = fs.readFileSync(outputFile);
            const finalSize = compressedBuffer.length / (1024 * 1024);
            const compression = ((1 - (finalSize / sizeInMB)) * 100).toFixed(1);

            // Update progress message dengan hasil
            await sock.sendMessage(m.key.remoteJid, {
                text: `✅ Video HD selesai!\n\n📊 ${sizeInMB.toFixed(2)}MB → ${finalSize.toFixed(2)}MB (-${compression}%)\n🎬 ${fps}fps HD\n⚡ ${processingTime}s`,
                edit: progressMsg.key
            });

            await sock.sendMessage(m.key.remoteJid, {
                video: compressedBuffer,
                caption: customCaption || undefined,
                gifPlayback: false
            });

            // Cleanup
            try {
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
            } catch (e) {
                console.log('Cleanup error:', e.message);
            }

        } catch (error) {
            console.error('HD error:', error);
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Gagal memproses video!'
            });
        }
    }
}

module.exports = HdFeature;
