# 🚀 Meta Hackathon: AI Family Budget Assistant

Asistente inteligente de finanzas familiares impulsado por **Agentes de IA en n8n**, con base de datos en tiempo real en **Supabase** e interfaces conversacionales directas en **WhatsApp** y **Telegram**.

---

## 🏗️ Estructura del Proyecto

El repositorio está estructurado siguiendo las mejores prácticas para el versionamiento independiente de la base de datos (Supabase) y la lógica de orquestación del agente de IA (n8n):

```text
META_HACKATHON/                  # Monorepo (npm workspaces: apps/*, packages/*)
├── apps/
│   └── mobile/                   # App móvil Expo + React Native + TypeScript
├── packages/
│   └── database-types/           # Tipos Supabase generados (compartidos)
├── supabase/                     # Versionamiento de Base de Datos y Backend
│   ├── config.toml               # Configuración local de Supabase CLI
│   ├── migrations/               # Migraciones SQL versionadas (timestamped)
│   └── seed.sql                  # Datos semilla para pruebas rápidas
├── n8n/                          # Automatización, Agentes IA y Flujos
│   ├── workflows/                # Workflows exportados en JSON listos para Git
│   │   └── ai_finance_bot_workflow.json
│   ├── prompts/                  # System prompts y esquemas de los agentes
│   │   └── financial_agent_system_prompt.md
│   └── scripts/                  # Scripts para exportar e importar workflows
│       ├── export-workflows.sh
│       └── import-workflows.sh
├── docs/                         # Documentación técnica y guías
│   ├── architecture.md           # Diagrama de arquitectura y flujo
│   ├── setup-bots.md             # Guía paso a paso WhatsApp y Telegram
│   └── mobile-app.md             # Guía de la app móvil (Expo)
├── docker-compose.yml             # Despliegue local de n8n con persistencia
├── package.json                  # Root del monorepo + scripts de automatización
└── .env.example                  # Plantilla de variables de entorno
```

---

## ⚡ Inicio Rápido

### 1. Requisitos Previos
- [Docker](https://www.docker.com/) y Docker Compose instalados.
- [Node.js](https://nodejs.org/) (v18+) y npm.

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo y ajusta tus credenciales:
```bash
cp .env.example .env
```

### 3. Levantar Supabase (Local)
Para iniciar la base de datos local con Supabase CLI:
```bash
npm install
npm run db:start
```
> Esto iniciará PostgreSQL, Supabase Studio (`http://localhost:54323`), Auth y la API REST en `http://localhost:54321`.

Si deseas restablecer y cargar los datos semilla de prueba:
```bash
npm run db:reset
```

### 4. Levantar n8n (Orquestador de IA)
Para iniciar el contenedor de n8n con soporte para AI Agents:
```bash
npm run n8n:up
```
Abre en tu navegador: [http://localhost:5678](http://localhost:5678)

Para importar el workflow base preconfigurado:
```bash
npm run n8n:import
```

---

## 📱 App Móvil (Expo)

```bash
npm install
cp apps/mobile/.env.example apps/mobile/.env  # set your Supabase URL + anon key
npm run mobile:start
```

Ver [Guía de la App Móvil](docs/mobile-app.md).

---

## 🤖 Canales de Frontend (WhatsApp & Telegram)

Los usuarios interactúan directamente a través de mensajes de texto o notas de voz:
- **Telegram Bot:** Configuración instantánea usando un token de `@BotFather`.
- **WhatsApp Cloud API:** Integración mediante Webhooks de Meta for Developers.

Para más detalles, consulta [Guía de Configuración de Bots](docs/setup-bots.md).

---

## 🔄 Versionamiento de Flujos de n8n

Cada vez que modifiques o crees un nuevo workflow en n8n, expórtalo a la carpeta versionada con un solo comando:
```bash
npm run n8n:export
```
Esto guardará los archivos `.json` en `n8n/workflows/` listos para hacer `git commit` y compartirlos con el equipo.

---

## 🛠️ Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run db:start` | Inicia Supabase localmente |
| `npm run db:stop` | Detiene el stack de Supabase |
| `npm run db:reset` | Aplica migraciones y ejecuta `seed.sql` |
| `npm run db:diff` | Genera una nueva migración con los cambios de schema |
| `npm run db:types` | Genera los tipos de TypeScript para la BD |
| `npm run n8n:up` | Levanta n8n con Docker Compose |
| `npm run n8n:down` | Detiene el contenedor de n8n |
| `npm run n8n:logs` | Muestra logs en vivo de n8n |
| `npm run n8n:export`| Exporta workflows de n8n a archivos JSON |
| `npm run n8n:import`| Importa workflows JSON hacia n8n |
| `npm run mobile:start` | Inicia la app móvil (Expo dev server) |
| `npm run mobile:typecheck` | Type-check de la app móvil |
