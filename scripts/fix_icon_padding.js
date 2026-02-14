const path = require('path');
const { Jimp } = require('jimp');

async function main() {
    const iconPath = path.resolve(__dirname, '../../toeic_practice_app/assets/icon/app_icon.png');
    console.log(`Processing: ${iconPath}`);

    try {
        console.log("Reading image...");
        const image = await Jimp.read(iconPath);

        const size = Math.max(image.bitmap.width, image.bitmap.height);
        console.log(`Size: ${size}x${size}`);

        // Clone original to use as canvas basis
        const canvas = image.clone();

        // Ensure size matches (if original wasn't square, resize canvas first - assuming square here based on mobile needs)
        // But let's assume square or resize if needed.
        canvas.resize(size, size);

        console.log("Filling canvas with white...");
        // Manual fill white
        canvas.scan(0, 0, canvas.bitmap.width, canvas.bitmap.height, function (x, y, idx) {
            this.bitmap.data[idx + 0] = 255;
            this.bitmap.data[idx + 1] = 255;
            this.bitmap.data[idx + 2] = 255;
            this.bitmap.data[idx + 3] = 255; // Alpha
        });

        // Scale original image (logo)
        const scale = 0.60;
        console.log(`Scaling logo to ${scale * 100}%...`);
        image.scale(scale);

        // Center
        const x = Math.floor((size - image.bitmap.width) / 2);
        const y = Math.floor((size - image.bitmap.height) / 2);

        console.log(`Compositing at ${x},${y}...`);
        canvas.composite(image, x, y);

        console.log("Saving...");
        await canvas.writeAsync(iconPath);
        console.log("Success! Icon updated.");

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

main();
