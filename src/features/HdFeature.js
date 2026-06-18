const BaseFeature = require('../core/BaseFeature');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class HdFeature extends BaseFeature {
    constructor() {
        super('hdsw', 'Cv document video to media player HD (Max file 250Mb)', false, 'media');
    }

    async execute(ctx, client, args) {
        try {
            const quoted = await ctx.replied().catch(() => null);
            const media = ctx.media || quoted?.media;
            const buffer = await media?.buffer();

            if (!buffer || media?.type !== 'document') {
                await ctx.reply('❌ Reply document video dengan .hdsw [caption] untuk convert ke media player HD!');
                return;
            }

            const docMsg = quoted?.message?.documentMessage || ctx.message?.documentMessage;
            const mimetype = docMsg?.mimetype || '';
            if (!mimetype.includes('video')) {
                await ctx.reply('❌ Document harus berupa video!');
                return;
            }

            const fileSize = docMsg?.fileLength || 0;
            const sizeInMB = fileSize / (1024 * 1024);

            if (sizeInMB > 250) {
                await ctx.reply(`❌ Video terlalu besar! (${sizeInMB.toFixed(2)} MB)\nMaksimal 250 MB.`);
                return;
            }

            const customCaption = args.join(' ').trim();
            const estimatedTime = Math.ceil(sizeInMB * 2.5);

            await ctx.reply(`⏳ Processing video HD...\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Estimasi: ~${estimatedTime}s\n📊 Progress: [░░░░░░░░░░] 0%`);

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const inputFile = path.join(tempDir, `hd_input_${Date.now()}.mp4`);
            const outputFile = path.join(tempDir, `hd_output_${Date.now()}.mp4`);
            fs.writeFileSync(inputFile, buffer);

            const probeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,bit_rate -of json "${inputFile}"`;
            const { stdout: probeOutput } = await execPromise(probeCmd);
            const videoInfo = JSON.parse(probeOutput);
            const stream = videoInfo.streams[0];

            const fpsRatio = stream.r_frame_rate.split('/');
            const originalFps = Math.round(parseInt(fpsRatio[0]) / parseInt(fpsRatio[1]));
            const fps = Math.min(originalFps, 60);

            const width = stream.width;
            const height = stream.height;
            const isPortrait = height > width;

            let scaleFilter;
            if (isPortrait) {
                scaleFilter = "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease";
            } else {
                scaleFilter = "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease";
            }

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

            const startTime = Date.now();
            await execPromise(ffmpegCmd);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

            const compressedBuffer = fs.readFileSync(outputFile);
            const finalSize = compressedBuffer.length / (1024 * 1024);
            const compression = ((1 - (finalSize / sizeInMB)) * 100).toFixed(1);

            // Send result then cleanup
            await client.send(ctx.roomId).video(compressedBuffer, {
                caption: `✅ Video HD selesai!\n\n📊 ${sizeInMB.toFixed(2)}MB → ${finalSize.toFixed(2)}MB (-${compression}%)\n🎬 ${fps}fps HD\n⚡ ${processingTime}s\n${customCaption ? '\n' + customCaption : ''}`
            });

            try {
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
            } catch (e) {
                console.log('Cleanup error:', e.message);
            }

        } catch (error) {
            console.error('HD error:', error);
            await ctx.reply('❌ Gagal memproses video!');
        }
    }
}

module.exports = HdFeature;
