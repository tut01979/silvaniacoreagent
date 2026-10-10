import subprocess
import os

FFMPEG = r"C:\Users\eduar\AppData\Local\Programs\Python\Python313\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
INPUT_VIDEO = r"C:\Users\eduar\Videos\Grabaciones de pantalla\video_verificacion_google_1.0.mp4"
OUTPUT_VIDEO = r"C:\Users\eduar\Videos\Grabaciones de pantalla\video_verificacion_google_1.0_audio_mejorado.mp4"

# Filtro de audio para realzar la voz y ecualizar/comprimir música de fondo:
# 1. highpass=f=120: atenúa graves de fondo pesados
# 2. equalizer=f=1000:width_type=h:width=1000:g=6: ecualiza el rango vocal medio (+6dB)
# 3. equalizer=f=3000:width_type=h:width=1500:g=5: ecualiza la claridad vocal (+5dB)
# 4. compand: compresión de rango dinámico para nivelar picos y elevar la voz suave
# 5. dynaudnorm: normalizador audiológico dinámico para mantener la voz constante sin saturar
af_filter = (
    "highpass=f=120,"
    "equalizer=f=1000:width_type=h:width=1000:g=6,"
    "equalizer=f=3000:width_type=h:width=1500:g=5,"
    "compand=attacks=0.02:decays=0.2:points=-60/-60|-24/-10|0/-3:gain=4,"
    "dynaudnorm=f=150:g=15:maxgain=12"
)

cmd = [
    FFMPEG,
    "-y",
    "-i", INPUT_VIDEO,
    "-c:v", "copy",  # Copiar flujo de video sin re-codificar (ultrarrápido)
    "-af", af_filter,
    "-c:a", "aac",
    "-b:a", "192k",
    OUTPUT_VIDEO
]

print("[INFO] Procesando mejora de audio en el video de verificacion...")
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode == 0:
    print(f"[SUCCESS] Video procesado exitosamente en: {OUTPUT_VIDEO}")
else:
    print(f"[ERROR] Error procesando video: {result.stderr}")
