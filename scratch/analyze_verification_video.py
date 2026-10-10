import os
import subprocess

FFMPEG = r"C:\Users\eduar\AppData\Local\Programs\Python\Python313\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
INPUT_VIDEO = r"C:\Users\eduar\Videos\Grabaciones de pantalla\video_verif_google.mp4"
SCRATCH_DIR = os.path.join(os.getcwd(), "scratch")
FRAMES_DIR = os.path.join(SCRATCH_DIR, "frames")
AUDIO_FILE = os.path.join(SCRATCH_DIR, "video_audio.mp3")

os.makedirs(FRAMES_DIR, exist_ok=True)

# 1. Extraer audio
print("🎵 Extrayendo audio...")
subprocess.run([
    FFMPEG, "-y", "-i", INPUT_VIDEO,
    "-vn", "-acodec", "libmp3lame", "-q:a", "4",
    AUDIO_FILE
], check=True, capture_output=True)
print(f"✅ Audio extraído: {os.path.getsize(AUDIO_FILE)} bytes")

# 2. Extraer fotogramas clave
timestamps = [5, 15, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]
print("📸 Extrayendo fotogramas clave...")
for ts in timestamps:
    out_frame = os.path.join(FRAMES_DIR, f"frame_{ts:03d}s.jpg")
    subprocess.run([
        FFMPEG, "-y", "-ss", str(ts), "-i", INPUT_VIDEO,
        "-vframes", "1", "-q:v", "2", out_frame
    ], check=True, capture_output=True)

print("🎉 Extracción de audio y fotogramas completada.")
