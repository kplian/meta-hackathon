# Guía de Conexión de Bots (WhatsApp y Telegram)

## 1. Conexión con Telegram (La más rápida para prototipar en Hackathons)

1. Abre Telegram y busca al usuario `@BotFather`.
2. Envía el comando `/newbot`.
3. Dale un nombre (ej: `Presupuesto Familiar Bot`) y un username (ej: `family_budget_hackathon_bot`).
4. Guarda el **Token HTTP API** entregado por BotFather.
5. Coloca el token en tu `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
   ```
6. En n8n:
   - Ve a **Credentials** > **Telegram API**.
   - Pega tu `Access Token`.
   - ¡Listo! El nodo `Telegram Trigger` comenzará a escuchar los mensajes de inmediato.

---

## 2. Conexión con WhatsApp (Meta Cloud API)

1. Ingresa a [Meta for Developers](https://developers.facebook.com/).
2. Crea una App de tipo **Business** y agrega el producto **WhatsApp**.
3. En la sección **API Setup (Configuración de la API)** obtendrás:
   - **Phone number ID**
   - **WhatsApp Business Account ID**
   - **Temporary access token** (o genera un token de sistema permanente en Business Manager).
4. Configura el **Webhook** en Meta Developers:
   - **Callback URL**: Tu URL pública de n8n (ej: `https://tu-ngrok.ngrok-free.app/webhook/meta-whatsapp-webhook`).
   - **Verify Token**: El token secreto que definas (ej: `your_webhook_verify_token`).
   - Suscríbete al campo `messages`.
5. En n8n:
   - Configura un nodo `Webhook` con método `GET` para la verificación inicial de Meta (`hub.challenge`), y `POST` para recibir los mensajes entrantes.
   - Para enviar mensajes de vuelta, usa el nodo `HTTP Request` apuntando a:
     `POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages`
