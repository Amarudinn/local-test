import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(publicDir, 'logo.png');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('Generating PWA icons from logo.png...\n');

  for (const size of sizes) {
    const outputPath = path.join(publicDir, `icons`, `icon-${size}x${size}.png`);
    
    await sharp(logoPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);

    console.log(`  ✓ icon-${size}x${size}.png`);
  }

  // Generate Apple touch icon (180x180)
  const appleTouchPath = path.join(publicDir, 'apple-touch-icon.png');
  await sharp(logoPath)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(appleTouchPath);
  console.log('  ✓ apple-touch-icon.png (180x180)');

  // Generate favicon (32x32)
  const faviconPath = path.join(publicDir, 'favicon-32x32.png');
  await sharp(logoPath)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(faviconPath);
  console.log('  ✓ favicon-32x32.png');

  // Generate favicon 16x16
  const favicon16Path = path.join(publicDir, 'favicon-16x16.png');
  await sharp(logoPath)
    .resize(16, 16, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(favicon16Path);
  console.log('  ✓ favicon-16x16.png');

  console.log('\n✅ All PWA icons generated successfully!');
}

generateIcons().catch(console.error);
