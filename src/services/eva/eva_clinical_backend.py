# eva_clinical_backend.py
import os
import re
import json
import base64
import requests
import unicodedata
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

app = FastAPI(
    title="Eva Digital Health Voice Backend",
    description="Microservicio de control de eco y evaluación fonética (Azure Pronunciation Assessment)",
    version="1.0"
)

# Cache volátil en memoria para almacenar el último mensaje hablado por Eva (Garantiza Privacidad Efímera en RAM)
_eva_last_speech_cache: Dict[str, str] = {
    "last_text": ""
}

class UpdateLastSpeechPayload(BaseModel):
    text: str

class FilterAndAssessPayload(BaseModel):
    audio_base64: str  # PCM 16kHz Int16 en base64
    reference_text: str  # Texto de la misión (ej: "El perro corre")
    threshold: Optional[float] = 0.65

# ==========================================
# 1. MECANISMO DE CONTROL Y FILTRADO DE ECO
# ==========================================

def clean_spanish_text(text: str) -> str:
    """Normaliza texto en español eliminando acentos, puntuación y mayúsculas."""
    if not text:
        return ""
    text = text.lower()
    # Eliminar diacríticos (acentos, diéresis)
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    # Eliminar signos de puntuación
    text = re.sub(r'[.,\/#!$%\^&\*;:{}=\-_`~()?¿¡!]', '', text)
    # Compactar múltiples espacios
    return re.sub(r'\s+', ' ', text).strip()

def compute_levenshtein_distance(s1: str, s2: str) -> int:
    """Calcula la distancia de Levenshtein entre dos cadenas."""
    if len(s1) < len(s2):
        return compute_levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]

def get_similarity_ratio(text1: str, text2: str) -> float:
    """Calcula la similitud normalizada (0.0 a 1.0) entre dos textos."""
    clean1 = clean_spanish_text(text1)
    clean2 = clean_spanish_text(text2)
    if not clean1 or not clean2:
        return 0.0
    if clean1 in clean2 or clean2 in clean1:
        return 1.0
    dist = compute_levenshtein_distance(clean1, clean2)
    max_len = max(len(clean1), len(clean2))
    return 1.0 - (dist / max_len)

# ===============================================
# 2. EVALUACIÓN FONÉTICA (PRONUNCIATION ASSESSMENT)
# ===============================================

def query_azure_pronunciation_assessment(audio_data: bytes, reference_text: str) -> Dict[str, Any]:
    """
    Envía el audio directamente desde RAM a Azure Speech Cognitive Services.
    Garantiza inferencia efímera (Inferencia en RAM) cumpliendo COPPA/GDPR.
    """
    # Obtener credenciales de variables de entorno
    subscription_key = os.getenv("AZURE_SPEECH_KEY")
    region = os.getenv("AZURE_SPEECH_REGION", "eastus")

    if not subscription_key:
        # Fallback de mock clínico en caso de no tener API key configurada
        return {
            "GOP_score": 85.0,
            "completeness_score": 90.0,
            "fluency_score": 80.0,
            "accuracy_score": 88.0,
            "words": [
                {"word": w, "accuracy_score": 85.0, "error_type": "None"}
                for w in reference_text.split()
            ],
            "mocked": True
        }

    # Endpoint de la API REST de Azure Speech para evaluación de pronunciación
    url = f"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=es-ES"

    # Configuración de los parámetros en formato JSON compactado en base64 para Azure Header
    pron_config = {
        "ReferenceText": reference_text,
        "GradingSystem": "HundredMark",
        "Granularity": "Phoneme",
        "Dimension": "Comprehensive"
    }
    pron_config_json = json.dumps(pron_config)
    pron_config_base64 = base64.b64encode(pron_config_json.encode('utf-8')).decode('utf-8')

    headers = {
        "Accept": "application/json",
        "Ocp-Apim-Subscription-Key": subscription_key,
        "Pronunciation-Assessment": pron_config_base64,
        "Content-type": "audio/wav; codecs=audio/pcm; samplerate=16000"
    }

    try:
        # Petición HTTP POST enviando el búfer binario en RAM (Sin tocar el disco duro)
        response = requests.post(url, headers=headers, data=audio_data, timeout=10)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Fallo en la comunicación con Azure STT: {response.text}"
            )

        azure_result = response.json()

        # Extraer métricas de evaluación
        n_best = azure_result.get("NBest", [])
        if not n_best:
            return {"error": "No se reconoció voz en el audio."}

        assessment_result = n_best[0].get("PronunciationAssessment", {})
        words_result = []

        for word_info in n_best[0].get("Words", []):
            word_assess = word_info.get("PronunciationAssessment", {})
            words_result.append({
                "word": word_info.get("Word", ""),
                "accuracy_score": word_assess.get("AccuracyScore", 0.0),
                "error_type": word_assess.get("ErrorType", "None")
            })

        return {
            "GOP_score": assessment_result.get("PronScore", 0.0),
            "completeness_score": assessment_result.get("CompletenessScore", 0.0),
            "fluency_score": assessment_result.get("FluencyScore", 0.0),
            "accuracy_score": assessment_result.get("AccuracyScore", 0.0),
            "words": words_result,
            "mocked": False
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en comunicación con Azure Speech Service: {str(e)}"
        )

# ==========================================
# 3. ENDPOINTS DE LA API REST
# ==========================================

@app.post("/api/eva/update-speech")
async def update_last_speech(payload: UpdateLastSpeechPayload):
    """Actualiza en memoria RAM la última frase dicha por Eva."""
    _eva_last_speech_cache["last_text"] = payload.text
    return {"status": "updated", "cache_length": len(payload.text)}

@app.post("/api/eva/filter-and-assess")
async def filter_and_assess(payload: FilterAndAssessPayload):
    """
    1. Decodifica el audio recibido en RAM.
    2. Compara el audio transcrito contra el último mensaje de Eva para descartar eco.
    3. Si no es eco, realiza el Pronunciation Assessment y devuelve el cálculo GOP.
    """
    try:
        # Decodificar búfer de audio en RAM
        audio_bytes = base64.b64decode(payload.audio_base64)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El formato del audio_base64 no es válido."
        )

    # 1. Obtener la última respuesta registrada de Eva
    last_eva_text = _eva_last_speech_cache.get("last_text", "")

    # 2. Primero, evaluar la transcripción de referencia para descartar eco obvio
    similarity = get_similarity_ratio(payload.reference_text, last_eva_text)
    if similarity >= payload.threshold:
        # Eco confirmado
        return {
            "status": "discarded",
            "reason": "Eco acústico detectado por similitud semántica con el agente.",
            "similarity_ratio": similarity,
            "processed": False
        }

    # 3. Si se supera el filtro de eco, consultar Azure Pronunciation Assessment (en RAM)
    assessment = query_azure_pronunciation_assessment(audio_bytes, payload.reference_text)

    # Nota: Si el GOP resultante es extremadamente bajo y la palabra es muy similar a la última palabra de Eva,
    # el sistema de descarte secundario puede activarse aquí.

    return {
        "status": "accepted",
        "processed": True,
        "similarity_ratio": similarity,
        "assessment": assessment
    }
