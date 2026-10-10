import os
import sys
import asyncio
import subprocess
import json
import edge_tts

# Forzar salida en UTF-8 para consola Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

FFMPEG = r"C:\Users\eduar\AppData\Local\Programs\Python\Python313\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
INPUT_VIDEO = r"C:\Users\eduar\Videos\Grabaciones de pantalla\video_verif_google.mp4"
OUTPUT_DIR = os.path.join(os.getcwd(), "public", "videos")
SCRATCH_DIR = os.path.join(os.getcwd(), "scratch")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(SCRATCH_DIR, exist_ok=True)

VOICE = "es-ES-AlvaroNeural"

PILDORAS = [
    {
        "id": 1,
        "title": "Tu Oficina Ejecutiva en Telegram",
        "description": "Qué es Silvania CoreAgent y cómo controla Google Workspace.",
        "script": (
            "Te presento Silvania CoreAgent, tu asistente ejecutivo con inteligencia artificial directamente en Telegram. "
            "Sin necesidad de instalar aplicaciones pesadas ni cambiar de ventana, CoreAgent se integra de forma nativa y segura con tu Google Workspace. "
            "Gestiona tu agenda en Calendar, redacta correos con tu confirmación, crea hojas de cálculo en Sheets y organiza tus documentos en Google Drive mediante notas de voz o texto en lenguaje natural. "
            "Tu oficina de alto rendimiento, siempre contigo."
        ),
        # Segmentos del video original (start, duration) en segundos
        # 00:00 -> 00:35 (Telegram con bot) y 01:05 -> 01:25 (web y pasos)
        "segments": [
            {"start": 0, "duration": 18},
            {"start": 67, "duration": 16}
        ]
    },
    {
        "id": 2,
        "title": "Conexión Segura en 3 Clics",
        "description": "Vinculación oficial Google OAuth 2.0 y política de permisos mínimos.",
        "script": (
            "Vincular tu cuenta con Silvania CoreAgent es inmediato y cien por cien seguro. "
            "En Telegram, solo tienes que escribir la instrucción auth. El agente te generará un enlace oficial de Google OAuth. "
            "Al abrirlo, podrás seleccionar tu cuenta y verificar que solo solicita permisos mínimos acotados, sin acceso a tus correos privados ni a tus archivos ajenos en Drive. "
            "Concedes los permisos con un solo toque y listo: tu asistente queda conectado y listo para trabajar."
        ),
        # 01:26 -> 02:15 (generación de enlace y login) y 02:30 -> 03:00 (consentimiento y confirmación)
        "segments": [
            {"start": 86, "duration": 15},
            {"start": 140, "duration": 16}
        ]
    },
    {
        "id": 3,
        "title": "Google Calendar en Lenguaje Natural",
        "description": "Crea citas, reuniones y eventos al vuelo por texto o nota de voz.",
        "script": (
            "Imagina agendar tus reuniones sin abrir la aplicación de calendario. "
            "Solo dile a CoreAgent por audio o mensaje: Crea una reunión para el próximo lunes a las once con el equipo de Google en el Palacio de Congresos de Valencia. "
            "En pocos segundos, la inteligencia artificial interpreta la fecha, la hora y el lugar, crea el evento en tu Google Calendar y te entrega el enlace directo para abrirlo y verificarlo. "
            "Productividad real en tu día a día."
        ),
        # 03:12 -> 03:46 (orden en Telegram y respuesta del bot) y 03:52 -> 04:12 (abrir evento en Google Calendar)
        "segments": [
            {"start": 192, "duration": 16},
            {"start": 232, "duration": 14}
        ]
    },
    {
        "id": 4,
        "title": "Automatización de Sheets y Drive",
        "description": "Cálculo de facturas con IVA al 21% y archivado estructurado.",
        "script": (
            "¿Necesitas una hoja de cálculo estructurada al instante? Pídeselo a Silvania. "
            "Con una orden simple como: Crea una plantilla de factura profesional con cálculo de IVA al 21 por ciento y subtotales, CoreAgent genera la hoja en Google Sheets con sus fórmulas matemáticas listas. "
            "Además, la guarda organizada en la carpeta Silvania de tu Google Drive con enlace directo. "
            "Así de fácil es automatizar tu trabajo."
        ),
        # 04:55 -> 05:35 (petición de plantilla en Telegram) y 05:38 -> 06:05 (apertura de hoja en Google Sheets)
        "segments": [
            {"start": 295, "duration": 16},
            {"start": 338, "duration": 14}
        ]
    }
]

def get_audio_duration(file_path):
    cmd = [
        FFMPEG, "-i", file_path
    ]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    for line in res.stderr.splitlines():
        if "Duration:" in line:
            parts = line.split("Duration:")[1].split(",")[0].strip().split(":")
            hours = float(parts[0])
            mins = float(parts[1])
            secs = float(parts[2])
            return hours * 3600 + mins * 60 + secs
    return 30.0

async def generate_audio_with_retry(text, voice, output_path, retries=4):
    for attempt in range(1, retries + 1):
        try:
            comm = edge_tts.Communicate(text, voice, rate="+3%")
            await comm.save(output_path)
            if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                return
        except Exception as e:
            print(f"⚠️ Reintento {attempt}/{retries} para audio ({e})...")
            await asyncio.sleep(2 * attempt)
    raise RuntimeError(f"No se pudo generar el audio tras {retries} intentos: {output_path}")

async def build_all():
    print("🚀 Iniciando generación de micro-tutoriales...")
    
    for item in PILDORAS:
        p_id = item["id"]
        final_mp4 = os.path.join(OUTPUT_DIR, f"coreagent_pildora_{p_id}.mp4")
        if os.path.exists(final_mp4) and os.path.getsize(final_mp4) > 1000000:
            print(f"⏩ Píldora {p_id} ya existe ({os.path.getsize(final_mp4) / 1024 / 1024:.2f} MB), omitiendo...")
            continue

        print(f"\n--- Procesando Píldora {p_id}: {item['title']} ---")
        
        # 1. Generar audio EdgeTTS
        audio_file = os.path.join(SCRATCH_DIR, f"audio_pildora_{p_id}.mp3")
        await generate_audio_with_retry(item["script"], VOICE, audio_file)
        target_duration = get_audio_duration(audio_file)
        print(f"🎙️ Audio generado: {target_duration:.2f} segundos")
        
        # 2. Cortar segmentos de video y concatenar
        segment_files = []
        for i, seg in enumerate(item["segments"]):
            seg_out = os.path.join(SCRATCH_DIR, f"seg_{p_id}_{i}.mp4")
            subprocess.run([
                FFMPEG, "-y",
                "-ss", str(seg["start"]),
                "-i", INPUT_VIDEO,
                "-t", str(seg["duration"]),
                "-an",
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                seg_out
            ], check=True, capture_output=True)
            segment_files.append(seg_out)
        
        # Crear lista de concatenación
        concat_txt = os.path.join(SCRATCH_DIR, f"concat_{p_id}.txt")
        with open(concat_txt, "w", encoding="utf-8") as f:
            for s in segment_files:
                f.write(f"file '{s}'\n")
                
        raw_concat = os.path.join(SCRATCH_DIR, f"raw_concat_{p_id}.mp4")
        subprocess.run([
            FFMPEG, "-y",
            "-f", "concat", "-safe", "0", "-i", concat_txt,
            "-c", "copy",
            raw_concat
        ], check=True, capture_output=True)
        
        raw_duration = get_audio_duration(raw_concat)
        print(f"🎬 Video base concatenado: {raw_duration:.2f} segundos")
        
        # 3. Ajustar velocidad del video (setpts) para que encaje exactamente con el audio
        speed_factor = raw_duration / target_duration
        final_mp4 = os.path.join(OUTPUT_DIR, f"coreagent_pildora_{p_id}.mp4")
        
        print(f"⚡ Ajustando velocidad (factor: {speed_factor:.3f}) y uniendo audio...")
        subprocess.run([
            FFMPEG, "-y",
            "-i", raw_concat,
            "-i", audio_file,
            "-filter_complex", f"[0:v]setpts={1.0/speed_factor}*PTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v]",
            "-map", "[v]",
            "-map", "1:a",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            final_mp4
        ], check=True, capture_output=True)
        
        final_size = os.path.getsize(final_mp4)
        print(f"✅ Píldora {p_id} generada con éxito en {final_mp4} ({final_size / 1024 / 1024:.2f} MB)")

    print("\n🎉 Todas las píldoras han sido procesadas con éxito!")

if __name__ == "__main__":
    asyncio.run(build_all())
