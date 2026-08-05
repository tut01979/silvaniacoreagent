import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const binDir = path.join(process.cwd(), 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const isWin = process.platform === 'win32';
const gogPath = path.join(binDir, isWin ? 'gog.exe' : 'gog');

if (fs.existsSync(gogPath)) {
  console.log(`✅ Gog binary already exists at ${gogPath}`);
  process.exit(0);
}

if (isWin) {
  console.log('Running on Windows. Assuming gog.exe is already present or should be copied.');
  process.exit(0);
}

console.log('Downloading gogcli for Linux...');
const version = '0.23.0';
const url = `https://github.com/openclaw/gogcli/releases/download/v${version}/gogcli_${version}_linux_amd64.tar.gz`;
const tarPath = path.join(process.cwd(), 'gogcli.tar.gz');

try {
  console.log(`Downloading from ${url}...`);
  execSync(`curl -L -o "${tarPath}" "${url}"`, { stdio: 'inherit' });
  console.log('Extracting archive...');
  execSync(`tar -xzf "${tarPath}" -C "${binDir}"`, { stdio: 'inherit' });
  
  // Clean up tar.gz
  if (fs.existsSync(tarPath)) {
    fs.unlinkSync(tarPath);
  }

  // Let's check what was extracted. If 'gogcli' was extracted, rename it to 'gog'.
  const extractedGogcli = path.join(binDir, 'gogcli');
  const targetGog = path.join(binDir, 'gog');
  if (fs.existsSync(extractedGogcli)) {
    fs.renameSync(extractedGogcli, targetGog);
  }

  if (fs.existsSync(targetGog)) {
    fs.chmodSync(targetGog, '755');
    console.log(`✅ Gog binary downloaded and configured at ${targetGog}`);
  } else {
    console.error('❌ Failed to find extracted binary');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error downloading or extracting gogcli:', error);
  process.exit(1);
}
