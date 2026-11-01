# Inicio local

Requisitos: Node 24 LTS, npm y Docker/Colima en ejecución.

1. Instala las dependencias desde la raíz: `npm ci`.
2. Configura `.env` desde `.env.example`. Para Google, coloca las credenciales reales del cliente OAuth.
3. Ejecuta `npm run local:setup`. Inicia Supabase, aplica migraciones y datos de prueba, configura las variables públicas de la app y verifica el usuario demo.
4. Ejecuta `npm run mobile:web` y abre http://localhost:8090.
5. Pulsa **Acceder en modo demo (Valentina)** para explorar los dos hogares y seis movimientos de ejemplo.

Supabase Studio: http://localhost:54323. API: http://127.0.0.1:54321.

## Onboarding y patrimonio

Un registro nuevo crea su propio hogar y el primer miembro. Mientras el hogar no tenga `setup_completed_at`, la app muestra cinco pasos: nombre y moneda, miembros, fuentes de ingreso opcionales, activos opcionales y elección de una pirámide de distribución. El plan ofrece las pirámides Esencial (60/20/10/10), Equilibrada (50/15/15/20) y Patrimonial (40/10/10/40), en orden necesidades, deudas, ocio y ahorro. «Elegir mis porcentajes» habilita sliders; solo se guarda si suman 100%. Los montos se calculan sobre el ingreso mensual estimado en la moneda del hogar. Los activos se registran siempre en USD como patrimonio inicial, sin generar ingresos ni gastos cotidianos.

Para buscar acciones, ETFs o criptomonedas y consultar precios de referencia, configura `TWELVE_DATA_KEY` únicamente en el `.env` de la raíz y ejecuta `npm run market:serve` en otra terminal. No copies esa clave a variables `EXPO_PUBLIC_*`. Las propiedades y otros activos con valoración manual no necesitan el proveedor de precios.

Validación: `npm run mobile:typecheck`, `npm run test:market` y la prueba SQL reversible `tests/assets-ledger.sql`. Esta última comprueba el registro inicial, cantidades fraccionarias, asientos balanceados, reintentos y aislamiento entre hogares; termina con `ROLLBACK`.

Las credenciales demo se leen de `apps/mobile/.env`; los valores iniciales están en su `.env.example`. Las claves de servicio y el secreto Google permanecen en el backend.

Para Google OAuth, el cliente de Google Cloud debe autorizar `http://127.0.0.1:54321/auth/v1/callback` como URI de redirección. El regreso a la app es `http://localhost:8090/`. El inicio de sesión en la cuenta Google se completa personalmente en el navegador.

Después de cambiar variables de la app, reinicia Expo. Si cambias credenciales Google, reinicia Supabase con `npm run db:stop` y `npm run local:setup`.

`npm run db:reset` borra la base local y vuelve a cargar el seed; después ejecuta `npm run local:setup` para recrear el acceso demo. Usa este reset solo cuando quieras descartar los datos locales.

Para usar un teléfono físico, configura la URL pública de Supabase con la IP LAN de tu computadora; localhost en el teléfono apunta al propio teléfono.

n8n y las claves de proveedores de IA solo son necesarios para probar los bots; no hacen falta para navegar la app con los datos básicos.

El modelo patrimonial, las valoraciones manuales y el proceso `npm run assets:refresh -- --household UUID` están documentados en [docs/accounting-assets.md](docs/accounting-assets.md). Las valoraciones conservan el valor inicial y no se contabilizan automáticamente como ingresos.

El dashboard muestra la pirámide del mes actual con ingresos estimados frente a recibidos y gastos reales, en la moneda del hogar. Usa `f_monthly_pyramid_dashboard` (migración `20261031280000`), respeta el mes en la zona horaria del dispositivo y excluye movimientos de patrimonio y otras monedas. Los gastos sin asociación se indican aparte; la asignación por nivel usa las fuentes estimadas del onboarding normalizadas al mes (migración `20261031290000`), mientras los ingresos recibidos se muestran por separado.

El dashboard incluye patrimonio acumulado en USD con pastel y detalle por posición (`f_household_wealth_report`, migración `20261031300000`). El valor es la última valoración de las unidades iniciales más el neto de movimientos de capital en su cuenta y auxiliar (libro patrimonial USD), excluyendo apertura y asientos de revalorización para no duplicar. Aportes o rendimientos reinvertidos deben contabilizarse contra esa cuenta/auxiliar; rendimientos cobrados aparte no se suman al activo. No se implementa un job ni un formulario de rendimientos en este cambio. Si un futuro job valora unidades adicionales, deberá ampliar esta base de cálculo para evitar contar sus movimientos dos veces.

El historial de ahorro muestra los últimos diez meses completos, sin el actual (`f_closed_month_savings_report`, migración `20261031310000`). Calcula ingresos y gastos reales contabilizados en la cuenta operativa de efectivo/disponible con código 110, y su diferencia; no combina el dinero patrimonial USD de `PATR-cash`, ni cuenta transferencias o aperturas como ahorro. No requiere cierre ni job, y completa los meses sin movimientos con cero.

Gastos por integrante: torta del mes actual en moneda del hogar (`f_member_expenses_report`, migración `20261031320000`). Resuelve el integrante por auxiliar de las líneas de débito; el resto y los gastos históricos sin detalle se agrupan como Global de la familia. Excluye ingresos y patrimonio, no duplica las líneas de pago y conserva el histograma como último indicador.
