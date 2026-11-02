# Diario común y valoraciones patrimoniales

## Modelo

`budget.ttransaction` es la cabecera del asiento y `budget.ttransaction_detail` contiene sus líneas. Todos los nuevos activos usan este diario. La tabla provisional `tasset_entry` fue eliminada después de verificar la migración de sus asientos al diario común.

Cada asiento tiene `currency` y `ledger_book`: `operating` usa la moneda del hogar al registrar la operación; `patrimony` exige USD. `debit_base` y `credit_base` están expresados en la moneda de su cabecera. No hay conversión implícita ni total consolidado entre monedas. Los movimientos que conectan dinero local con inversiones USD usan una tasa explícita y dos asientos vinculados; ver «Administración de ahorros e inversiones».

El plan existente tiene una rama USD con grupos no imputables (`PATR-ASSETS`, `PATR-INVESTMENTS`, `PATR-PHYSICAL`, `PATR-EQUITY`) y cuentas imputables por tipo. `tasset_type.account_code` identifica la cuenta de cada categoría. Las inversiones de mercado usan auxiliares `investment`; los demás bienes usan `asset`. Cada registro conserva su auxiliar individual. Una posición identifica una tenencia o ubicación; no se implementan lotes fiscales ni agrupaciones automáticas por broker.

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

No se implementan cron de precios, depreciación automática, ejecución en brokers ni lotes fiscales. La administración posterior al onboarding y sus movimientos se describen abajo.

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

## Unidades explícitas y cotizaciones compartidas

Migración `20261101010000_asset_units_and_shared_quotes.sql`:
- `ttransaction_detail.asset_position_id` enlaza la posición; `asset_quantity_delta NUMERIC(30,12)` registra entradas/salidas firmadas de unidades originales. `quantity` mantiene su significado genérico. Aperturas y reversos históricos se enriquecen sin modificar importes USD; revalorizaciones llevan cero unidades. `vasset_quantity_balance` suma movimientos activos.
- `tasset_quote` mantiene la última cotización USD por clase de instrumento, símbolo y mercado, compartida entre hogares. `tasset_position.instrument_quote_id` enlaza esa identidad. Cripto y divisas no se separan por plataforma de custodia; las acciones/ETF mantienen su mercado. El precio tiene fecha y fuente; los registros sin precio verificado quedan pendientes. Solo `service_role` publica precios mediante `f_upsert_asset_quote`. Los clientes autenticados tienen únicamente lectura.
- Al guardar un activo cotizado o monetario desde el onboarding, `asset-market` obtiene y publica la cotización actual con `sync_quote` antes del alta contable. El costo ingresado por el usuario permanece en la apertura y nunca se publica como precio actual compartido. Si falla el proveedor o el guardado del precio, no se crea el activo. El usuario puede reintentar con el mismo request ID. Las cotizaciones son datos independientes: pueden haberse refrescado aun si una validación posterior del alta falla.
- Casas, autos y otros bienes individuales conservan sus valoraciones por posición; no publican precios compartidos entre hogares.
- Este cambio no agrega compras/ventas posteriores, lotes ni job periódico. La adaptación del dashboard se completa en la migración `20261101020000`. Las operaciones futuras deberán guardar movimientos explícitos y controlar disponibilidad de unidades.

Despliegue: aplicar la migración y desplegar `asset-market` junto con sus módulos compartidos. En cloud ambos cambios deben desplegarse antes del frontend actualizado.

## Reporte por unidades actuales

`20261101020000_wealth_current_units_and_quotes.sql` actualiza `f_household_wealth_report`: suma unidades activas de la posición y las multiplica por la cotización compartida USD. Usa valoración individual o referencia inicial si no hay cotización, exponiendo origen y fecha. No vuelve a añadir los importes de movimientos que ya tienen unidades explícitas. Para movimientos antiguos sin unidades, conserva su neto USD como componente separado y marca `has_untracked_movements`; no inventa unidades para esos importes. El dashboard identifica esas referencias y cantidades, y conserva el historial de ahorro al final. No modifica asientos ni programa un job.


## Administración de ahorros e inversiones

Migración `20261101030000_investment_movements.sql` y frontend en `apps/mobile/src/features/investments/`.

- `f_investment_overview` consulta el saldo operativo acumulado (cuentas 110/111/112 en la moneda del hogar), el patrimonio actual y los últimos 30 movimientos. Incluye el mes actual, entradas/salidas reales, préstamos, aperturas y transferencias; no es una suma de ingresos estimados ni una medida de rentabilidad. Reconoce los movimientos antiguos en cuentas globales equivalentes para evitar perderlos al clonar el plan del hogar. No suma efectivo operativo a USD sin una conversión.
- `f_move_investment` registra atómicamente compras/aportes, ventas/retiros y transferencias. Origen y destino son cuentas operativas del hogar o posiciones; también se puede comprar una posición nueva. Requiere administrador del hogar, serializa movimientos por hogar, comprueba dinero/unidades disponibles y mantiene un `request_id` idempotente. No ejecuta órdenes ni mueve dinero real en bancos o brokers.
- `tasset_movement` conserva los extremos, cantidades, importe USD, cambio aplicado, costo contable retirado, resultado realizado y los IDs de los asientos. **No reemplaza el diario**: las unidades y los importes siguen en `ttransaction_detail`. Tanto los asientos patrimoniales como los operativos vinculados son inmutables. El historial es de consulta; no hay botón de anulación de movimientos en esta entrega.
- Compra desde disponible: libro operativo **Debe INV-BRIDGE / Haber disponible** en moneda del hogar; libro patrimonial **Debe posición / Haber PATR-BRIDGE** en USD. Retiro hacia disponible: el sentido se invierte y se reconoce el resultado de la venta. La operación guarda USD por unidad de moneda del hogar y exige que coincida con el importe real. Estas cuentas puente se convierten y eliminan entre sí en cualquier consolidación futura; nunca deben sumarse nominales BOB y USD ni contarse como posiciones de patrimonio.
- Entre posiciones se usa un asiento USD. La salida se valora al **promedio del saldo contable por unidad**; la entrada toma el importe de liquidación. La diferencia va a `PATR-REALIZED-GAIN` o `PATR-REALIZED-LOSS`. Es una política de gestión sobre valor contable (que puede incluir revalorizaciones), no un cálculo fiscal por lotes ni una rentabilidad total realizada bajo NIIF. Una transferencia del mismo instrumento entre ubicaciones conserva unidades y valor contable, sin resultado. No admite comisiones en unidades dentro de esa transferencia; requieren un tratamiento separado.
- «Ya la tenía» reutiliza el alta de apertura del onboarding sin descontar disponible. «Comprar una nueva» crea posición, auxiliar y movimiento en una sola transacción, **sin abonar patrimonio inicial**: `registration_kind=purchase`, sin `opening_transaction_id`. Su importe inicial y referencia provienen de la primera compra; la cantidad actual siempre sale del diario. Las monedas originales permitidas en nuevas inversiones monetarias son la moneda del hogar y USD.
- La pantalla permite cambio manual u online, muestra referencias con fecha, revisión previa y errores de saldo; está traducida ES/EN/PT y usa formularios y tarjetas adaptables a móvil/escritorio. El cambio online es solo referencia: se confirma el cambio realmente aplicado. Un precio de compra manual nunca actualiza una cotización pública compartida. Si falla el proveedor, una compra manual todavía puede registrarse y el activo muestra su referencia inicial hasta obtener cotización.
- Las observaciones de valoración toman las unidades a su fecha; contabilizarlas exige que la cantidad no haya cambiado desde la observación. Las referencias anteriores al alta de un activo ya poseído conservan la cantidad declarada de apertura y no sustituyen una valoración actual. No se puede eliminar una posición con movimientos posteriores: se retiran o transfieren sus unidades. Las posiciones con movimientos antiguos sin unidades requieren conciliación antes de retirarse.

Prueba reversible: `tests/investment-movements.sql` cubre acumulación de disponible, compras, ventas con ganancia/pérdida, transferencias entre cuentas y entre custodios, altas compradas sin apertura ficticia, USD/BOB, permisos, duplicados, saldo insuficiente, cambio inconsistente y valoración tras cambios de unidades.


## Bóvedas de ahorro en moneda nativa

Migración `20261101040000_saving_vaults.sql`; interfaz `VaultsPanel.tsx` dentro de la gestión de ahorros e inversiones.

- Tipo de auxiliar `vault`, cuenta de activo `VAULT-<moneda>` por hogar y moneda. Una bóveda es un `tauxiliar` vinculado por `vault_account_id`, con `vault_goal_amount` opcional y solicitud de creación idempotente. Solo admite moneda del hogar o USD; si el hogar ya usa USD se utiliza una sola cuenta. Las identidades y monedas quedan fijas.
- **No hay tabla de saldos ni tabla de movimientos de bóvedas.** `f_vault_balance` calcula el mayor de cuenta + auxiliar en su moneda, con asientos activos hasta hoy. `f_saving_vaults` devuelve saldos, totales separados por moneda e historial obtenido del propio diario. No crea posiciones en `tasset_position` ni convierte las bóvedas BOB a USD para mostrar su saldo.
- `f_create_saving_vault` crea una bóveda vacía sin asiento ni dinero ficticio. `f_transfer_saving_vault` permite aportar desde disponible, liberar dinero al disponible y transferir entre bóvedas; todos los saldos se comprueban en el servidor bajo el mismo bloqueo del hogar usado por inversiones y efectivo operativo. Creación y movimientos requieren administrador; los miembros pueden consultar.
- Misma moneda: **Debe bóveda destino / Haber disponible origen** o su inverso. Distinta moneda: dos asientos operativos balanceados, vinculados por `ttransaction.vault_request_id` y `vault_leg`, con cuentas puente `VAULT-FX-<moneda>`. La tasa se introduce como **moneda del hogar por 1 USD**; se conserva el importe de ambas monedas, la tasa aplicada y la fecha de referencia si se consultó online. La RPC valida que ambos importes coincidan con la tasa, permitiendo solo el redondeo de 8 decimales. No se suman nominales de distintas monedas.
- `household_currency_at_posting` y `household_fx_rate` preparan el equivalente histórico en la moneda del hogar: unidades del hogar por una unidad de la moneda del asiento. Una transferencia USD→USD no exige cambio si no pasa por moneda local. Son transferencias, no ingresos/gastos; no modifican el consumo de la pirámide ni generan rendimiento.
- El disponible libre baja al acreditar 110/111/112; la reserva sube en VAULT. Las reservas se muestran aparte de las inversiones y no vuelven a añadirse a un saldo disponible. El total de posiciones USD que ya mostraba el dashboard sigue siendo el de posiciones; las bóvedas tienen totales nativos separados, sin una consolidación de patrimonio/caja multimoneda automática.
- Cuentas y auxiliares de bóvedas tienen aislamiento por hogar, validación de asociación fija y protección de historial. Los asientos de transferencia son inmutables. No se puede borrar una bóveda con historial ni archivar una con saldo. Los saldos no son editables desde la configuración.
- Esta entrega cubre creación, aportes, liberaciones y transferencias. El pago de gastos desde una bóveda, las conversiones de esos gastos para los reportes del hogar, reembolsos y anulación de movimientos son flujos posteriores; no se simulan mediante un retiro ni se registra un gasto por reservar dinero. La consulta de cambio es una referencia y el usuario confirma la tasa aplicada; no se ejecutan operaciones en bancos.

Validación reversible: `tests/saving-vaults.sql` cubre saldo inicial cero, aportes, retiros, transferencias nativas y BOB/USD, conservación de fondos, snapshots, reintentos, sobreuso, monedas USD/BRL/CNY, asociación fija, inmutabilidad y aislamiento de datos.


## Ahorro generado y transferencias mensuales

Migración `20261101060000_monthly_savings_and_allocations.sql`. Dashboard y gestión de inversiones usan el mismo resumen mensual, en la zona horaria del dispositivo y moneda del hogar. `f_period_income_expenses` suma cuentas de ingreso/gasto del libro operativo; saldos iniciales, patrimonio, cotizaciones y transferencias de activos no generan ahorro. Se conserva compatibilidad con cabeceras antiguas `ledger_version=0` sin detalle clasificado. La antigua categoría `savings_investments` lleva a la cuenta de activo 130 y tampoco es consumo.

- Meta: estimación mensual del onboarding × porcentaje `saving`. Progreso: ingresos reales recibidos menos gastos reales del mes, incluso si el dinero sigue en disponible. Puede ser negativo; el estado es provisional hasta el cierre.
- Aportes y retornos se muestran aparte: movimientos reales de efectivo 110/111/112 hacia/desde posiciones o bóvedas. Se cuentan los nominales en moneda del hogar; las patas USD de la misma operación y los cambios internos entre posiciones/bóvedas no se duplican. Son flujos brutos, no rendimiento ni ahorro nuevo; volver a aportar un retiro no cumple otra vez la meta.
- El disponible sigue siendo acumulado de todos los meses. Invertir en febrero un sobrante de enero no aumenta el ahorro generado en febrero. No se intenta asignar una procedencia mensual a cada billete ni se exige otro saldo/tablas.
- El mes anterior y el histograma de diez meses cerrados usan la misma definición de ahorro. La torta por integrante también excluye transferencias, incluso las antiguas con cabecera de gasto.

`tests/monthly-savings-allocations.sql` prueba ocho escenarios reversibles: invertir antes/después de gastar, invertir ahorro anterior, ahorro sin mover, retiros, bóvedas BOB/USD y movimientos internos, déficit pese a aportes, cero meta, categoría antigua, reintentos, fechas futuras, cierres y permisos. La interfaz compartida está en `features/savings`, traducida ES/EN/PT.
