import os
import json

SCRATCH_DIR = os.path.join(os.getcwd(), "scratch")
INPUT_JSON = os.path.join(SCRATCH_DIR, "video_transcript.json")
OUTPUT_SRT = os.path.join(SCRATCH_DIR, "video_verif_google.srt")
TARGET_SRT = r"C:\Users\eduar\Videos\Grabaciones de pantalla\video_verif_google.srt"

with open(INPUT_JSON, "r", encoding="utf-8") as f:
    data = json.load(f)

raw_segments = data.get("segments", [])

# Reemplazos y pulido para nombres propios y términos técnicos
REPLACEMENTS = [
    ("Silvania Corallian", "Silvania CoreAgent"),
    ("Silvania Coralien", "Silvania CoreAgent"),
    ("Silvania corallian", "Silvania CoreAgent"),
    ("Sylvania", "Silvania"),
    ("client ID", "Client ID"),
    ("client id", "Client ID"),
    ("en el chip", "en Sheets"),
    ("nave de descripción", "breve descripción"),
    ("conversaci con", "conversación con"),
    ("a trav de", "a través de"),
    ("con seamos", "concedemos"),
    ("aqu ya", "aquí ya"),
    ("pantalla barra edit", "pantalla /edit"),
    ("Sylvania barra", "silvania/"),
    ("traigo a relación", "traigo a colación"),
]

def clean_text(text: str) -> str:
    res = text.strip()
    for old, new in REPLACEMENTS:
        res = res.replace(old, new)
    return res

def format_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        millis = 999
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

# Dividir subtítulos largos para que no superen 2 líneas de ~42 caracteres
def split_segment_if_long(seg):
    text = clean_text(seg["text"])
    words = text.split()
    if len(words) <= 12 and len(text) <= 70:
        return [(seg["start"], seg["end"], text)]
    
    # Dividir en 2 partes proporcionales en el tiempo
    mid = len(words) // 2
    part1_words = words[:mid]
    part2_words = words[mid:]
    part1_text = " ".join(part1_words)
    part2_text = " ".join(part2_words)
    
    duration = seg["end"] - seg["start"]
    ratio = len(part1_words) / len(words)
    mid_time = seg["start"] + (duration * ratio)
    
    res = []
    if len(part1_words) > 12 and len(part1_text) > 70:
        res.extend(split_segment_if_long({"start": seg["start"], "end": mid_time, "text": part1_text}))
    else:
        res.append((seg["start"], mid_time, part1_text))
        
    if len(part2_words) > 12 and len(part2_text) > 70:
        res.extend(split_segment_if_long({"start": mid_time, "end": seg["end"], "text": part2_text}))
    else:
        res.append((mid_time, seg["end"], part2_text))
        
    return res

all_cues = []
for seg in raw_segments:
    split_cues = split_segment_if_long(seg)
    all_cues.extend(split_cues)

srt_blocks = []
for idx, (start, end, text) in enumerate(all_cues, start=1):
    # Formatear en máximo 2 líneas si pasa de 45 caracteres
    words = text.split()
    if len(text) > 45:
        half = len(words) // 2
        formatted_text = " ".join(words[:half]) + "\n" + " ".join(words[half:])
    else:
        formatted_text = text

    start_str = format_timestamp(start)
    end_str = format_timestamp(end)
    srt_blocks.append(f"{idx}\n{start_str} --> {end_str}\n{formatted_text}\n")

srt_content = "\n".join(srt_blocks)

with open(OUTPUT_SRT, "w", encoding="utf-8") as f:
    f.write(srt_content)

with open(TARGET_SRT, "w", encoding="utf-8") as f:
    f.write(srt_content)

print(f"SRT optimizado con {len(all_cues)} subtitulos generado con exito.")
