# Taxonomía Vectorial Visual — Ecosistema Silvania AI

Estructura oficial de atributos para catalogar activos visuales libres de derechos (sin marcas comerciales ajenas) y maximizar la coherencia narrativa en `visualAssetSelector.ts`.

---

## 1. Esquema de Atributos (`structuredAttributes`)

Cada imagen en `visualVectorIndex.json` incorpora el bloque `structuredAttributes`:

| Campo | Tipo / Valores Permitidos | Propósito en el Selector Vectorial |
| :--- | :--- | :--- |
| **`industryProfile`** | `freelance`, `comerciantes`, `autonomos`, `microempresas`, `clinicas_dentales`, `inmobiliarias`, `abogados`, `educacion_logopedia`, `general` | Emparejar la escena exactamente con el sector del guion (+3.5 puntos de afinidad). |
| **`narrativeRole`** | `hook_dolor`, `transicion`, `solucion_agente`, `resultado_exito`, `cierre_cta` | Ubicar la imagen en el momento exacto del relato (problema al inicio, agente en el medio, alivio/éxito al final). |
| **`genre`** | `corporativo_real`, `tecnologia_futurista`, `lifestyle_profesional`, `clinico_salud`, `educativo_infantil`, `redes_marketing` | Coherencia estética entre escenas consecutivas. |
| **`emotions`** | Array de emociones (ej. `estres`, `alivio`, `confianza`, `entusiasmo`, `calma`) | Sincronización emocional con la locución de Lucía/Álvaro. |
| **`situations`** | Array de situaciones concretas (ej. `visita a vivienda`, `atencion a paciente`, `reunion con cliente`) | Coincidencia situacional literal con el texto de la escena (+1.3 pts). |
| **`painPoints`** | Array de dolores específicos (ej. `sobrecarga de documentos`, `llamadas perdidas`, `agenda caotica`) | Potenciar la fuerza visual del *hook* inicial (+1.5 pts). |
| **`agentAffinity`** | Array: `coreagent`, `marketing`, `setter_ia`, `eva` | Filtrado y afinidad por producto Silvania. |
| **`setting`** | Entorno físico (ej. `clinica dental moderna`, `piso luminoso`, `despacho juridico`) | Contexto visual limpio y realista. |
| **`visualStyle`** | `fotografia_real`, `ilustracion_3d`, `holograma_futurista`, `editorial_minimalista` | Consistencia de formato. |
| **`brandSafety`** | `clean_no_trademarks` | Garantía auditada de cero logos de terceros (Apple, Dell, etc.). |

---

## 2. Arquitectura de Carpetas por Perfil Comercial (~100 imágenes / perfil)

```text
src/marketing/assets/visuals/perfiles/
├── freelance/           # Diseñadores, programadores, consultores remotos
├── comerciantes/        # Tiendas locales, retail, TPV, inventario, mostrador
├── autonomos/           # Fontaneros, electricistas, asesores, trabajo en movilidad
├── microempresas/       # Oficinas pequeñas, equipos de 2-10 personas, reuniones
├── clinicas_dentales/   # Odontólogos, recepción clínica, pacientes, agenda médica
├── inmobiliarias/       # Agentes enseñando pisos, llaves, planos, firmas
└── abogados/            # Despachos, revisión de contratos, asesoría legal
```

### Distribución Recomendada por cada Pack de 100 Imágenes
Para que un vídeo completo tenga ritmo narrativo de principio a fin:
* **25 imágenes `hook_dolor`:** Estrés, teléfono sonando sin parar, pilas de papeles, agenda desordenada, cliente esperando.
* **25 imágenes `solucion_agente`:** Profesional usando el móvil/Telegram tranquilo, pantallas limpias, organización digital, automatización.
* **25 imágenes `resultado_exito`:** Sonrisa de alivio, café tranquilo, apretón de manos, cierre de venta, paciente/cliente satisfecho.
* **15 imágenes `transicion`:** Detalles de oficina, entorno del oficio, trabajo cotidiano limpio.
* **10 imágenes `cierre_cta`:** Mirada directa a cámara con confianza, puerta abierta, futuro luminoso.

