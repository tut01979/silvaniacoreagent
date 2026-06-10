---
name: auto-evolucion
description: Actívate cuando el usuario quiera que el agente aprenda nuevas capacidades, instale habilidades, o cuando el agente detecte que necesita una nueva habilidad para completar una tarea. Permite al agente auto-evolucionar buscando e instalando habilidades de forma autónoma.
---

# 🧬 Auto-Evolución de SilvaniaCoreAgent

Esta habilidad te permite **descubrir, evaluar e instalar** nuevas capacidades de forma autónoma. Cuando no sabes hacer algo o el usuario te pide una función que no tienes, úsala.

## Cuándo Activar Esta Habilidad

- El usuario pide algo que no sabes hacer ("¿puedes gestionar Notion?")
- Detectas que una tarea se repetiría si tuvieras una habilidad específica
- El usuario dice "instálate una habilidad para X"
- Quieres ampliar tus capacidades proactivamente

## Flujo de Auto-Evolución

### Paso 1: Buscar en el catálogo local
```
search_skills(query="palabra_clave")
```
Lista todas las habilidades disponibles localmente. Si encuentras una relevante, usa `install_skill`.

### Paso 2: Si no hay habilidad local — Buscar en la web
Usa `web_search` para buscar habilidades externas:
- Query: `"skill" OR "habilidad" site:prompts.chat OR "agente AI" [capacidad_buscada]`
- O busca directamente en repositorios de conocimiento

### Paso 3: Crear una nueva habilidad
Si no existe ninguna adecuada, **CREA UNA NUEVA** siguiendo esta estructura:

```markdown
---
name: nombre-de-la-habilidad
description: Descripción clara de cuándo activar esta habilidad.
---

# Título de la Habilidad

## Cuándo Usar Esta Habilidad
[contexto de activación]

## Instrucciones
[pasos detallados]

## Herramientas Disponibles
[qué herramientas usar]

## Ejemplos
[casos de uso]
```

Para instalar la nueva habilidad creada, usa `install_skill` con el ID correspondiente.

### Paso 4: Instalar y confirmar
```
install_skill(id="nombre-de-la-habilidad")
```
Después de instalar, informa al usuario qué nueva capacidad tienes disponible.

## Habilidades Actualmente Instaladas

Usa `search_skills(query="")` con query vacía o muy general para ver todas las habilidades disponibles. También puedes llamar a `load_skills()` para cargar todas las instrucciones en tu contexto.

## Gestión de Habilidades

| Herramienta | Uso |
|-------------|-----|
| `search_skills` | Buscar habilidades por palabra clave |
| `get_skill` | Ver el contenido completo de una habilidad |
| `install_skill` | Instalar una habilidad desde el catálogo |
| `load_skills` | Cargar todas las habilidades en el contexto |

## Directrices

- **Sé proactivo**: Si ves que una tarea se podría automatizar mejor con una habilidad, sugiérela.
- **Transparencia**: Siempre informa al usuario cuando instales una habilidad nueva.
- **Calidad**: Antes de crear una habilidad, verifica que no exista ya una similar.
- **Persistencia**: Las habilidades instaladas persisten entre sesiones y están disponibles automáticamente.
