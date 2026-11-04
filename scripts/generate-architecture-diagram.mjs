import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

// Architecture diagram SVG generator
const width = 1960;
const height = 1260;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <!-- Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC" />
      <stop offset="100%" stop-color="#EFF6F3" />
    </linearGradient>

    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0B3D2E" />
      <stop offset="100%" stop-color="#1B5E4B" />
    </linearGradient>

    <linearGradient id="clientGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F8F5" />
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0F172A" flood-opacity="0.08" />
    </filter>

    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.06" />
    </filter>

    <!-- Arrow Markers -->
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#0B3D2E" />
    </marker>
    <marker id="arrowBlue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284C7" />
    </marker>
    <marker id="arrowPurple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#7C3AED" />
    </marker>
    <marker id="arrowAmber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#D97706" />
    </marker>
  </defs>

  <style>
    .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; fill: #FFFFFF; }
    .subtitle { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; fill: #D1FAE5; }
    .zone-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; fill: #0B3D2E; }
    .zone-desc { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; fill: #475569; }
    
    .card-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; fill: #0F172A; }
    .card-used-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; fill: #0B3D2E; }
    .card-used-val { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; fill: #064E3B; }
    .card-alt-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; fill: #64748B; }
    .card-alt-val { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; fill: #475569; font-style: italic; }
    .card-body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; fill: #334155; line-height: 1.4; }
    .badge-pill { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 700; }
    .flow-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; fill: #1E293B; }
  </style>

  <!-- Background Canvas -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

  <!-- TOP HEADER -->
  <rect x="0" y="0" width="${width}" height="100" fill="url(#headerGrad)" />
  <g transform="translate(45, 34)">
    <circle cx="20" cy="18" r="18" fill="#10B981" opacity="0.9" />
    <text x="20" y="24" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="20" font-weight="900" fill="#FFFFFF">A</text>
    <text x="50" y="16" class="title">ARQUITECTURA GENERAL DE LA SOLUCIÓN · ArkAI</text>
    <text x="50" y="38" class="subtitle">Diseño Integral de Finanzas Familiares: Frontends Multiplataforma, Gateway, Orquestación de Agentes con n8n, Backend Serverless, Base de Datos y Modelos de IA</text>
  </g>

  <!-- LEGEND (Top Right) -->
  <g transform="translate(1420, 24)">
    <rect width="495" height="52" rx="8" fill="#064E3B" opacity="0.75" />
    <!-- Generic -->
    <rect x="15" y="14" width="12" height="12" rx="3" fill="#0F172A" />
    <text x="33" y="24" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#FFFFFF">Nombre Genérico</text>

    <!-- Used -->
    <rect x="160" y="14" width="12" height="12" rx="3" fill="#10B981" />
    <text x="178" y="24" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#D1FAE5">Herramienta Utilizada</text>

    <!-- Alternatives -->
    <rect x="330" y="14" width="12" height="12" rx="3" fill="#64748B" />
    <text x="348" y="24" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#E2E8F0">Alternativas</text>
  </g>

  <!-- ========================================================================= -->
  <!-- COLUMN 1: CLIENTES & FRONTENDS (x: 40, w: 320)                            -->
  <!-- ========================================================================= -->
  <g transform="translate(40, 130)">
    <!-- Zone Container -->
    <rect width="320" height="1080" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#shadow)" />
    <rect width="320" height="46" rx="16" fill="#F1F8F5" />
    <rect y="36" width="320" height="10" fill="#F1F8F5" />
    <text x="16" y="28" class="zone-title">1. CLIENTES &amp; FRONTENDS</text>
    <text x="16" y="60" class="zone-desc">Interfaces de usuario y canales de entrada</text>

    <!-- Card 1.1: Web SPA -->
    <g transform="translate(15, 80)">
      <rect width="290" height="230" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="230" rx="3" fill="#0284C7" />
      <text x="18" y="28" class="card-title">Aplicación Web (SPA)</text>
      
      <!-- Used Badge -->
      <rect x="18" y="40" width="254" height="48" rx="8" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1" />
      <text x="26" y="56" class="card-used-label">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="74" class="card-used-val">Expo Web + Cloudflare Pages</text>

      <!-- Alternatives -->
      <rect x="18" y="96" width="254" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="111" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="126" class="card-alt-val">Next.js, Vite + React, Nuxt, SvelteKit</text>

      <!-- Description -->
      <text x="18" y="156" class="card-body">• Despliegue estático con CDN global.</text>
      <text x="18" y="174" class="card-body">• Enrutamiento SPA con fallback de URLs.</text>
      <text x="18" y="192" class="card-body">• Headers de seguridad estrictos (HSTS, XSS).</text>
      <text x="18" y="210" class="card-body">• Dominio personalizado: test-arkai.kplian.com</text>
    </g>

    <!-- Card 1.2: Mobile Apps (Android & iOS) -->
    <g transform="translate(15, 330)">
      <rect width="290" height="250" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="250" rx="3" fill="#10B981" />
      <text x="18" y="28" class="card-title">App Móvil Multiplataforma</text>
      
      <!-- Used Badge -->
      <rect x="18" y="40" width="254" height="58" rx="8" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1" />
      <text x="26" y="56" class="card-used-label">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="72" class="card-used-val">Expo SDK 52 + React Native 0.88</text>
      <text x="26" y="87" class="card-body" font-size="10" fill="#047857">(Builds nativos Android APK / iOS)</text>

      <!-- Alternatives -->
      <rect x="18" y="106" width="254" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="121" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="136" class="card-alt-val">Flutter, Kotlin Multiplatform, Swift / Compose</text>

      <!-- Description -->
      <text x="18" y="166" class="card-body">• 100% código compartido con la Web.</text>
      <text x="18" y="184" class="card-body">• Grabación de audio para notas de voz.</text>
      <text x="18" y="202" class="card-body">• Captura de recibos con cámara.</text>
      <text x="18" y="220" class="card-body">• Speed Dial FAB interactivo en Journal.</text>
      <text x="18" y="238" class="card-body">• Indicador de pirámide presupuestaria.</text>
    </g>

    <!-- Card 1.3: Messaging Channels (WhatsApp & Telegram) -->
    <g transform="translate(15, 600)">
      <rect width="290" height="250" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="250" rx="3" fill="#25D366" />
      <text x="18" y="28" class="card-title">Canales de Mensajería</text>
      
      <!-- Used Badge -->
      <rect x="18" y="40" width="254" height="58" rx="8" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1" />
      <text x="26" y="56" class="card-used-label">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="72" class="card-used-val">WhatsApp Cloud API &amp; Telegram Bot</text>
      <text x="26" y="87" class="card-body" font-size="10" fill="#047857">(Meta Cloud API + Telegram Bot API)</text>

      <!-- Alternatives -->
      <rect x="18" y="106" width="254" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="121" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="136" class="card-alt-val">Slack, Discord Bots, Twilio SMS, Signal</text>

      <!-- Description -->
      <text x="18" y="166" class="card-body">• Registro conversacional por chat.</text>
      <text x="18" y="184" class="card-body">• Envío de audios, fotos y texto libre.</text>
      <text x="18" y="202" class="card-body">• Botón con confirmación directa en la app.</text>
      <text x="18" y="220" class="card-body">• Validación de pertenencia de canal en BD.</text>
      <text x="18" y="238" class="card-body">• Respuestas interactivas con saldo y alertas.</text>
    </g>

    <!-- Card 1.4: Protocolo MCP Client -->
    <g transform="translate(15, 870)">
      <rect width="290" height="180" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="180" rx="3" fill="#8B5CF6" />
      <text x="18" y="28" class="card-title">Clientes de Agentes de IA</text>
      
      <!-- Used Badge -->
      <rect x="18" y="40" width="254" height="48" rx="8" fill="#F5F3FF" stroke="#DDD6FE" stroke-width="1" />
      <text x="26" y="56" class="card-used-label" fill="#6D28D9">ESTÁNDAR UTILIZADO:</text>
      <text x="26" y="74" class="card-used-val" fill="#4C1D95">MCP Client (Model Context Protocol)</text>

      <!-- Alternatives -->
      <rect x="18" y="96" width="254" height="40" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="111" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="125" class="card-alt-val">OpenAI Function Calling, LangChain Tools</text>

      <text x="18" y="152" class="card-body">• Claude Desktop, IDE Antigravity / Cursor.</text>
      <text x="18" y="168" class="card-body">• Consulta activos y mercados desde agentes.</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- COLUMN 2: API GATEWAY & SEGURIDAD (x: 400, w: 270)                         -->
  <!-- ========================================================================= -->
  <g transform="translate(400, 130)">
    <rect width="270" height="1080" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#shadow)" />
    <rect width="270" height="46" rx="16" fill="#EFF6FF" />
    <rect y="36" width="270" height="10" fill="#EFF6FF" />
    <text x="16" y="28" class="zone-title" fill="#1E40AF">2. API GATEWAY &amp; SEGURIDAD</text>
    <text x="16" y="60" class="zone-desc">Punto único de entrada, TLS y enrutamiento</text>

    <!-- Card 2.1: Gateway -->
    <g transform="translate(15, 80)">
      <rect width="240" height="360" rx="12" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="360" rx="3" fill="#2563EB" />
      <text x="16" y="28" class="card-title">API Gateway &amp; Router</text>
      
      <!-- Used Badge -->
      <rect x="16" y="42" width="208" height="58" rx="8" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1" />
      <text x="24" y="58" class="card-used-label" fill="#1E40AF">HERRAMIENTA UTILIZADA:</text>
      <text x="24" y="74" class="card-used-val" fill="#1D4ED8">Kong API Gateway</text>
      <text x="24" y="89" class="card-body" font-size="10" fill="#1E40AF">(Módulo integrado de Supabase)</text>

      <!-- Alternatives -->
      <rect x="16" y="108" width="208" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="24" y="123" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="24" y="138" class="card-alt-val">Traefik, AWS API Gateway, KrakenD, Envoy</text>

      <!-- Roles -->
      <text x="16" y="172" class="card-body" font-weight="700">Responsabilidades clave:</text>
      <text x="16" y="192" class="card-body">• Validación centralizada de JWT.</text>
      <text x="16" y="210" class="card-body">• Terminación TLS/SSL segura.</text>
      <text x="16" y="228" class="card-body">• Control de CORS y Rate Limiting.</text>
      <text x="16" y="246" class="card-body">• Enrutamiento transparente:</text>
      <text x="26" y="264" class="card-body" fill="#2563EB">→ /rest/v1 (PostgREST API)</text>
      <text x="26" y="282" class="card-body" fill="#2563EB">→ /functions/v1 (Edge Functions)</text>
      <text x="26" y="300" class="card-body" fill="#2563EB">→ /storage/v1 (Archivos/S3)</text>
      <text x="26" y="318" class="card-body" fill="#2563EB">→ /auth/v1 (GoTrue Auth)</text>
      <text x="16" y="342" class="card-body">• Aislamiento de red interna.</text>
    </g>

    <!-- Card 2.2: Webhooks Gateway -->
    <g transform="translate(15, 470)">
      <rect width="240" height="240" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="240" rx="3" fill="#D97706" />
      <text x="16" y="28" class="card-title">Recepción de Webhooks</text>
      
      <!-- Used Badge -->
      <rect x="16" y="42" width="208" height="50" rx="8" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1" />
      <text x="24" y="58" class="card-used-label" fill="#B45309">HERRAMIENTA UTILIZADA:</text>
      <text x="24" y="76" class="card-used-val" fill="#92400E">n8n Webhook Ingress (HTTPS)</text>

      <!-- Alternatives -->
      <rect x="16" y="100" width="208" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="24" y="115" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="24" y="130" class="card-alt-val">Hookdeck, Svix, AWS Lambda Function URL</text>

      <text x="16" y="162" class="card-body">• Endpoint HTTPS verificado por Meta.</text>
      <text x="16" y="180" class="card-body">• Handshake y token de verificación.</text>
      <text x="16" y="198" class="card-body">• Recepción asíncrona de eventos.</text>
      <text x="16" y="216" class="card-body">• Despacho inmediato a flujos de IA.</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- COLUMN 3: AUTOMATIZACIÓN & BACKEND LOGIC (x: 710, w: 470)                 -->
  <!-- ========================================================================= -->
  <g transform="translate(710, 130)">
    <rect width="470" height="1080" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#shadow)" />
    <rect width="470" height="46" rx="16" fill="#FAF5FF" />
    <rect y="36" width="470" height="10" fill="#FAF5FF" />
    <text x="16" y="28" class="zone-title" fill="#6B21A8">3. CAPA DE LÓGICA, BACKEND Y AUTOMATIZACIÓN</text>
    <text x="16" y="60" class="zone-desc">Orquestación de agentes, flujos de trabajo y servicios serverless</text>

    <!-- Card 3.1: Workflow Automation (n8n) -->
    <g transform="translate(15, 80)">
      <rect width="440" height="340" rx="12" fill="#FFFFFF" stroke="#E9D5FF" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="340" rx="3" fill="#9333EA" />
      <text x="18" y="28" class="card-title">Motor de Automatización &amp; Agentes de IA</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="404" height="60" rx="8" fill="#FAF5FF" stroke="#D8B4FE" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#7E22CE">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="76" class="card-used-val" fill="#6B21A8">n8n Workflow Automation (Webhooks + AI Agent Nodes)</text>
      <text x="26" y="92" class="card-body" font-size="10" fill="#7E22CE">(Flujos visuales auto-hospedados con triggers de Meta y Telegram)</text>

      <!-- Alternatives -->
      <rect x="18" y="110" width="404" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="125" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="140" class="card-alt-val">Temporal.io, Apache Airflow, Make (Integromat), LangGraph, CrewAI, Flowise</text>

      <!-- Details -->
      <text x="18" y="174" class="card-body" font-weight="700">Procesos automatizados en la solución:</text>
      <text x="18" y="194" class="card-body">• Webhooks reactivos para WhatsApp Cloud y Telegram Bot.</text>
      <text x="18" y="212" class="card-body">• Descarga y decodificación de audio OGG/Opus y transcripción de voz.</text>
      <text x="18" y="230" class="card-body">• Extracción estructurada de gastos/ingresos con visión y OCR.</text>
      <text x="18" y="248" class="card-body">• Validación de propiedad de canal telefónico mediante advisory locks.</text>
      <text x="18" y="266" class="card-body">• Agente IA conversacional que decide si invocar herramientas financieras.</text>
      <text x="18" y="284" class="card-body">• Ejecución de RPCs transaccionales directamente en PostgreSQL.</text>
      <text x="18" y="302" class="card-body">• Generación de respuestas naturales confirmando la categoría y el saldo.</text>
      <text x="18" y="322" class="card-body" fill="#7E22CE" font-weight="600">→ Intercambio de herramientas con protocolo estandarizado MCP.</text>
    </g>

    <!-- Card 3.2: Backend Serverless & PostgREST -->
    <g transform="translate(15, 440)">
      <rect width="440" height="350" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="350" rx="3" fill="#059669" />
      <text x="18" y="28" class="card-title">Backend Serverless &amp; API Automática</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="404" height="68" rx="8" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#047857">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="76" class="card-used-val" fill="#065F46">Supabase Edge Functions (Deno / TS) + PostgREST</text>
      <text x="26" y="93" class="card-body" font-size="10" fill="#047857">(API REST auto-generada sobre esquemas y funciones edge especializadas)</text>

      <!-- Alternatives -->
      <rect x="18" y="118" width="404" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="133" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="148" class="card-alt-val">NestJS, Express / FastAPI, AWS Lambda + API Gateway, Firebase, Appwrite</text>

      <!-- Edge Functions list -->
      <text x="18" y="182" class="card-body" font-weight="700">Funciones Edge desplegadas en producción:</text>
      <text x="18" y="202" class="card-body" font-weight="600" fill="#047857">1. journal-ai:</text>
      <text x="100" y="202" class="card-body">Procesa texto, audio (Meta Muse ASR) o fotos desde la app móvil/web.</text>
      
      <text x="18" y="222" class="card-body" font-weight="600" fill="#047857">2. audio-transcribe:</text>
      <text x="145" y="222" class="card-body">Conversión de Opus/WAV a 16kHz y transcripción con IA.</text>

      <text x="18" y="242" class="card-body" font-weight="600" fill="#047857">3. asset-market:</text>
      <text x="115" y="242" class="card-body">Cotizaciones en tiempo real y valoración de activos (Twelve Data).</text>

      <text x="18" y="262" class="card-body" font-weight="600" fill="#047857">4. asset-market-mcp:</text>
      <text x="155" y="262" class="card-body">Servidor MCP que expone cotizaciones como herramientas a la IA.</text>

      <text x="18" y="288" class="card-body" font-weight="700">PostgREST (Capa de Acceso a Datos):</text>
      <text x="18" y="306" class="card-body">• Traduce consultas HTTP directamente a sentencias SQL seguras.</text>
      <text x="18" y="324" class="card-body">• Respeta al 100% las políticas Row-Level Security (RLS) del usuario autenticado.</text>
      <text x="18" y="342" class="card-body">• Cero middleware manual: mapeo tipado instantáneo con TypeScript.</text>
    </g>

    <!-- Card 3.3: MCP Protocol Server -->
    <g transform="translate(15, 810)">
      <rect width="440" height="240" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="240" rx="3" fill="#6366F1" />
      <text x="18" y="28" class="card-title">Servidor de Herramientas MCP</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="404" height="50" rx="8" fill="#EEF2FF" stroke="#C7D2FE" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#4338CA">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="76" class="card-used-val" fill="#3730A3">Model Context Protocol Server (Deno Edge Function)</text>

      <!-- Alternatives -->
      <rect x="18" y="100" width="404" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="115" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="130" class="card-alt-val">Custom REST Function Calling, OpenAPI Tool Definitions, Semantic Kernel</text>

      <text x="18" y="162" class="card-body">• Protocolo estándar abierto promovido por Anthropic y Meta.</text>
      <text x="18" y="180" class="card-body">• Permite a agentes de IA listar y ejecutar herramientas financieras en vivo.</text>
      <text x="18" y="198" class="card-body">• Herramienta expuesta: 'get_asset_quotes' (consulta de acciones, criptos y divisas).</text>
      <text x="18" y="216" class="card-body">• Conexión plug-and-play tanto para n8n como para IDEs (Claude / Antigravity).</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- COLUMN 4: BASE DE DATOS & STORAGE (x: 1210, w: 340)                       -->
  <!-- ========================================================================= -->
  <g transform="translate(1210, 130)">
    <rect width="340" height="1080" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#shadow)" />
    <rect width="340" height="46" rx="16" fill="#F0FDF4" />
    <rect y="36" width="340" height="10" fill="#F0FDF4" />
    <text x="16" y="28" class="zone-title" fill="#15803D">4. BASE DE DATOS &amp; PERSISTENCIA</text>
    <text x="16" y="60" class="zone-desc">Motor relacional, seguridad RLS y funciones PL/pgSQL</text>

    <!-- Card 4.1: PostgreSQL -->
    <g transform="translate(15, 80)">
      <rect width="310" height="540" rx="12" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="540" rx="3" fill="#16A34A" />
      <text x="18" y="28" class="card-title">Base de Datos Relacional</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="274" height="60" rx="8" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#15803D">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="76" class="card-used-val" fill="#14532D">PostgreSQL 15+ (Supabase Managed)</text>
      <text x="26" y="92" class="card-body" font-size="10" fill="#15803D">(Con extensiones pgvector, pgcrypto y pg_cron)</text>

      <!-- Alternatives -->
      <rect x="18" y="110" width="274" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="125" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="140" class="card-alt-val">MySQL 8, CockroachDB, AWS Aurora, PlanetScale</text>

      <!-- Schema architecture -->
      <text x="18" y="174" class="card-body" font-weight="700">Esquemas aislados y seguridad:</text>
      <text x="18" y="194" class="card-body" font-weight="600" fill="#15803D">Esquema budget:</text>
      <text x="28" y="210" class="card-body">• tuser, thousehold, thousehold_user (hogares y miembros)</text>
      <text x="28" y="226" class="card-body">• taccount, tauxiliar, taccount_type (plan de cuentas)</text>
      <text x="28" y="242" class="card-body">• ttransaction, ttransaction_detail (diario doble partida)</text>
      <text x="28" y="258" class="card-body">• tbudget, tfinancial_pyramid (pirámide y presupuestos)</text>
      <text x="28" y="274" class="card-body">• tchannel (canales vinculados: whatsapp, telegram)</text>
      
      <text x="18" y="300" class="card-body" font-weight="600" fill="#15803D">Esquema family_mcp_private:</text>
      <text x="28" y="316" class="card-body">• whatsapp_link_challenge (retos de vinculación)</text>
      <text x="28" y="332" class="card-body">• whatsapp_link_settings (teléfono del bot seguro)</text>
      <text x="28" y="348" class="card-body">• Totalmente inaccesible desde el cliente público.</text>

      <text x="18" y="374" class="card-body" font-weight="700">Mecanismos de Seguridad RLS:</text>
      <text x="18" y="392" class="card-body">• Row-Level Security activado en todas las tablas.</text>
      <text x="18" y="410" class="card-body">• Usuarios solo ven datos del hogar al que pertenecen.</text>
      <text x="18" y="428" class="card-body">• Advisory Locks para prevenir colisiones en transacciones.</text>

      <text x="18" y="454" class="card-body" font-weight="700">Lógica en Procedimientos Almacenados (RPCs):</text>
      <text x="18" y="472" class="card-body">• f_register_transaction_ai_lab()</text>
      <text x="18" y="490" class="card-body">• f_messaging_ingress_lab() (canal seguro)</text>
      <text x="18" y="508" class="card-body">• f_begin_whatsapp_verification()</text>
      <text x="18" y="526" class="card-body">• f_refresh_asset_market_positions()</text>
    </g>

    <!-- Card 4.2: Storage -->
    <g transform="translate(15, 640)">
      <rect width="310" height="200" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="200" rx="3" fill="#0EA5E9" />
      <text x="18" y="28" class="card-title">Almacenamiento de Archivos</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="274" height="48" rx="8" fill="#F0F9FF" stroke="#BAE6FD" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#0369A1">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="74" class="card-used-val" fill="#075985">Supabase Storage (S3-Compatible)</text>

      <!-- Alternatives -->
      <rect x="18" y="98" width="274" height="40" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="113" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="127" class="card-alt-val">AWS S3, Cloudflare R2, Google Cloud Storage</text>

      <text x="18" y="156" class="card-body">• Bucket 'receipts': Fotos de recibos y facturas.</text>
      <text x="18" y="174" class="card-body">• Bucket 'audio': Notas de voz y audios OGG/WAV.</text>
      <text x="18" y="192" class="card-body">• Políticas RLS por usuario y hogar.</text>
    </g>

    <!-- Card 4.3: Autenticación -->
    <g transform="translate(15, 860)">
      <rect width="310" height="190" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="190" rx="3" fill="#F59E0B" />
      <text x="18" y="28" class="card-title">Servicio de Autenticación</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="274" height="48" rx="8" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#B45309">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="74" class="card-used-val" fill="#92400E">Supabase Auth (GoTrue + JWT)</text>

      <!-- Alternatives -->
      <rect x="18" y="98" width="274" height="40" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="113" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="127" class="card-alt-val">Auth0, Firebase Auth, Clerk, Keycloak</text>

      <text x="18" y="156" class="card-body">• Login con Email &amp; Contraseña.</text>
      <text x="18" y="172" class="card-body">• Google OAuth / SSO corporativo.</text>
      <text x="18" y="188" class="card-body">• Emisión de JWT seguro con uid y claims.</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- COLUMN 5: MODELOS DE IA & SERVICIOS EXTERNOS (x: 1580, w: 340)            -->
  <!-- ========================================================================= -->
  <g transform="translate(1580, 130)">
    <rect width="340" height="1080" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#shadow)" />
    <rect width="340" height="46" rx="16" fill="#FEF2F2" />
    <rect y="36" width="340" height="10" fill="#FEF2F2" />
    <text x="16" y="28" class="zone-title" fill="#991B1B">5. IA &amp; SERVICIOS EXTERNOS</text>
    <text x="16" y="60" class="zone-desc">Modelos de lenguaje, transcripción y cotizaciones</text>

    <!-- Card 5.1: Speech-to-Text (ASR) -->
    <g transform="translate(15, 80)">
      <rect width="310" height="230" rx="12" fill="#FFFFFF" stroke="#FECACA" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="230" rx="3" fill="#EF4444" />
      <text x="18" y="28" class="card-title">Reconocimiento de Voz (ASR)</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="274" height="48" rx="8" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#B91C1C">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="74" class="card-used-val" fill="#7F1D1D">Meta Muse ASR (Speech-to-Text)</text>

      <!-- Alternatives -->
      <rect x="18" y="98" width="274" height="40" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="113" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="127" class="card-alt-val">OpenAI Whisper, Deepgram, Google Speech-to-Text</text>

      <text x="18" y="156" class="card-body">• Transcripción de audios de WhatsApp y de la App.</text>
      <text x="18" y="174" class="card-body">• Soporte multilenguaje (español, inglés, portugués).</text>
      <text x="18" y="192" class="card-body">• Normalización a WAV 16kHz mono para alta precisión.</text>
      <text x="18" y="210" class="card-body">• Latencia ultra-baja en edge.</text>
    </g>

    <!-- Card 5.2: LLM & Vision -->
    <g transform="translate(15, 330)">
      <rect width="310" height="250" rx="12" fill="#FFFFFF" stroke="#FECACA" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="250" rx="3" fill="#DC2626" />
      <text x="18" y="28" class="card-title">Modelos LLM &amp; Visión</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="274" height="60" rx="8" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#B91C1C">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="74" class="card-used-val" fill="#7F1D1D">Meta Muse Spark 1.3 / Llama 3</text>
      <text x="26" y="90" class="card-body" font-size="10" fill="#B91C1C">(Con fallback resiliente a Groq Llama 3.3)</text>

      <!-- Alternatives -->
      <rect x="18" y="110" width="274" height="42" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="125" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="140" class="card-alt-val">OpenAI GPT-4o, Anthropic Claude 3.5, Gemini 1.5</text>

      <text x="18" y="170" class="card-body">• Extracción JSON de montos, categoría y fecha.</text>
      <text x="18" y="188" class="card-body">• OCR multimodal en fotos de recibos.</text>
      <text x="18" y="206" class="card-body">• Clasificación presupuestaria inteligente.</text>
      <text x="18" y="224" class="card-body">• Agente conversacional de finanzas en n8n.</text>
      <text x="18" y="242" class="card-body">• Inferencia acelerada con Groq si Meta satura.</text>
    </g>

    <!-- Card 5.3: Market Data API -->
    <g transform="translate(15, 600)">
      <rect width="310" height="210" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="210" rx="3" fill="#D97706" />
      <text x="18" y="28" class="card-title">Datos de Mercado Financiero</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="274" height="48" rx="8" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#B45309">HERRAMIENTA UTILIZADA:</text>
      <text x="26" y="74" class="card-used-val" fill="#92400E">Twelve Data Real-Time API</text>

      <!-- Alternatives -->
      <rect x="18" y="98" width="274" height="40" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="113" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="127" class="card-alt-val">AlphaVantage, Yahoo Finance API, Polygon.io</text>

      <text x="18" y="156" class="card-body">• Cotizaciones de acciones (AAPL, MSFT, TSLA).</text>
      <text x="18" y="174" class="card-body">• Precios de criptomonedas (BTC, ETH, SOL).</text>
      <text x="18" y="192" class="card-body">• Tasas de cambio de divisas (USD/BOB, EUR/USD).</text>
    </g>

    <!-- Card 5.4: Cloud Messaging Providers -->
    <g transform="translate(15, 830)">
      <rect width="310" height="220" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#cardShadow)" />
      <rect x="0" y="0" width="6" height="220" rx="3" fill="#25D366" />
      <text x="18" y="28" class="card-title">Servidores de Mensajería</text>
      
      <!-- Used Badge -->
      <rect x="18" y="42" width="274" height="48" rx="8" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1" />
      <text x="26" y="58" class="card-used-label" fill="#15803D">SERVICIOS UTILIZADOS:</text>
      <text x="26" y="74" class="card-used-val" fill="#14532D">Meta Cloud API + Telegram Bot API</text>

      <!-- Alternatives -->
      <rect x="18" y="98" width="274" height="40" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="26" y="113" class="card-alt-label">ALTERNATIVAS:</text>
      <text x="26" y="127" class="card-alt-val">Twilio WhatsApp, MessageBird, Infobip</text>

      <text x="18" y="156" class="card-body">• Infraestructura oficial de WhatsApp en la nube.</text>
      <text x="18" y="174" class="card-body">• Descarga de media temporal firmada (audio/imágenes).</text>
      <text x="18" y="192" class="card-body">• Envío de plantillas y mensajes bidireccionales.</text>
      <text x="18" y="210" class="card-body">• Notificaciones instantáneas al usuario.</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- DIRECTIONAL ARROWS & CONNECTIONS                                          -->
  <!-- ========================================================================= -->
  <!-- 1. Frontends (Web/Mobile) to API Gateway -->
  <path d="M 360 280 L 398 280" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrowBlue)" />
  <path d="M 360 450 L 398 320" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrowBlue)" />

  <!-- 2. Messaging Channels to Webhook Gateway (n8n Webhook) -->
  <path d="M 360 720 L 398 640" fill="none" stroke="#D97706" stroke-width="2.5" marker-end="url(#arrowAmber)" />

  <!-- 3. Gateway to PostgREST & Edge Functions -->
  <path d="M 670 290 L 708 290" fill="none" stroke="#0284C7" stroke-width="2.5" marker-end="url(#arrowBlue)" />
  <path d="M 670 330 L 708 550" fill="none" stroke="#059669" stroke-width="2.5" marker-end="url(#arrow)" />

  <!-- 4. Webhook Ingress to n8n Automation Engine -->
  <path d="M 670 600 L 708 300" fill="none" stroke="#D97706" stroke-width="2.5" marker-end="url(#arrowAmber)" />

  <!-- 5. Edge Functions / PostgREST to Database -->
  <path d="M 1180 570 L 1208 400" fill="none" stroke="#16A34A" stroke-width="3" marker-end="url(#arrow)" />
  <path d="M 1180 620 L 1208 720" fill="none" stroke="#0EA5E9" stroke-width="2.5" marker-end="url(#arrowBlue)" />

  <!-- 6. n8n to Database (Direct SQL / RPC calls) -->
  <path d="M 1180 320 L 1208 350" fill="none" stroke="#7C3AED" stroke-width="2.5" marker-end="url(#arrowPurple)" />

  <!-- 7. n8n / Edge Functions to External AI & Market Services -->
  <path d="M 1180 250 C 1350 210, 1420 230, 1578 230" fill="none" stroke="#EF4444" stroke-width="2.5" marker-end="url(#arrow)" />
  <path d="M 1180 340 C 1350 360, 1420 400, 1578 400" fill="none" stroke="#DC2626" stroke-width="2.5" marker-end="url(#arrow)" />
  <path d="M 1180 680 C 1350 700, 1420 710, 1578 710" fill="none" stroke="#D97706" stroke-width="2.5" marker-end="url(#arrowAmber)" />

  <!-- 8. External Messaging Providers to Webhooks -->
  <path d="M 1578 950 C 1200 1180, 550 1180, 420 715" fill="none" stroke="#25D366" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arrow)" />
  <text x="880" y="1170" class="flow-label" fill="#15803D" text-anchor="middle">Meta Cloud Webhooks &amp; Telegram Updates → Recepción HTTPS en n8n</text>

  <!-- 9. MCP Communication (Client to Server) -->
  <path d="M 360 970 C 500 1020, 600 1020, 708 970" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="4,4" marker-end="url(#arrowPurple)" />
  <text x="535" y="1035" class="flow-label" fill="#7C3AED" text-anchor="middle">Protocolo MCP (SSE / JSON-RPC)</text>

</svg>
`;

const svgPath = resolve(process.cwd(), 'docs/architecture-overview.svg');
const pngPath = resolve(process.cwd(), 'docs/architecture-overview.png');

writeFileSync(svgPath, svg, 'utf-8');
console.log('Saved SVG to:', svgPath);

// Convert to high-resolution PNG using rsvg-convert (2x scale for Retina sharpness)
try {
  execSync('rsvg-convert -z 2 "' + svgPath + '" -o "' + pngPath + '"');
  console.log('Successfully generated high-res PNG at:', pngPath);
} catch (err) {
  console.error('Failed to convert SVG to PNG with rsvg-convert:', err);
  // Fallback without zoom
  execSync('rsvg-convert "' + svgPath + '" -o "' + pngPath + '"');
  console.log('Generated standard PNG at:', pngPath);
}
