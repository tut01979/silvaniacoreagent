const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');

if (!fs.existsSync('temp')) fs.mkdirSync('temp');

try {
  execSync(`"${ffmpeg}" -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -af "atempo=1.06" -y temp/test_atempo.mp3`, { stdio: 'pipe' });
  console.log('atempo filter SUCCESS, size:', fs.statSync('temp/test_atempo.mp3').size);
} catch (e) {
  console.error('atempo FAIL:', e.stderr ? e.stderr.toString() : e.message);
}
