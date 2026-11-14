import sys
import asyncio
import os
import edge_tts

async def main():
    if len(sys.argv) < 4:
        print("Uso: python synthesize_voice.py <text_file_path> <output_file_path> <voice_name> [rate]", file=sys.stderr)
        sys.exit(1)
        
    text_file = sys.argv[1]
    output_file = sys.argv[2]
    voice = sys.argv[3]
    rate = sys.argv[4] if len(sys.argv) > 4 else "+0%"

    if not os.path.exists(text_file):
        print(f"Error: Archivo de texto '{text_file}' no existe.", file=sys.stderr)
        sys.exit(1)

    with open(text_file, "r", encoding="utf-8") as f:
        text = f.read().strip()

    if not text:
        print("Error: El texto proporcionado está vacío.", file=sys.stderr)
        sys.exit(1)

    out_dir = os.path.dirname(output_file)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(output_file)
    
    if os.path.exists(output_file) and os.path.getsize(output_file) > 500:
        print(f"OK: {os.path.getsize(output_file)} bytes")
        sys.exit(0)
    else:
        print("Error: El archivo generado es inválido o demasiado pequeño.", file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    asyncio.run(main())

