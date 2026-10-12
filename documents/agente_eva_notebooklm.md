# PLAN MAESTRO Y GUÍA DE CONTENIDOS: AGENTE EVA (LOGOPEDIA E IDIOMAS)

## 1. Arquitectura de Marca y Ecosistema
* **Silvania.ai**: Plataforma base y dominio oficial de la aplicación.
* **Terranova & Nova**: Visión del ecosistema global de Inteligencia Artificial y su agente orquestadora principal (Nova).
* **Silvania CoreAgent**: Asistente ejecutivo élite 24/7 disponible en Telegram.
* **Eva**: Aplicación y agente especializada en logopedia, rehabilitación del habla, entrenamiento de pronunciación y aprendizaje de idiomas en tiempo real vía web (Voz + Cámara).

---

## 2. Diseño de Lecciones Guiadas (20 - 25 Minutos)

Las sesiones con **Eva** están diseñadas para mantener la atención de niños y adultos de forma amena y pedagógica:

### Estructura de la Clase de 25 Minutos:
1. **Bienvenida y Calentamiento (3 min):**
   - Ejercicios de praxias bucofaciales (respiración diafragmática, vibración de labios, estiramiento de lengua).
2. **Explicación Fonética y Demostración (5 min):**
   - Eva demuestra el sonido objetivo y la colocación correcta de labios y lengua (apoyada por el análisis de cámara con MediaPipe FaceMesh).
3. **Práctica Progresiva por Nivel (12 min):**
   - Repetición de sílabas aisladas -> Palabras clave -> Frases completas -> Trabalenguas.
   - Evaluación en tiempo real de puntuación (%) y ratio de apertura bucal.
4. **Desafío Gamificado y Cierre (5 min):**
   - Reto final contra reloj, asignación de estrellas/medallas y despedida motivadora.

---

## 3. Algoritmo de Gestión de Diálogo (Salida y Retorno al Guión)

Para evitar que el agente se sienta robótico, Eva utiliza una estructura de **Retorno Inteligente al Guión**:

```
[Guión de Lección: Paso 3 - Ejercicio de la R]
         │
         ▼
User interrumpe: "¿Eva, por qué es tan difícil la letra R?"
         │
         ▼
[Modo Conversacional Libre]: 
Eva responde con empatía: "La 'R' requiere que la punta de la lengua vibre muy rápido contra el paladar. ¡Es como hacer un motorcito! A casi todos nos cuesta al principio."
         │
         ▼
[Transición de Retorno al Guión]:
Eva: "¡Pero no te preocupes! Vamos a practicarlo juntos justo donde estábamos. Repite conmigo: 'Carro'."
         │
         ▼
[Guión de Lección: Paso 3 (Reanudado)]
```

---

## 4. Banco de Ejercicios por Fonemas (Para Nutrir NotebookLM)

### A. Rotacismo (Fonemas /r/ y /rr/)
- **Nivel Inicial (Palabras suaves):** *Caramelo, Mariposa, Arena, Perro, Toro, Faro, Madera, Loro.*
- **Nivel Intermedio (Combinaciones tr, dr, pr, cr):** *Tren, Tractor, Dragón, Cocodrilo, Pradera, Primo, Cristal, Cráter.*
- **Nivel Avanzado (R doble vibrante):** *Ferrocarril, Rueda, Ratón, Carro, Arroz, Torre, Rastro, Reloj.*
- **Trabalenguas:** 
  1. *"El perro de San Roque no tiene rabo porque Ramón Ramírez se lo ha robado."*
  2. *"Erre con erre guitarra, erre con erre carril, rápido ruedan los carros, rápido el ferrocarril."*

### B. Sigmatismo (Fonemas /s/ y /z/)
- **Nivel Inicial:** *Sol, Sopa, Silla, Sombrero, Sal, Serpiente, Sucio, Selva.*
- **Nivel Avanzado (S intervocálica y trabada):** *Pastel, Escultura, Mosqueta, Esfera, Asombro.*
- **Trabalenguas:**
  1. *"Si Sansón no sana su salsa con sal, Sansón no saboreará su salsa salada."*
  2. *"Seis suecos cenan sopa de sésamo en Sevilla."*

### C. Lambdacismo y Deltacismo (Fonemas /l/, /d/, /t/)
- **Palabras clave:** *Lápiz, Lámpara, Lluvia, Dado, Dedo, Diente, Tortuga, Tambor.*
- **Trabalenguas:**
  1. *"Lado, ledo, lido, lodo, ludo, decirlo al revés lo dudo. Ludo, lodo, lido, ledo, lado, ¡qué trabajo me ha costado!"*
  2. *"Tres tristes tigres tragaban trigo en un trigal."*

### D. Vocalización y Praxias Labiales (Medición por Cámara MAR)
- **Vocal 'A':** Apertura máxima (Ratio MAR > 0.35).
- **Vocales 'O / U':** Redondeo labial proyectado hacia adelante.
- **Vocales 'E / I':** Extensión horizontal de comisuras (Sonrisa fonética).
