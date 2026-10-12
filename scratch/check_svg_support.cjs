const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');

if (!fs.existsSync('temp')) fs.mkdirSync('temp');
fs.writeFileSync('temp/test.svg', '<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1E1B4B"/><text x="100" y="100" fill="white" font-size="40">TEST</text></svg>');

try {
  execSync(`"${ffmpeg}" -y -i temp/test.svg temp/test_svg.jpg`, { stdio: 'pipe' });
  console.log('FFmpeg SVG SUCCESS, size:', fs.statSync('temp/test_svg.jpg').size);
} catch (e) {
  console.log('FFmpeg SVG FAIL:', e.stderr ? e.stderr.toString() : e.message);
}
