# Arquitectura del Sistema - AI Family Budget Bot

## Diagrama de Arquitectura

```mermaid
graph TD
    subgraph "Frontends (Canales de Mensajería)"
        WA["WhatsApp (Meta Cloud API)"]
        TG["Telegram Bot (@BotFather)"]
    end

    subgraph "Capa de Automatización e Inteligencia (n8n)"
        WH["Webhooks / Triggers de n8n"]
        AGENT["AI Agent (LangChain)"]
        LLM["Modelo LLM (OpenAI GPT-4o / Anthropic / Groq)"]
        TOOLS["Herramientas / Tools (HTTP RPC)"]
    end

    subgraph "Backend y Base de Datos (Supabase)"
        DB[(PostgreSQL)]
        RPC_REG["RPC register_bot_transaction()"]
        RPC_SUM["RPC get_monthly_summary()"]
        TBL_TRANS["Tabla transactions"]
        TBL_HOUSE["Tabla households"]
        TBL_PROF["Tabla bot_profiles"]
        TBL_CAT["Tabla categories"]
    end

    WA -->|Webhook HTTP POST| WH
    TG -->|Webhook / Polling| WH
    WH --> AGENT
    AGENT <-->|Inferencia / Reasoning| LLM
    AGENT -->|Llamada a Tool| TOOLS
    TOOLS -->|POST /rpc/register_bot_transaction| RPC_REG
    TOOLS -->|POST /rpc/get_monthly_summary| RPC_SUM
    RPC_REG --> TBL_TRANS
    RPC_REG --> TBL_CAT
    RPC_REG --> TBL_PROF
    RPC_SUM --> TBL_TRANS
    RPC_SUM --> TBL_HOUSE
    AGENT -->|Respuesta de confirmación o balance| WA
    AGENT -->|Respuesta de confirmación o balance| TG
```

## Flujo de Datos

1. **Entrada de Usuario:** El usuario envía un mensaje o audio por WhatsApp o Telegram (ej: *"Gasté 45 Bs en el almuerzo"* o *"¿Cuánto hemos gastado en comida este mes?"*).
2. **Recepción en n8n:** El Webhook o Trigger de canal recibe el mensaje e identifica el remitente (`channel_user_id`, `display_name`).
3. **Razonamiento del Agente IA:** El AI Agent analiza el texto, infiere el tipo (gasto vs ingreso), monto, moneda, categoría y detalle.
4. **Persistencia en Supabase:** Invoca la función RPC de Supabase con seguridad `service_role`. La función verifica o crea el usuario y hogar, registra el movimiento y calcula el balance actual.
5. **Respuesta Inmediata:** El agente responde en lenguaje natural amigable y formateado con emojis al chat de WhatsApp o Telegram.
