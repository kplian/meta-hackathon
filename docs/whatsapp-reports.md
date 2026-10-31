# Reportes por WhatsApp (botón "Ver reporte")

El bot manda un mensaje con un botón que abre el reporte del mes dentro del navegador de WhatsApp. No hay login: el enlace lleva un token que vence (30 min por defecto) y la URL no contiene datos personales.

```text
Usuario: "mostrame mis gastos"
  → n8n: RPC f_create_report_link (service role)  → { token, expires_at }
  → n8n: WhatsApp interactive cta_url  →  https://<web-app>/reporte?t=<token>&lang=es
  → Usuario toca "Ver reporte" → la web llama f_get_report(token) con la anon key
```

## Base de datos

Migración `supabase/migrations/20261031150000_report_links.sql`:

| Función | Quién la llama | Qué hace |
| :--- | :--- | :--- |
| `f_create_report_link(p_household_id, p_month?, p_ttl_minutes?, p_user_id?)` | Solo `service_role` (n8n) | Crea el token. `p_month` = cualquier día del mes (por defecto el actual), `p_ttl_minutes` 1–1440 (por defecto 30). |
| `f_get_report(p_token)` | `anon` (la página web) | Devuelve `{status: 'ok', household, totals, categories, transactions}` o `{status: 'invalid' \| 'expired'}`. |

La tabla `budget.treport_link` no es accesible con la anon key; solo a través de esas funciones.

## n8n

**1. Crear el token** — nodo HTTP Request:

- `POST {{SUPABASE_URL}}/rest/v1/rpc/f_create_report_link`
- Headers: `apikey` y `Authorization: Bearer` con la **service role key** (guardarla como credencial de n8n, nunca en el JSON del workflow).
- Body: `{ "p_household_id": "<id del hogar>", "p_ttl_minutes": 30 }`

**2. Mandar el botón** — nodo HTTP Request a `POST https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages`:

```json
{
  "messaging_product": "whatsapp",
  "to": "591XXXXXXXX",
  "type": "interactive",
  "interactive": {
    "type": "cta_url",
    "header": { "type": "text", "text": "Reporte del mes" },
    "body": { "text": "Este mes gastaste Bs 4.250. Tocá abajo para ver el detalle." },
    "action": {
      "name": "cta_url",
      "parameters": {
        "display_text": "Ver reporte",
        "url": "https://<web-app>/reporte?t={{$json.token}}&lang=es"
      }
    }
  }
}
```

- `display_text`: máximo 20 caracteres.
- Solo dentro de la ventana de 24 h desde el último mensaje del usuario. Fuera de esa ventana hay que usar una plantilla aprobada con botón de URL.
- `lang` es opcional (`es`, `en`, `pt`).

## Web

- Ruta `/reporte?t=<token>` en `apps/mobile` (solo web): `src/screens/ReportScreen.tsx`, datos en `src/lib/report.ts`.
- La web tiene que estar publicada (por ejemplo `npx expo export --platform web` en Vercel/Netlify) con fallback de SPA para que `/reporte` sirva `index.html`. `localhost` no abre desde el celular.

Probar en local:

```bash
curl -s -X POST http://127.0.0.1:54321/rest/v1/rpc/f_create_report_link \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"p_household_id":"22222222-2222-4222-8222-222222222201"}'
# abrir http://localhost:8090/reporte?t=<token>
```
