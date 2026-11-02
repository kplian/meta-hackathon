# Salud, menú semanal y actividades

Cada integrante del hogar tiene un perfil de salud: alergias, tipo de alimentación, condiciones, peso, talla, gustos, actividad física, deportes y objetivo. Con eso y lo que queda del presupuesto de supermercado, un modelo Llama arma un menú semanal, la lista de compras con costos y 2 o 3 actividades. Se usa desde la app (menú lateral → **Salud y menú**), en el onboarding si el hogar acepta salud, y desde WhatsApp (tools de n8n).

## Piezas

| Pieza | Qué hace |
| :--- | :--- |
| `supabase/migrations/20261031340000_health_meal_plans.sql` | Tablas `budget.tmember_health_profile` y `budget.tmeal_plan`, y las RPC de abajo |
| `supabase/migrations/20261031350000_health_catalog.sql` | Catálogo `budget.thealth_option`: kinds, etiquetas es/en/pt y keywords del guard |
| `supabase/migrations/20261031351000_health_profile_catalog_guard.sql` | `conditions`, `weight_kg`, `height_cm`, mapeo de texto libre a códigos y guard de palabra completa |
| `supabase/migrations/20261031360000_household_preferences_food_budget.sql` | Preferencia `health_opt_in`, sugerencia del 40 % de necesidades y límite mensual de supermercado |
| `supabase/functions/meal-plan` | Edge Function: lee el contexto, llama a Llama, revisa alergias y presupuesto, guarda el plan |
| `supabase/functions/_shared/meal-plan.ts` | Prompt, parseo y validaciones (testeado en `tests/meal-plan.test.mjs`) |
| `apps/mobile/src/features/health/` | Pantalla de la app (perfiles + menú), editor `MemberProfileCard.tsx`, textos en es/en/pt |
| `apps/mobile/src/features/onboarding/HealthStep.tsx`, `MealPlanStep.tsx` | Perfiles opcionales en el onboarding y primer menú semanal |

### Catálogo (`budget.thealth_option`)

| Kind | Qué guarda |
| :--- | :--- |
| `allergen` | Alérgenos. Todos son `hard` |
| `diet` | Dieta. `gluten_free` implica el alérgeno `gluten` |
| `condition` | Condiciones. `celiac` implica `gluten`. `pregnancy` y `kidney_disease` son `hard` |
| `activity` | Deportes y actividades |
| `goal` | Objetivo, los mismos códigos que `health_goal` |
| `activity_level` | `low`, `moderate`, `high` |

Las etiquetas viven en la fila (`labels` con `es`, `en` y `pt`). La app, el prompt y el agente las leen de la base.

Para agregar una opción: una fila con `kind`, `code` (`^[a-z][a-z0-9_]*$`), `icon`, `sort_order` y `labels` en los tres idiomas. `keywords` y `exclusions` se guardan ya normalizados con `budget.f_norm_text` (minúsculas, sin acentos, solo letras, números y espacios). `hard` impide que esas keywords aparezcan en un plan del hogar. `implies_allergen` apunta a un código de alérgeno. `prompt_rule`, si va, es la instrucción en inglés para el planificador.

### RPC (todas en `public`)

| Función | Quién | Para qué |
| :--- | :--- | :--- |
| `f_get_family_health_context(p_household_id)` | miembro del hogar o service role | Integrantes con perfil, presupuesto de supermercado (`food`), salidas (`eating_out`), farmacia (`health`), último plan y `rules` |
| `f_upsert_member_health_profile(p_member_id, p_profile)` | admin del hogar o service role | Crea o actualiza el perfil. Solo cambia las claves enviadas |
| `f_save_meal_plan(p_household_id, p_week_start, p_plan, p_budget, …)` | miembro o service role | Guarda el plan. Reemplaza el de la misma semana |
| `f_get_meal_plan(p_household_id, p_week_start?)` | miembro o service role | Plan activo de esa semana (o el último) |
| `f_set_household_preference(p_household_id, p_key, p_value)` | admin del hogar o service role | Fusiona una clave en `thousehold.preferences` sin pisar el resto. El onboarding guarda `health_opt_in` |
| `f_food_budget_suggestion(p_household_id, p_share?)` | miembro del hogar o service role | Sugiere el límite mensual de supermercado: ingreso estimado × % de necesidades × share (40 % si no se pasa) |
| `f_set_food_budget(p_household_id, p_monthly_limit)` | admin del hogar o service role | Guarda ese límite en `tbudget` (`supermarket_groceries`) y devuelve el estado de la categoría |

`p_profile` acepta: `birth_year`, `allergies[]`, `diet[]`, `likes[]`, `dislikes[]`, `activity_level` (`low`, `moderate`, `high`), `activities[]`, `health_goal` (`maintain`, `eat_healthier`, `lose_weight`, `gain_muscle`, `more_energy`), `notes`, `conditions[]`, `weight_kg` (2 a 400) y `height_cm` (40 a 250). En `allergies`, `diet`, `conditions` y `activities` vale un código del catálogo o texto libre. Si el texto coincide con una etiqueta (es, en o pt) o con una keyword, se guarda el código; si no, queda el texto.

`rules`, dentro de `f_get_family_health_context`, trae `forbidden` (código, keywords y exclusions), `prompt_rules` (la instrucción y los integrantes) y `labels` (etiquetas de cada código en uso).

### Reglas que se garantizan

- **Guard**: palabra completa (plural opcional `s`/`es`) sobre texto normalizado: minúsculas y sin acentos. Antes se quitan las frases de `exclusions`, así «leche de avena» no cuenta como leche ni como gluten. Celiaquía (`celiac`) y sin gluten (`gluten_free`) implican el alérgeno `gluten`. Embarazo (`pregnancy`) y enfermedad renal (`kidney_disease`) son duras: sus keywords tampoco pueden aparecer. La función pide una corrección si el menú nombra algo prohibido. Si sigue, no guarda nada (`allergen_conflict`). `f_save_meal_plan` aplica el mismo guard.
- **Presupuesto**: el costo es la suma de la lista de compras. Si pasa el presupuesto en más de 5 %, se reintenta una vez. Si igual lo pasa, se guarda y se marca `within_budget: false` (no se oculta).
- **Presupuesto sugerido**: lo que queda del límite mensual de `supermarket_groceries` dividido por las semanas que faltan del mes. Si no hay límite, el usuario indica el monto. En el onboarding, `f_food_budget_suggestion` propone el 40 % del nivel de necesidades y `f_set_food_budget` lo guarda como ese límite mensual.

## Modelo (Llama)

La Edge Function usa el formato OpenAI chat-completions. Se elige por variables del backend (`.env` de la raíz en local, secrets en Supabase cloud):

| Variable | Proveedor |
| :--- | :--- |
| `LLAMA_API_KEY` | Meta Llama API, modelo `Llama-4-Maverick-17B-128E-Instruct-FP8` |
| `GROQ_API_KEY` | Groq, modelo `meta-llama/llama-4-scout-17b-16e-instruct` (si no hay la de Meta) |
| `LLM_API_KEY` + `LLM_API_URL` + `LLM_MODEL` | Cualquier endpoint compatible |

`LLM_MODEL` cambia el modelo de cualquiera de los proveedores. Sin key, la función responde `llm_not_configured` y la app lo explica.

Local:

```sh
npx supabase functions serve --env-file .env
```

Cloud:

```sh
npx supabase secrets set LLAMA_API_KEY=... --project-ref ywibmualqaipmygmrojz
npx supabase functions deploy meal-plan --project-ref ywibmualqaipmygmrojz
```

## n8n: tools para el agente de WhatsApp

Todas con la credencial **"Supabase account"** (service role), no la key escrita en el nodo. Base: `https://ywibmualqaipmygmrojz.supabase.co`.

El agente puede mandar texto libre; la base lo mapea a códigos; `rules.labels` trae las etiquetas para responder al usuario. El texto de las tools de abajo está al día; el flujo vivo de n8n se toca solo con OK de Rodrigo.

1. **`get_family_health`** (HTTP Request Tool): `POST /rest/v1/rpc/f_get_family_health_context`
   ```
   { "p_household_id": "{{ $fromAI('household_id', 'ID del hogar, de get_user_households') }}" }
   ```
   Descripción: *Integrantes del hogar con alergias, dieta, gustos, actividad física y presupuesto de supermercado, más `rules` (`forbidden`, `prompt_rules`, `labels`). Úsala antes de hablar de comidas, salud o actividades, y para obtener el member_id de cada integrante. Responde al usuario con `rules.labels` en su idioma.*

2. **`update_health_profile`**: `POST /rest/v1/rpc/f_upsert_member_health_profile`
   ```
   {
     "p_member_id": "{{ $fromAI('member_id', 'member_id del integrante, de get_family_health') }}",
     "p_profile": {{ $fromAI('profile', 'JSON solo con lo que cambia: allergies[], diet[], conditions[], likes[], dislikes[], activity_level, activities[], health_goal, birth_year, weight_kg, height_cm, notes. En allergies, diet, conditions y activities vale un código del catálogo o texto libre', 'json') }}
   }
   ```
   Descripción: *Guarda lo que el usuario cuenta de un integrante: "Lucas es alérgico al maní", "Ana juega vóley", "queremos comer más sano". Incluye `conditions`, `weight_kg` y `height_cm`. En `allergies`, `diet`, `conditions` y `activities` vale un código del catálogo o texto libre.*

3. **`generate_meal_plan`**: `POST /functions/v1/meal-plan`
   ```
   {
     "action": "generate",
     "householdId": "{{ $fromAI('household_id') }}",
     "request": "{{ $fromAI('request', 'Pedido del usuario: menos carne, cenas rápidas, etc. Vacío si no hay', 'string') }}",
     "language": "es"
   }
   ```
   Opcional: `"budget": <número>` si el usuario dice cuánto quiere gastar. Timeout del nodo: 90 s.
   Descripción: *Arma el menú semanal, la lista de compras y actividades dentro del presupuesto. Tarda unos segundos.*

4. **`get_meal_plan`**: `POST /rest/v1/rpc/f_get_meal_plan` con `{ "p_household_id": "…" }`. Para "¿qué cocino hoy?" o "pasame la lista de compras".

Agregar al **system prompt**:

> Salud y comidas: cuando el usuario cuente algo de la salud, gustos o deportes de un integrante, guárdalo con update_health_profile (primero get_family_health para el member_id) y confirma en una línea. Cuando pida un menú o ideas de comida, usa generate_meal_plan. Por WhatsApp no mandes la semana entera: responde con el resumen, el costo frente al presupuesto, las comidas de hoy y una actividad, y ofrece la lista de compras o los otros días. Nunca sugieras algo con un alérgeno de la familia. No des diagnósticos médicos.

## Pruebas

```sh
npm run test:health                                   # lógica del prompt, parseo, alergias, presupuesto
psql "$DATABASE_URL" -f tests/health-meal-plans.sql   # RPC, permisos y guardas (hace rollback)
psql "$DATABASE_URL" -f tests/onboarding-health.sql   # health_opt_in, sugerencia y límite de comida (hace rollback)
```
