# Diario común y valoraciones patrimoniales

## Modelo

`budget.ttransaction` es la cabecera del asiento y `budget.ttransaction_detail` contiene sus líneas. Todos los nuevos activos usan este diario. La tabla provisional `tasset_entry` fue eliminada después de verificar la migración de sus asientos al diario común.

Cada asiento tiene `currency` y `ledger_book`: `operating` usa la moneda del hogar al registrar la operación; `patrimony` exige USD. `debit_base` y `credit_base` están expresados en la moneda de su cabecera. No hay conversión implícita ni total consolidado entre monedas. Una futura operación que conecte dinero local con inversiones USD necesitará una tasa y un diseño explícito de conversión; no está implementada aquí.

El plan existente tiene una rama USD con grupos no imputables (`PATR-ASSETS`, `PATR-INVESTMENTS`, `PATR-PHYSICAL`, `PATR-EQUITY`) y cuentas imputables por tipo. `tasset_type.account_code` identifica la cuenta de cada categoría. Las inversiones de mercado usan auxiliares `investment`; los demás bienes usan `asset`. Cada registro conserva su auxiliar individual. No se implementan todavía agrupación de posiciones por broker, lotes de compras ni ventas.

`vaccount_balance` agrupa por hogar, libro, moneda, cuenta y auxiliar. Su `debit_balance` es debe menos haber; en cuentas de naturaleza acreedora debe interpretarse con el signo correspondiente.

## Alta inicial

`public.f_register_household_asset` mantiene la firma usada por el onboarding. Crea la posición, su auxiliar y un asiento de apertura:

- Débito: cuenta de activo, USD cantidad × valor inicial por unidad.
- Crédito: `PATR-OPENING`, por el mismo importe.

`tasset_position.opening_transaction_id` vincula al asiento. La operación es atómica e idempotente por `request_id`. El valor inicial queda inalterado. `price_basis` distingue precio de compra conocido, estimación de mercado y estimación del usuario: una estimación de apertura **no es un costo histórico demostrado**. La fecha contable es la del alta; no se reconstruye una compra histórica.

La migración copia las aperturas anteriores, conserva posiciones, aliases y auxiliares, y conserva anuladas las aperturas inactivas. No hay doble contabilización.

## Actualizar valores

`budget.tasset_valuation` conserva observaciones inmutables desde el cliente: posición, cantidad de referencia, precio unitario USD, total USD, fecha efectiva, fecha de registro, fuente, método, notas y autor. Puede registrar cero; no admite valores negativos o no finitos. Una valoración atrasada se guarda para el historial y no reemplaza la más reciente.

`budget.vasset_current_value` expone:

- `opening_value_usd`: valor inicial declarado.
- `current_value_usd`: última valoración por fecha efectiva.
- `valuation_as_of`, `valuation_source`, `valuation_method`: antigüedad y procedencia.
- `carrying_value_usd`: saldo contable en el diario común.
- `change_since_opening_usd`: diferencia respecto de la apertura; no se presenta como ganancia realizada ni rentabilidad histórica.

### Acciones, ETFs y criptomonedas

La Edge Function `asset-market` acepta `{ "action": "refresh", "positionId": "UUID" }` con sesión autenticada. Obtiene el símbolo y la bolsa de la posición guardada, valida que el usuario sea administrador y consulta Twelve Data `quote` exclusivamente en USD. Guarda la fecha del proveedor, que puede corresponder a un cierre o una cotización retrasada; no asegura tiempo real. Las fallas conservan la última valoración y su fecha, sin inventar precios.

Solo el backend con `service_role` puede invocar `f_record_market_asset_valuation`: el cliente no puede atribuir una estimación manual a Twelve Data. Los reintentos con la misma posición, fuente y fecha de cotización reutilizan la observación existente.

Proceso ejecutable, sin programación automática ni dependencia de n8n local:

```sh
npm run market:serve
npm run assets:refresh -- --household UUID
# O una sola posición:
npm run assets:refresh -- --position UUID
```

El proceso usa `ASSET_REFRESH_ACCESS_TOKEN` o `ASSET_REFRESH_EMAIL` / `ASSET_REFRESH_PASSWORD`; en localhost puede usar el acceso demo configurado en `apps/mobile/.env`. No imprime claves. Recorre posiciones activas de mercado, conserva las anteriores si hay errores y deja un estado por posición. El límite del plan de Twelve Data puede exigir espaciar más las consultas. No hay cron activado; se puede conectar este proceso a un job después de decidir frecuencia y presupuesto de API.

### Casas, vehículos, terrenos y otros bienes

Usar `public.f_record_manual_asset_valuation` con `p_position_id`, `p_unit_price_usd`, `p_valued_at`, `p_request_id`, `p_notes` y `p_method` (`owner_estimate` o `appraisal`). La nota es obligatoria para explicar la estimación o identificar la tasación. Para una casa con cantidad 1, el precio unitario es su valor total en USD. No se aplica automáticamente depreciación al vehículo ni una subida al inmueble.

Ejemplo: una casa declarada en USD100.000 recibe una tasación de USD110.000. El historial contiene ambas observaciones; el valor inicial sigue en USD100.000 y el valor actual pasa a USD110.000. El saldo contable permanece en USD100.000 hasta que se decida contabilizar el ajuste.

## Contabilizar una actualización es una acción separada

`public.f_post_asset_valuation(p_valuation_id)` permite al administrador contabilizar explícitamente la valoración más reciente, posterior a los asientos previos. Es idempotente y calcula la diferencia contra el saldo contable, **no** contra el último precio consultado.

- Aumento: débito al activo y crédito a `PATR-REVALUATION`.
- Disminución: débito a `PATR-REVALUATION` y crédito al activo.
- Sin diferencia: registra la decisión sin asiento de importe cero.

Esta es una política de **valoración patrimonial de gestión del hogar**, con contrapartida en patrimonio; no una afirmación de cumplimiento NIIF o fiscal. No se aplica automáticamente como política universal de deterioro, depreciación o instrumentos financieros. Las cotizaciones y tasaciones se pueden usar solo en reportes sin contabilizarlas.

La actualización de precios nunca llama esta función automáticamente y nunca modifica ingresos, gastos ni efectivo.

## Correcciones e integridad

El retiro de un registro erróneo mediante `f_remove_household_asset` crea reversos de apertura y ajustes contabilizados, conservando los originales; no representa una venta. La posición se inactiva y deja de aparecer en la vista actual.

Las líneas patrimoniales contabilizadas no se editan ni eliminan. Las nuevas operaciones se validan al terminar la transacción: debe=haber, al menos dos líneas, moneda consistente y cuentas/auxiliares del mismo hogar. Los clientes solo leen el diario; registran mediante RPCs. El diario diario filtra `operating` e `income`/`expense` para no contar aperturas, transferencias o valoraciones como gasto.

Las transacciones anteriores a la ampliación conservan `ledger_version=0`: no se reescriben ni se presume que su moneda histórica estuviera verificada. Las nuevas usan versión 1. Cambiar la moneda inicial actualiza las cuentas operativas; una vez que existen operaciones diarias, requiere una migración de moneda explícita. Se revisan también las fuentes de ingreso existentes antes de permitir el cambio.

## Validación

- `npm run test:market`: búsqueda, cotizaciones y actualización backend con proveedor simulado.
- `deno check supabase/functions/asset-market/index.ts`.
- `npm run mobile:typecheck`.
- `tests/assets-ledger.sql`: pruebas SQL reversibles del diario, valoraciones, ajustes, reversos, permisos y monedas BOB/BRL/CNY.

No se implementan en esta entrega pantallas de gestión posterior al onboarding, cron de precios, conversión cambiaria, depreciación automática, compras/ventas ni cálculo de ganancias realizadas.

## Moneda original y preferencias de rendimientos

El onboarding admite cuentas de ahorro (`savings`), depósitos a plazo (`term_deposit`), dinero disponible (`cash`) y otras inversiones monetarias (`monetary_investment`). Todos usan la misma apertura contable en USD.

- `quantity` conserva el saldo o las unidades originales: 5000 BOB o 5 SOL.
- `unit_kind` / `unit_code` identifican moneda, cripto, título o unidad física.
- `reference_unit_price_usd` es el valor inicial en USD de **una** unidad original. Para BOB se introduce USD por BOB, no BOB por USD.
- `initial_rate_source` / `initial_rate_as_of` conservan la procedencia declarada y la fecha de la conversión. El formulario permite conversión manual o consultar Twelve Data desde el backend mediante `asset-market`, acción `fx`. Se consulta el par moneda original/USD y se conserva la fecha del proveedor. Un saldo USD exige factor 1.
- `institution` y `maturity_date` permiten identificar el banco/plataforma y el vencimiento opcional.

`tasset_yield_settings` guarda si una posición genera intereses, recompensas o ambos. No se presupone que todo depósito pague intereses. La preferencia mensual es opcional y conserva día 1–31, zona horaria IANA, fecha de inicio y el miembro responsable que la activó. Solo administradores del hogar pueden configurarla; al desactivarla se eliminan los campos de recordatorio.

Se configura durante el alta mediante `p_yield_settings` o después con `f_configure_asset_yield`. Ejemplo de preferencias: `{"enabled":true,"yield_kind":"rewards","reminder_enabled":true,"reminder_day":15,"timezone":"America/La_Paz"}`. Cambiar estas preferencias no modifica cantidades, valoraciones ni asientos.

El futuro servicio de alertas deberá respetar la zona horaria, ajustar días 29–31 al último día del mes, verificar posición y destinatario activos, reconocer los meses ya reportados y deduplicar envíos. Los reportes mensuales y el historial de entregas se implementarán con ese proceso; no se han añadido trabajos programados ni canales de notificación. Tampoco se calculan o acreditan intereses/recompensas: el futuro registro de rendimientos deberá distinguir reinversión y cobro separado, y actualizar cantidades mediante movimientos auditables, conservando la apertura original.

Prueba adicional reversible: `tests/asset-units-yields.sql` verifica monedas BOB/BRL/CNY/EUR, SOL, depósitos USD, procedencia del cambio, preferencias, permisos, reintentos y ausencia de movimientos automáticos.

La consulta inicial de cambio valida moneda, sentido del par, tasa positiva y fecha. El botón online conserva `initial_rate_source=twelve_data` y `initial_rate_as_of`; al editar el importe se vuelve a procedencia manual. USD usa factor 1 sin consultar al proveedor. La referencia puede diferir de la tasa de conversión ofrecida por un banco y no se presenta como una operación de cambio ejecutada. No se agregan actualizaciones periódicas de monedas en este flujo.
