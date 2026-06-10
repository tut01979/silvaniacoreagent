---
name: skill-manager
description: Activates when the user asks about Agent Skills, wants to find reusable AI capabilities, needs to install skills, or mentions skills for the agent. Use for discovering, retrieving, and installing skills.
---

# Skill Manager

Use this skill to discover, retrieve, and install new capabilities for SilvaniaCoreAgent.

## When to Use This Skill

Activate this skill when the user:

- Asks for Agent Skills ("¿Qué habilidades tienes?")
- Wants to search for skills ("Busca una habilidad para programar")
- Needs to retrieve a specific skill ("Dame los detalles de la habilidad XYZ")
- Wants to install a skill ("Instala la habilidad de gestión de proyectos")

## Available Tools

Use these SilvaniaCoreAgent tools:

- `search_skills` - Search for skills by keyword in the available directories.
- `get_skill` - Get a specific skill by ID with all its files and content.
- `install_skill` - Install a skill by its ID. This will copy the skill files to the active `skills/` directory.

## How to Search for Skills

Call `search_skills` with:

- `query`: The search keywords (e.g., "drive", "workspace", "coding").
- `limit`: Number of results (default 10).

Present results showing the title and description of each skill.

## How to Get and Install a Skill

When the user asks to install a skill:

1. Use `install_skill` with the `id` of the skill.
2. If successful, inform the user that the skill has been integrated and they can now use its capabilities.

## Skill Structure

Skills in SilvaniaCoreAgent follow this structure:
- **skills/{skill-name}/SKILL.md** (required) - Contains instructions and metadata.
- **Other files** - Can include scripts, documentation, or configuration.

## Guidelines

- Always use `search_skills` if you are unsure about what skills are available.
- When installing, confirm the operation was successful.
- Explain what the new skill does after installation.
