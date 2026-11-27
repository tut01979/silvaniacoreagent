import type { ProductBrand, VisualStructuredAttributes, VisualVectorChunk } from "./visualAssetSelector.js";
import { computeSemanticVector } from "./semanticVectorEngine.js";

interface CuratedAssetMeta {
  title: string;
  description: string;
  objective: string;
  emotions: string[];
  keywords: string[];
  situations: string[];
  painPoints?: string[];
  subjects: string[];
  actions: string[];
  objects: string[];
  useCases: string[];
  scriptThemes: string[];
  narrativeRole?: VisualStructuredAttributes["narrativeRole"];
  genre?: VisualStructuredAttributes["genre"];
  setting?: string;
}

interface CategoryEnrichmentProfile {
  emotions?: string[];
  keywords: string[];
  situations: string[];
  painPoints?: string[];
  subjects: string[];
  actions: string[];
  objects: string[];
  useCases: string[];
  scriptThemes: string[];
  audience: string;
  excludedProducts?: ProductBrand[];
}

const SPECIFIC_ASSET_OVERRIDES: Record<string, CuratedAssetMeta> = {
  vis_person_calendar_meeting_02: {
    title: "Ejecutivo Planificando Reuniones en Google Calendar #02",
    description: "Profesional coordinando citas, bloques horarios y reuniones de negocio desde una agenda digital sincronizada.",
    objective: "Mostrar coordinación ágil de citas y agenda sin conflictos horarios con CoreAgent.",
    emotions: ["control", "claridad", "productividad", "confianza"],
    keywords: ["calendar", "agenda", "reunion", "citas", "horario", "planificacion", "ejecutivo", "workspace", "coreagent", "meeting", "schedule"],
    situations: ["planificacion de reuniones comerciales", "gestion de agenda ejecutiva"],
    subjects: ["ejecutivo", "equipo de trabajo", "profesional b2b"],
    actions: ["agendando reuniones", "coordinando horarios", "confirmando citas"],
    objects: ["google calendar", "portatil", "agenda digital", "sala de reuniones"],
    useCases: ["agendar citas por voz desde telegram", "gestion automatica de google calendar", "ahorro de tiempo diario"],
    scriptThemes: ["agenda organizada con ia", "cero olvidos de citas", "productividad ejecutiva en telegram"],
    narrativeRole: "solucion_agente",
    genre: "corporativo_real",
    setting: "oficina ejecutiva luminosa",
  },
  vis_person_calendar_mobile_03: {
    title: "Confirmación de Citas Móvil en Camino #03",
    description: "Profesional revisando su agenda y recordatorios de reuniones en smartphone mientras se desplaza.",
    objective: "Demostrar gestión instantánea del calendario en movilidad por Telegram y voz.",
    emotions: ["agilidad", "libertad", "control", "eficiencia"],
    keywords: ["movil", "smartphone", "calendar", "citas", "movilidad", "telegram", "agenda", "coreagent", "recordatorios", "mobile", "schedule"],
    situations: ["gestion de citas en movilidad", "confirmacion rapida desde el movil"],
    subjects: ["directivo en movimiento", "emprendedor", "profesional remoto"],
    actions: ["consultando agenda en el movil", "confirmando reunion", "gestionando tiempo libre"],
    objects: ["smartphone", "google calendar", "notificaciones", "cafe"],
    useCases: ["control de agenda por voz", "asistente movil en telegram", "ahorro de horas en movilidad"],
    scriptThemes: ["oficina en tu bolsillo", "productividad en cualquier lugar"],
    narrativeRole: "solucion_agente",
    genre: "lifestyle_profesional",
    setting: "entorno urbano o desplazamiento profesional",
  },
  vis_person_calendar_office_01: {
    title: "Organización Matinal de Agenda en Despacho #01",
    description: "Directivo organizando prioridades semanales en Google Calendar sobre escritorio minimalista.",
    objective: "Reflejar serenidad operativa y claridad al iniciar la jornada con CoreAgent.",
    emotions: ["calma", "enfoque", "organizacion", "confianza"],
    keywords: ["oficina", "despacho", "calendar", "agenda", "prioridades", "mañana", "productividad", "coreagent", "office", "planning"],
    situations: ["inicio de jornada ordenada", "planificacion semanal ejecutiva"],
    subjects: ["directivo", "consultor", "autonomo"],
    actions: ["organizando agenda diaria", "revisando tareas pendientes", "planificando semana"],
    objects: ["ordenador", "google calendar", "escritorio limpio", "taza de cafe"],
    useCases: ["planificacion diaria automatica", "organizacion google workspace"],
    scriptThemes: ["calma operativa vs caos diario", "planificacion inteligente"],
    narrativeRole: "resultado_exito",
    genre: "corporativo_real",
    setting: "despacho ejecutivo moderno",
  },
  vis_person_executive_skyline_01: {
    title: "Directivo Observando Horizonte Urbano Desde Oficina #01",
    description: "Ejecutivo con visión estratégica contemplando el skyline de la ciudad mientras la IA automatiza su operativa.",
    objective: "Transmitir liderazgo, escalabilidad y libertad temporal gracias a la automatización.",
    emotions: ["vision", "exito", "libertad", "orgullo", "calma"],
    keywords: ["ejecutivo", "skyline", "rascacielos", "liderazgo", "vision", "exito", "b2b", "coreagent", "executive", "leadership"],
    situations: ["cierre estrategico con vision empresarial", "tiempo recuperado tras automatizar"],
    subjects: ["ceo", "fundador", "director de empresa"],
    actions: ["contemplando crecimiento", "tomando decisiones estrategicas", "liderando negocio"],
    objects: ["ventanal panoramico", "traje ejecutivo", "ciudad financiera"],
    useCases: ["resultado final de ahorro de tiempo", "cierre inspirador coreagent", "escala empresarial"],
    scriptThemes: ["de saturado a estratega", "ahorrar 2 horas al dia con ia"],
    narrativeRole: "cierre_cta",
    genre: "corporativo_real",
    setting: "oficina panoramica en rascacielos",
  },
  vis_person_executive_workstation_02: {
    title: "Estación de Trabajo Ejecutiva de Alto Rendimiento #02",
    description: "Profesional concentrado trabajando en estación moderna multipantalla con flujos digitales ordenados.",
    objective: "Representar flujo de trabajo profundo y ejecución multiproyecto sin fricción.",
    emotions: ["enfoque", "eficiencia", "control", "precision"],
    keywords: ["workstation", "escritorio", "pantallas", "productividad", "trabajo", "flujo", "coreagent", "workspace", "focus"],
    situations: ["jornada ejecutiva de alta productividad", "ejecucion automatizada multiplataforma"],
    subjects: ["analista", "consultor", "directivo tecnologico"],
    actions: ["trabajando con datos", "supervisando automatizaciones", "ejecutando flujos"],
    objects: ["monitores", "teclado", "portatil", "interfaz limpia"],
    useCases: ["flujo de trabajo profesional", "gestion centralizada workspace"],
    scriptThemes: ["flujo de trabajo profundo", "productividad sin fricciones"],
    narrativeRole: "solucion_agente",
    genre: "corporativo_real",
    setting: "estacion de trabajo moderna",
  },
  vis_person_gmail_drafting_02: {
    title: "Redacción Asistida de Correos Comerciales en Gmail #02",
    description: "Profesional revisando un borrador de correo comercial estructurado y claro antes de enviarlo con confirmación humana.",
    objective: "Mostrar cómo CoreAgent redacta emails persuasivos en Gmail bajo aprobación del usuario.",
    emotions: ["confianza", "seguridad", "claridad", "profesionalismo"],
    keywords: ["gmail", "correo", "email", "borrador", "redaccion", "prospeccion", "cliente", "coreagent", "outreach", "drafting"],
    situations: ["redaccion de correos a clientes", "seguimiento comercial asistido por ia"],
    subjects: ["ejecutivo de cuentas", "comercial", "emprendedor"],
    actions: ["redactando correo profesional", "aprobando envio asistido", "contactando clientes"],
    objects: ["gmail", "portatil", "bandeja de correo", "mensaje comercial"],
    useCases: ["redaccion de emails por voz", "contacto a prospectos verificados", "gmail asistido hitl"],
    scriptThemes: ["comunicacion comercial agilidad", "control humano en cada envio"],
    narrativeRole: "solucion_agente",
    genre: "lifestyle_profesional",
    setting: "oficina luminosa con ordenador",
  },
  vis_person_gmail_inboxzero_01: {
    title: "Bandeja de Entrada Cero y Control de Gmail #01",
    description: "Profesional satisfecho frente a una bandeja de correo completamente limpia y ordenada tras procesar mensajes.",
    objective: "Representar el alivio de tener la bandeja de entrada bajo control con CoreAgent.",
    emotions: ["alivio", "calma", "orden", "satisfaccion", "victoria"],
    keywords: ["gmail", "inbox", "bandeja", "correo", "orden", "alivio", "workspace", "coreagent", "inbox zero", "clean"],
    situations: ["bandeja de correo ordenada", "fin del caos de emails"],
    subjects: ["profesional satisfecho", "directivo", "freelance"],
    actions: ["revisando correo limpio", "archivando mensajes", "disfrutando orden digital"],
    objects: ["portatil", "gmail limpio", "cafe", "escritorio minimalista"],
    useCases: ["triaje de correos", "ahorro de tiempo en bandeja de entrada"],
    scriptThemes: ["antes bandeja saturada vs ahora orden total"],
    narrativeRole: "resultado_exito",
    genre: "lifestyle_profesional",
    setting: "escritorio minimalista ordenado",
  },
  vis_person_sheets_balance_03: {
    title: "Análisis de Tablas y Balances en Google Sheets #03",
    description: "Profesional analizando filas, columnas, fórmulas y balances financieros organizados automáticamente en Google Sheets.",
    objective: "Demostrar la creación instantánea de tablas funcionales, prospección y balances con fórmulas vivas en Sheets.",
    emotions: ["claridad", "precision", "confianza", "control", "eficiencia"],
    keywords: ["sheets", "tablas", "balance", "hojas de calculo", "filas", "columnas", "formulas", "datos", "crm", "prospeccion", "coreagent", "spreadsheet"],
    situations: ["creacion de tablas en google sheets", "revision de datos estructurados y formulas"],
    subjects: ["analista", "empresario", "autonomo", "gestor"],
    actions: ["analizando tablas de datos", "verificando formulas vivas", "estructurando leads y balances"],
    objects: ["google sheets", "hoja de calculo", "tablas estructuradas", "ordenador", "filas y columnas"],
    useCases: ["prospeccion web volcada a sheets", "tablas crm en lote batch", "facturas y presupuestos con formulas"],
    scriptThemes: ["de datos dispersos a tabla estructurada en segundos", "google sheets funcional y automatico"],
    narrativeRole: "solucion_agente",
    genre: "corporativo_real",
    setting: "oficina con pantalla mostrando hojas de calculo",
  },
  vis_person_sheets_finance_01: {
    title: "Gestión Financiera, Presupuestos y Facturas en Sheets #01",
    description: "Responsable financiero revisando presupuestos, facturas y métricas automáticas en Google Sheets corporativo.",
    objective: "Visualizar el cálculo automático de IVA, subtotales y leads reales sin entrada manual tediosa.",
    emotions: ["seguridad", "control", "precision", "exito"],
    keywords: ["sheets", "finanzas", "factura", "presupuesto", "iva", "totales", "tablas", "calculo", "prospeccion", "datos", "coreagent", "finance"],
    situations: ["control de presupuestos y facturas", "tablas estructuradas de negocio"],
    subjects: ["director financiero", "pyme", "autonomo", "taller"],
    actions: ["revisando totales automaticos", "validando presupuestos", "ordenando datos de clientes"],
    objects: ["google sheets", "facturas", "presupuestos", "hojas de calculo", "pantalla portatil"],
    useCases: ["creacion automatica de facturas y presupuestos", "tablas crm estructuradas en batch", "prospeccion web a google sheets"],
    scriptThemes: ["tablas funcionales con formulas reales", "ahorro operativo en administracion"],
    narrativeRole: "resultado_exito",
    genre: "corporativo_real",
    setting: "despacho financiero moderno",
  },
  vis_person_sheets_typing_02: {
    title: "Estructuración de Datos y Tablas en Hojas de Cálculo #02",
    description: "Especialista trabajando con hojas de cálculo limpias, registros estructurados y validación de contactos en pantalla.",
    objective: "Ilustrar la captura organizada de prospectos web y registros reales dentro de Google Sheets.",
    emotions: ["enfoque", "productividad", "orden", "eficiencia"],
    keywords: ["sheets", "tablas", "datos", "registros", "prospeccion", "leads", "contactos", "columnas", "workspace", "coreagent", "spreadsheet", "data"],
    situations: ["organizacion de contactos y leads en sheets", "edicion estructurada de tablas"],
    subjects: ["especialista en operaciones", "prospector b2b", "equipo comercial"],
    actions: ["organizando fichas en tabla", "validando emails y telefonos", "actualizando hoja de calculo"],
    objects: ["google sheets", "portatil", "teclado", "tablas de leads", "workspace"],
    useCases: ["guardar prospeccion web en google sheets", "tablas estructuradas sin errores", "modificar plantillas in-place"],
    scriptThemes: ["prospeccion web y sheets estructurados", "datos reales listos para vender"],
    narrativeRole: "solucion_agente",
    genre: "lifestyle_profesional",
    setting: "mesa de trabajo moderna con ordenador",
  },
  vis_person_telegram_chat_02: {
    title: "Órdenes Directas por Chat a CoreAgent en Telegram #02",
    description: "Profesional enviando instrucciones concretas en Telegram para lanzar búsquedas web y guardar tablas en Google Sheets.",
    objective: "Mostrar lo natural que resulta operar todo Google Workspace y prospección desde un chat de Telegram.",
    emotions: ["agilidad", "cercania", "rapidez", "control"],
    keywords: ["telegram", "chat", "mensaje", "bot", "comando", "movil", "coreagent", "prospeccion", "sheets", "workspace"],
    situations: ["dando ordenes por telegram al asistente", "automatizacion instantanea desde chat"],
    subjects: ["usuario de telegram", "emprendedor", "directivo"],
    actions: ["escribiendo peticion en telegram", "recibiendo tabla lista", "lanzando prospeccion web"],
    objects: ["smartphone", "telegram bot", "interfaz de chat", "enlaces clicables"],
    useCases: ["pedir prospeccion web desde telegram", "crear y modificar sheets por chat", "flujo ejecutivo instantaneo"],
    scriptThemes: ["una frase en telegram hace todo el trabajo", "simplicidad de uso"],
    narrativeRole: "solucion_agente",
    genre: "lifestyle_profesional",
    setting: "oficina moderna o cafeteria profesional",
  },
  vis_person_telegram_voicememo_01: {
    title: "Notas de Voz en Telegram Ejecutando Tareas Reales #01",
    description: "Profesional enviando un audio de voz rápido en Telegram para que CoreAgent investigue webs y arme una hoja de cálculo.",
    objective: "Destacar el control 100% por voz desde Telegram para ahorrar más de 2 horas al día.",
    emotions: ["libertad", "velocidad", "innovacion", "eficiencia"],
    keywords: ["voz", "audio", "telegram", "microfono", "nota de voz", "manos libres", "movil", "coreagent", "voice", "automatizacion"],
    situations: ["enviando orden por voz en telegram", "operando google workspace sin abrir apps"],
    subjects: ["directivo hablando por voz", "autonomo", "empresario"],
    actions: ["grabando nota de voz", "delegando tarea por audio", "ahorrando horas de teclado"],
    objects: ["smartphone", "ondas de voz", "telegram", "auriculares"],
    useCases: ["ordenes por voz en telegram", "ahorrar 2 horas al dia en tareas repetitivas", "delegacion inmediata"],
    scriptThemes: ["habla natural y la ia ejecuta", "manos libres y productividad"],
    narrativeRole: "solucion_agente",
    genre: "lifestyle_profesional",
    setting: "entorno moderno y luminoso",
  },
  pub_hub_ecosystem: {
    title: "Arquitectura Ecosistema Conectado Silvania Hub",
    description: "Diagrama visual central conectando CoreAgent, investigación web y herramientas de Google Workspace.",
    objective: "Explicar cómo Silvania coordina múltiples herramientas y flujos desde un único núcleo inteligente.",
    emotions: ["integracion", "poder", "vision", "orden", "confianza"],
    keywords: ["ecosistema", "hub", "silvania", "coreagent", "agentes", "workspace", "sheets", "gmail", "calendar", "prospeccion", "integracion"],
    situations: ["explicacion de arquitectura silvania", "conexion integral de herramientas"],
    subjects: ["nucleo de agentes ia", "arquitectura digital"],
    actions: ["conectando herramientas", "orquestando tareas", "sincronizando workspace"],
    objects: ["nodos conectados", "diagrama tecnologico", "hub central"],
    useCases: ["vision global de coreagent", "integracion web + sheets + gmail + calendar"],
    scriptThemes: ["todo conectado en un solo lugar", "ecosistema inteligente silvania"],
    narrativeRole: "solucion_agente",
    genre: "tecnologia_futurista",
    setting: "entorno tecnologico corporativo",
  },
  pub_coreagent_mockup: {
    title: "Mockup Oficial de Silvania CoreAgent en Acción",
    description: "Presentación comercial de Silvania CoreAgent integrando Telegram, investigación web real y Google Sheets estructurado.",
    objective: "Presentar el producto real Silvania CoreAgent en llamadas a la acción y demos comerciales.",
    emotions: ["profesionalismo", "control", "modernidad", "confianza", "exito"],
    keywords: ["mockup", "coreagent", "silvania", "interfaz", "producto", "telegram", "sheets", "prospeccion", "cta"],
    situations: ["presentacion oficial del producto", "llamada a la accion final silvania.ai"],
    subjects: ["interfaz coreagent", "producto digital"],
    actions: ["mostrando resultados estructurados", "presentando solucion final"],
    objects: ["mockup pantalla", "interfaz telegram y workspace", "tablas"],
    useCases: ["cierre cta prueba coreagent", "demo visual del producto"],
    scriptThemes: ["prueba coreagent hoy en silvania.ai", "deja que la ia trabaje por ti"],
    narrativeRole: "cierre_cta",
    genre: "corporativo_real",
    setting: "estudio de producto corporativo",
  },
  pub_silvania_robot: {
    title: "Agente Robótico Autónomo Silvania AI",
    description: "Representación tecnológica del asistente autónomo Silvania ejecutando investigación web y estructuración de datos.",
    objective: "Reforzar la identidad visual del agente IA ejecutando procesos de prospección y productividad.",
    emotions: ["innovacion", "inteligencia", "potencia", "futuro", "confianza"],
    keywords: ["robot", "silvania", "ia", "coreagent", "agente", "autonomo", "asistente", "prospeccion", "automatizacion"],
    situations: ["agente ia ejecutando investigacion y tareas", "identidad de agente autonomo"],
    subjects: ["agente robotico ia", "asistente digital"],
    actions: ["investigando en la web", "automatizando flujos", "asistiendo al usuario"],
    objects: ["avatar robotico ia", "interfaz luminosa"],
    useCases: ["prospeccion web con agente ia", "presentacion de agente ejecutivo"],
    scriptThemes: ["tu empleado digital 24/7", "ia real verificada ejecutando tareas"],
    narrativeRole: "solucion_agente",
    genre: "tecnologia_futurista",
    setting: "entorno digital minimalista",
  },
};

const CATEGORY_PROFILES: Record<string, CategoryEnrichmentProfile> = {
  "coreagent/automation": {
    keywords: ["automatizacion", "flujos", "orquestacion", "workspace", "sheets", "prospeccion", "pipeline", "ahorro de tiempo", "sin codigo", "24/7"],
    situations: ["automatizacion de flujos empresariales", "procesamiento automatico en lote batch"],
    subjects: ["ejecutivo", "sistema automatizado", "interfaz ia"],
    actions: ["automatizando tareas repetitivas", "sincronizando datos entre apps", "ahorrando horas de trabajo"],
    objects: ["paneles digitales", "nodos conectados", "ordenador", "google workspace"],
    useCases: ["automatizar prospeccion y sheets", "orquestar gmail calendar drive sheets", "ahorro diario de 2 horas"],
    scriptThemes: ["de trabajo manual a flujo autonomo", "eficiencia operativa con ia"],
    audience: "directivos, pymes, autonomos y equipos b2b",
    excludedProducts: ["eva"],
  },
  "coreagent/paperwork_chaos": {
    keywords: ["caos", "manual", "lento", "tedioso", "repetitivo", "papeles", "desorden", "horas perdidas", "copiar y pegar", "antes de la ia"],
    situations: ["prospeccion manual lenta y tediosa", "sobrecarga administrativa sin automatizar"],
    painPoints: ["prospeccion web manual lenta y tediosa", "copiar y pegar datos uno a uno", "horas perdidas buscando telefonos y emails", "tablas desordenadas sin formulas", "saturacion por tareas repetitivas"],
    subjects: ["profesional agobiado", "escritorio desbordado"],
    actions: ["buscando datos manualmente", "perdiendo tiempo en tareas repetitivas", "lidiando con desorden administrativo"],
    objects: ["montañas de papeles", "carpetas dispersas", "notas sueltas", "pantalla saturada"],
    useCases: ["hook de dolor prospeccion manual", "contraste antes vs despues con coreagent", "problema de hojas manuales sin estructura"],
    scriptThemes: ["la prospeccion manual consume horas", "el problema antes de coreagent"],
    audience: "autonomos, pymes, comerciales y agencias",
    excludedProducts: ["eva"],
  },
  "coreagent/stacked_documents": {
    keywords: ["documentos", "archivos", "facturas", "presupuestos", "burocracia", "manual", "lento", "tedioso", "desorden", "papeleo"],
    situations: ["acumulacion de facturas y registros manuales", "desorden antes de usar google sheets"],
    painPoints: ["exceso de registros manuales", "papeleo interminable", "trabajo lento y repetitivo"],
    subjects: ["archivos apilados", "oficina tradicional"],
    actions: ["acumulando documentos sin procesar", "revisando registros uno a uno"],
    objects: ["pilas de documentos", "carpetas", "facturas en papel"],
    useCases: ["hook de dolor administrativo", "antes vs despues de plantillas automaticas en sheets"],
    scriptThemes: ["de pilas de datos sueltos a tablas limpias", "el coste oculto del trabajo manual"],
    audience: "pymes, talleres, asesorias y autonomos",
    excludedProducts: ["eva"],
  },
  "coreagent/robots": {
    keywords: ["robot", "agente ia", "asistente", "coreagent", "autonomo", "prospeccion", "scraping", "ejecucion", "bot", "inteligencia artificial"],
    situations: ["agente ia trabajando por el usuario", "asistente digital extrayendo informacion web"],
    subjects: ["robot asistente corporativo", "agente ia"],
    actions: ["analizando paginas web", "extrayendo contactos reales", "estructurando datos automaticamente"],
    objects: ["interfaz digital", "datos verificados", "flujo inteligente"],
    useCases: ["prospeccion web autonoma", "agente coreagent ejecutando ordenes"],
    scriptThemes: ["un agente ia que hace el trabajo duro por ti", "ejecucion real verificada"],
    audience: "empresas b2b, directivos y profesionales",
    excludedProducts: ["eva"],
  },
  "coreagent/robots_computers": {
    keywords: ["robot", "ordenador", "web", "scraping", "prospeccion", "busqueda web", "sheets", "tablas", "extractor", "datos reales", "codigo"],
    situations: ["agente entrando en paginas web y extrayendo datos", "volcando fichas verificadas en google sheets"],
    subjects: ["robot manejando ordenador", "sistema autonomo web"],
    actions: ["navegando en webs reales", "leyendo paginas de contacto", "escribiendo filas en batch en sheets"],
    objects: ["ordenador", "navegador web", "tablas de datos", "crm"],
    useCases: ["prospeccion web entrando en cada web", "extraccion de telefono email whatsapp instagram", "llenado automatico de google sheets"],
    scriptThemes: ["como coreagent entra en cada web y extrae datos reales", "cero datos inventados todo verificado"],
    audience: "comerciales, agencias, pymes y usuarios coreagent",
    excludedProducts: ["eva"],
  },
  "coreagent/holograms_virtual": {
    keywords: ["holograma", "datos", "matriz", "tablas", "estructura", "crm", "conexion", "nodos", "prospeccion", "analisis web", "tecnologia"],
    situations: ["visualizacion estructurada de datos y enlaces", "organizacion inteligente en tablas y nodos"],
    subjects: ["interfaz holografica de datos", "matriz estructurada"],
    actions: ["conectando fuentes web", "estructurando columnas y filas", "validando enlaces y formulas"],
    objects: ["holograma 3d", "tablas flotantes", "graficos de datos", "enlaces verificados"],
    useCases: ["datos estructurados y funcionales en sheets", "investigacion web paralela", "arquitectura coreagent"],
    scriptThemes: ["estructura y precision con tecnologia ia", "de datos dispersos a inteligencia accionable"],
    audience: "directivos tecnologicos, pymes y profesionales",
    excludedProducts: ["eva"],
  },
  "coreagent/google_workspace": {
    keywords: ["google workspace", "sheets", "gmail", "calendar", "drive", "tablas", "prospeccion", "crm", "plantillas", "organizacion"],
    situations: ["trabajo integrado en google workspace", "creacion directa de hojas y correos"],
    subjects: ["usuario workspace", "directivo conectado"],
    actions: ["creando hojas en drive", "gestionando tablas y correos", "coordinando workspace"],
    objects: ["google sheets", "google drive", "gmail", "google calendar", "portatil"],
    useCases: ["guardar tablas en carpeta silvania de drive", "sheets estructurados", "workspace unificado"],
    scriptThemes: ["todo google workspace desde una sola conversacion", "orden total en drive y sheets"],
    audience: "profesionales y empresas usuarias de google",
    excludedProducts: ["eva"],
  },
  "coreagent/productivity": {
    keywords: ["productividad", "enfoque", "ahorro de tiempo", "eficiencia", "resultados", "tablas", "orden", "concentracion"],
    situations: ["flujo de trabajo enfocado sin distracciones", "ejecucion rapida de tareas complejas"],
    subjects: ["profesional enfocado", "directivo moderno"],
    actions: ["completando proyectos rapido", "supervisando resultados reales", "aprovechando el tiempo"],
    objects: ["ordenador limpio", "notas ordenadas", "escritorio luminoso"],
    useCases: ["ahorrar mas de 2 horas diarias", "sustituir trabajo repetitivo por ordenes agiles"],
    scriptThemes: ["recupera tu tiempo para lo importante", "productividad multiplicada por 10"],
    audience: "emprendedores, freelance y directivos",
    excludedProducts: ["eva"],
  },
  "coreagent/productivity_modern": {
    keywords: ["moderno", "espacio de trabajo", "oficina", "portatil", "eficiencia", "orden", "sheets", "leads", "crm", "prospeccion"],
    situations: ["espacio de trabajo digital moderno", "revision limpia de prospectos y tablas"],
    subjects: ["equipo moderno", "profesional digital"],
    actions: ["revisando leads en pantalla", "trabajando en tablas estructuradas", "cerrando tareas"],
    objects: ["laptop", "pantalla limpia", "mesa moderna", "iluminacion natural"],
    useCases: ["prospeccion b2b desde escritorio moderno", "seguimiento de leads en google sheets"],
    scriptThemes: ["trabaja de forma agil y moderna", "herramientas profesionales listas en segundos"],
    audience: "equipos b2b, pymes y consultores",
    excludedProducts: ["eva"],
  },
  "coreagent/luxury_offices": {
    keywords: ["oficina", "lujo", "ejecutivo", "despacho", "resultado", "exito", "calma", "empresa", "corporativo"],
    situations: ["despacho ejecutivo tranquilo tras completar trabajo", "reunion de resultados"],
    subjects: ["ceo", "directivo", "consultor senior"],
    actions: ["presentando resultados", "disfrutando tranquilidad operativa", "tomando decisiones"],
    objects: ["despacho de cristal", "mesa ejecutiva", "portatil elegante"],
    useCases: ["cierre aspiracional coreagent", "resultado de automatizacion profesional"],
    scriptThemes: ["eleva tu negocio al nivel ejecutivo", "profesionalidad impecable en cada documento"],
    audience: "directivos, gerentes y propietarios de negocio",
    excludedProducts: ["eva"],
  },
  "coreagent/executives_luxury": {
    keywords: ["ejecutivos", "reunion", "equipo", "cierre", "clientes", "acuerdo", "resultados", "b2b", "corporativo"],
    situations: ["equipo comercial analizando leads conseguidos", "presentacion de tablas e informes"],
    subjects: ["ejecutivos", "equipo comercial", "socios"],
    actions: ["analizando nuevos clientes", "revisando fichas de prospeccion", "planificando ventas"],
    objects: ["sala de juntas", "portatiles", "graficos", "documentos limpios"],
    useCases: ["equipo de ventas recibiendo leads de prospeccion", "resultados tangibles en b2b"],
    scriptThemes: ["de cero leads a cartera cualificada", "equipos enfocados en cerrar ventas"],
    audience: "equipos comerciales y directivos b2b",
    excludedProducts: ["eva"],
  },
  "coreagent/inmobiliarias": {
    keywords: ["inmobiliaria", "piso", "vivienda", "casa", "llaves", "agente inmobiliario", "alquiler", "compra", "hipoteca"],
    situations: ["captacion y gestion inmobiliaria", "visita a propiedad y dossier"],
    subjects: ["agente inmobiliario", "comprador", "vivienda"],
    actions: ["enseñando viviendas", "gestionando propietarios", "organizando leads inmobiliarios"],
    objects: ["llaves", "planos", "vivienda moderna", "contrato"],
    useCases: ["prospeccion y crm para inmobiliarias", "seguimiento automatico de clientes inmobiliarios"],
    scriptThemes: ["ia para agencias inmobiliarias", "cero leads perdidos en visitas"],
    audience: "agencias inmobiliarias y agentes independientes",
    excludedProducts: ["eva"],
  },
  "marketing/clocks_time_urgency": {
    keywords: ["reloj", "tiempo", "horas perdidas", "lenta", "tediosa", "urgencia", "espera", "retraso", "minutos", "ahorro"],
    situations: ["tiempo corriendo en tareas manuales lentas", "urgencia operativa y perdida de horas"],
    painPoints: ["horas perdidas cada semana", "procesos lentos y tediosos", "falta de tiempo para vender"],
    subjects: ["reloj marcando horas", "tiempo pasando"],
    actions: ["perdiendo horas valiosas", "midiendo el tiempo de ejecucion"],
    objects: ["reloj de arena", "cronometro", "manecillas", "calendario"],
    useCases: ["hook visual sobre lo lenta que es la prospeccion manual", "contraste de horas vs segundos con ia"],
    scriptThemes: ["deja de perder horas al dia", "el tiempo es tu recurso mas escaso"],
    audience: "autonomos, empresarios y directivos",
    excludedProducts: ["eva"],
  },
  "marketing/analytics_campaigns": {
    keywords: ["analitica", "metricas", "roi", "graficos", "crecimiento", "conversion", "tablas", "datos reales", "resultados"],
    situations: ["analisis de metricas y conversion de campañas", "lectura de resultados reales"],
    subjects: ["analista", "graficos ascendentes"],
    actions: ["midiendo conversion", "analizando leads captados", "escalando resultados"],
    objects: ["dashboards", "graficos", "tablas metricas", "monitores"],
    useCases: ["resultados de prospeccion y embudos", "analitica de crecimiento empresarial"],
    scriptThemes: ["datos medibles y resultados reales", "crecimiento basado en datos"],
    audience: "marketers, directivos y agencias",
    excludedProducts: ["eva"],
  },
  "marketing/analytics_growth": {
    keywords: ["crecimiento", "roi", "analitica", "escalar", "ventas", "metricas", "datos", "estrategia"],
    situations: ["revision estrategica de crecimiento", "evaluacion de retorno de inversion"],
    subjects: ["fundador", "director de marketing"],
    actions: ["escalando captacion", "analizando graficos de crecimiento"],
    objects: ["pantallas de analitica", "reportes estructurados"],
    useCases: ["demostrar impacto comercial", "metricas de rendimiento"],
    scriptThemes: ["multiplica tus resultados sin ampliar equipo"],
    audience: "empresas y emprendedores",
    excludedProducts: ["eva"],
  },
  "marketing/robot_marketing_desk": {
    keywords: ["robot", "asistente", "marketing", "ordenador", "automatizacion", "contenido", "ia", "datos"],
    situations: ["robot asistente operando ordenador en escritorio", "generacion autonoma de activos"],
    subjects: ["robot ia", "estacion digital"],
    actions: ["creando campañas", "procesando datos digitales"],
    objects: ["ordenador", "escritorio tecnologico"],
    useCases: ["automatizacion de marketing y contenidos", "flujos con supervision humana"],
    scriptThemes: ["ia trabajando junto al fundador"],
    audience: "marcas, creadores y pymes",
    excludedProducts: ["eva"],
  },
  "scifi_holograms/scifi_holograms": {
    keywords: ["futuro", "holograma", "red neuronal", "ia", "inteligencia artificial", "tecnologia", "conexion", "datos"],
    situations: ["procesamiento neuronal e inteligencia artificial avanzada", "conexion inteligente de datos"],
    subjects: ["red neuronal", "holograma 3d"],
    actions: ["procesando informacion en paralelo", "conectando fuentes inteligentes"],
    objects: ["hologramas cuanticos", "nodos luminosos"],
    useCases: ["explicar velocidad e inteligencia paralela de coreagent", "tecnologia futurista aplicada"],
    scriptThemes: ["potencia ia de ultima generacion", "automatizacion paralela instantanea"],
    audience: "publico tech y empresas innovadoras",
    excludedProducts: ["eva"],
  },
  "emotions/emotions": {
    keywords: ["emocion", "determinacion", "paz", "asombro", "resiliencia", "enfoque", "claridad"],
    situations: ["estado emocional humano autentico", "momento de claridad mental o determinacion"],
    subjects: ["persona adulta expresiva"],
    actions: ["reflexionando con calma", "mostrando determinacion"],
    objects: ["iluminacion cinematografica", "entorno natural o interior"],
    useCases: ["storytelling humano", "transiciones emocionales"],
    scriptThemes: ["conexion emocional con el espectador"],
    audience: "audiencia general adulta",
    excludedProducts: ["eva"],
  },
};

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const clean = String(item || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function cleanEvaContaminationFromPainPoints(painPoints: string[]): string[] {
  return painPoints
    .map((p) => {
      if (/tareas manuales|burocracia|papeleo|sheets|crm/i.test(p)) {
        return "frustracion en aprendizaje infantil y pronunciacion";
      }
      return p;
    })
    .filter(Boolean);
}

/**
 * Enriquece cualquier chunk visual con todos los atributos estructurados posibles y recalcula
 * su embedding vectorial de 256 dimensiones para maximizar la precisión guión <-> imagen
 * y garantizar el aislamiento estricto entre productos (CoreAgent/Marketing vs Eva).
 */
export function enrichVisualChunk(raw: VisualVectorChunk): VisualVectorChunk {
  const chunk: VisualVectorChunk = {
    ...raw,
    emotions: [...(raw.emotions || [])],
    keywords: [...(raw.keywords || [])],
    attributes: [...(raw.attributes || [])],
  };

  const sa: VisualStructuredAttributes = {
    industryProfile: chunk.structuredAttributes?.industryProfile || "general",
    narrativeRole: chunk.structuredAttributes?.narrativeRole || "solucion_agente",
    genre: chunk.structuredAttributes?.genre || "corporativo_real",
    emotions: [...(chunk.structuredAttributes?.emotions || chunk.emotions || [])],
    situations: [...(chunk.structuredAttributes?.situations || [])],
    painPoints: [...(chunk.structuredAttributes?.painPoints || [])],
    agentAffinity: [...(chunk.structuredAttributes?.agentAffinity || [])],
    setting: chunk.structuredAttributes?.setting || "entorno moderno",
    visualStyle: chunk.structuredAttributes?.visualStyle || "fotografia_real",
    brandSafety: "clean_no_trademarks",
    subjects: [...(chunk.structuredAttributes?.subjects || [])],
    actions: [...(chunk.structuredAttributes?.actions || [])],
    objects: [...(chunk.structuredAttributes?.objects || [])],
    useCases: [...(chunk.structuredAttributes?.useCases || [])],
    scriptThemes: [...(chunk.structuredAttributes?.scriptThemes || [])],
    audience: chunk.structuredAttributes?.audience,
    excludedProducts: [...(chunk.structuredAttributes?.excludedProducts || [])],
  };

  const specific = SPECIFIC_ASSET_OVERRIDES[chunk.id];
  if (specific) {
    chunk.title = specific.title;
    chunk.description = specific.description;
    chunk.objective = specific.objective;
    chunk.emotions = dedupeStrings([...specific.emotions, ...chunk.emotions]);
    chunk.keywords = dedupeStrings([...specific.keywords, ...chunk.keywords]);
    sa.emotions = dedupeStrings([...specific.emotions, ...sa.emotions]);
    sa.situations = dedupeStrings([...specific.situations, ...sa.situations]);
    if (specific.painPoints) sa.painPoints = dedupeStrings([...specific.painPoints, ...sa.painPoints]);
    sa.subjects = dedupeStrings([...specific.subjects, ...(sa.subjects || [])]);
    sa.actions = dedupeStrings([...specific.actions, ...(sa.actions || [])]);
    sa.objects = dedupeStrings([...specific.objects, ...(sa.objects || [])]);
    sa.useCases = dedupeStrings([...specific.useCases, ...(sa.useCases || [])]);
    sa.scriptThemes = dedupeStrings([...specific.scriptThemes, ...(sa.scriptThemes || [])]);
    if (specific.narrativeRole) sa.narrativeRole = specific.narrativeRole;
    if (specific.genre) sa.genre = specific.genre;
    if (specific.setting) sa.setting = specific.setting;
  }

  const bucketKey = `${chunk.product}/${chunk.category}`;
  const catProfile = CATEGORY_PROFILES[bucketKey];
  if (catProfile) {
    chunk.keywords = dedupeStrings([...chunk.keywords, ...catProfile.keywords]);
    sa.situations = dedupeStrings([...sa.situations, ...catProfile.situations]);
    if (catProfile.painPoints) sa.painPoints = dedupeStrings([...sa.painPoints, ...catProfile.painPoints]);
    sa.subjects = dedupeStrings([...(sa.subjects || []), ...catProfile.subjects]);
    sa.actions = dedupeStrings([...(sa.actions || []), ...catProfile.actions]);
    sa.objects = dedupeStrings([...(sa.objects || []), ...catProfile.objects]);
    sa.useCases = dedupeStrings([...(sa.useCases || []), ...catProfile.useCases]);
    sa.scriptThemes = dedupeStrings([...(sa.scriptThemes || []), ...catProfile.scriptThemes]);
    sa.audience ||= catProfile.audience;
    if (catProfile.excludedProducts) {
      sa.excludedProducts = dedupeStrings([...(sa.excludedProducts || []), ...catProfile.excludedProducts]) as ProductBrand[];
    }
  }

  // Limpieza y aislamiento estricto Eva / Cuentos infantiles vs B2B CoreAgent / Marketing
  const isChildDomain =
    chunk.product === "eva" ||
    chunk.product === "fantasy_tales" ||
    /kids_|school_classes|human_teacher|robot_teacher|learning_games|child_session|clinical_web|family_progress|phonemes|speech_therapy|parents_family|hero/i.test(chunk.category || "");

  if (isChildDomain) {
    sa.painPoints = cleanEvaContaminationFromPainPoints(sa.painPoints);
    sa.agentAffinity = chunk.product === "fantasy_tales" ? ["eva"] : ["eva"];
    sa.excludedProducts = dedupeStrings([...(sa.excludedProducts || []), "coreagent", "marketing"]) as ProductBrand[];
    sa.audience ||= "familias, docentes, colegios y logopedas infantiles";
    sa.subjects = dedupeStrings([...(sa.subjects || []), "niños", "educacion infantil", "entorno escolar o familiar"]);
    sa.actions = dedupeStrings([...(sa.actions || []), "aprendiendo con alegria", "practicando pronunciacion y lenguaje"]);
    sa.objects = dedupeStrings([...(sa.objects || []), "aula o tablet infantil", "material educativo ludico"]);
    sa.useCases = dedupeStrings([...(sa.useCases || []), "videos educativos de eva", "terapia del habla infantil"]);
    sa.scriptThemes = dedupeStrings([...(sa.scriptThemes || []), "estimulacion infantil con eva", "aprendizaje ludico seguro"]);
  } else {
    sa.excludedProducts = dedupeStrings([...(sa.excludedProducts || []), "eva"]) as ProductBrand[];
    if (chunk.product === "coreagent") {
      sa.agentAffinity = dedupeStrings([...sa.agentAffinity.filter((a) => a !== "eva"), "coreagent"]);
      sa.audience ||= "autonomos, pymes, directivos y profesionales b2b";
    } else if (chunk.product === "marketing") {
      sa.agentAffinity = dedupeStrings([...sa.agentAffinity.filter((a) => a !== "eva"), "marketing", "coreagent"]);
      sa.audience ||= "directivos, marcas, creadores y equipos comerciales";
    } else {
      sa.agentAffinity = dedupeStrings(sa.agentAffinity.filter((a) => a !== "eva"));
      sa.audience ||= "audiencia general adulta";
    }

    // Asegurar densidad mínima rica para cualquier categoría sin perfil dedicado
    if ((sa.subjects || []).length === 0) sa.subjects = dedupeStrings([chunk.category.replace(/_/g, " "), chunk.product]);
    if ((sa.actions || []).length === 0) sa.actions = dedupeStrings([chunk.objective.slice(0, 64)]);
    if ((sa.objects || []).length === 0) sa.objects = dedupeStrings(chunk.keywords.slice(0, 4));
    if ((sa.useCases || []).length === 0) sa.useCases = dedupeStrings([chunk.objective, ...sa.situations.slice(0, 2)]);
    if ((sa.scriptThemes || []).length === 0) sa.scriptThemes = dedupeStrings([chunk.title, ...chunk.emotions.slice(0, 2)]);
  }

  chunk.structuredAttributes = sa;
  chunk.emotions = dedupeStrings([...chunk.emotions, ...sa.emotions]);
  chunk.keywords = dedupeStrings(chunk.keywords);
  chunk.attributes = dedupeStrings([
    ...(chunk.attributes || []),
    sa.industryProfile,
    sa.narrativeRole,
    sa.genre,
    sa.visualStyle,
    sa.setting,
    ...sa.emotions,
    ...sa.situations,
    ...sa.painPoints,
    ...(sa.subjects || []),
    ...(sa.actions || []),
    ...(sa.objects || []),
    ...(sa.useCases || []),
    ...(sa.scriptThemes || []),
    ...chunk.keywords,
  ]).sort();

  const richVectorText = [
    chunk.product,
    chunk.category,
    chunk.title,
    chunk.description,
    chunk.objective,
    chunk.emotions.join(" "),
    chunk.keywords.join(" "),
    chunk.attributes.join(" "),
    sa.situations.join(" "),
    sa.painPoints.join(" "),
    (sa.subjects || []).join(" "),
    (sa.actions || []).join(" "),
    (sa.objects || []).join(" "),
    (sa.useCases || []).join(" "),
    (sa.scriptThemes || []).join(" "),
  ]
    .filter(Boolean)
    .join(" | ");

  chunk.vector = computeSemanticVector(richVectorText, false);
  return chunk;
}
