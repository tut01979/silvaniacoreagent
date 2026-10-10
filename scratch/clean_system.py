import os
import sys
import shutil
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def clean_directory(dir_path):
    if not os.path.exists(dir_path):
        return 0, 0
    
    deleted_files = 0
    deleted_bytes = 0
    now = time.time()
    
    for root, dirs, files in os.walk(dir_path, topdown=False):
        for f in files:
            file_path = os.path.join(root, f)
            try:
                # Omitir archivos modificados en los ultimos 15 minutos (en uso potencial)
                mtime = os.path.getmtime(file_path)
                if now - mtime < 900:
                    continue
                size = os.path.getsize(file_path)
                os.remove(file_path)
                deleted_files += 1
                deleted_bytes += size
            except Exception:
                pass
        
        for d in dirs:
            dir_to_remove = os.path.join(root, d)
            try:
                os.rmdir(dir_to_remove)
            except Exception:
                pass
                
    return deleted_files, deleted_bytes

def main():
    print("🧹 Iniciando purga de archivos temporales del sistema...")
    user_temp = os.environ.get("TEMP", "")
    local_temp = os.path.expandvars(r"%LOCALAPPDATA%\Temp")
    
    targets = list(set([p for p in [user_temp, local_temp] if p and os.path.exists(p)]))
    
    total_files = 0
    total_bytes = 0
    
    for t in targets:
        print(f"Limpiando: {t} ...")
        files, bytes_freed = clean_directory(t)
        total_files += files
        total_bytes += bytes_freed
        print(f"  -> Eliminados {files} archivos ({bytes_freed / (1024*1024):.2f} MB)")
        
    print(f"\n🎉 Limpieza completada: {total_files} archivos eliminados. Espacio liberado: {total_bytes / (1024*1024):.2f} MB")

if __name__ == "__main__":
    main()
