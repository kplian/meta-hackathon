import i18n from '../../i18n';

// Feature-owned translations avoid editing shared locale catalogs.
const resources = {
  "es": {
    "step": "Paso {{step}} de 5",
    "homeTitle": "Dale un nombre a tu hogar",
    "homeSubtitle": "Un espacio para organizar juntos lo que más importa. Puedes cambiar el nombre cuando quieras.",
    "homeName": "Nombre del hogar",
    "homePlaceholder": "Ej. Familia García",
    "membersTitle": "¿Quiénes forman tu hogar?",
    "membersSubtitle": "Tú ya formas parte. Añade a los demás integrantes y elige su parentesco. No necesitan una cuenta para empezar.",
    "member": "Miembro",
    "memberName": "Nombre del integrante",
    "addMember": "Añadir miembro",
    "dad": "Papá",
    "mom": "Mamá",
    "son": "Hijo/a",
    "other": "Otro",
    "you": "tú",
    "continue": "Continuar",
    "finish": "Empezar",
    "back": "Volver",
    "nameRequired": "Escribe el nombre de tu hogar.",
    "memberNameRequired": "Escribe el nombre del integrante.",
    "unsavedMember": "Añade el integrante que escribiste o borra el nombre antes de continuar.",
    "loadError": "No pudimos cargar los miembros. Vuelve al paso anterior e inténtalo de nuevo.",
    "saveError": "No pudimos guardar los cambios. Inténtalo de nuevo.",
    "signOut": "Cerrar sesión",
    "income": {
      "title": "¿Quieres configurar tus fuentes de ingreso?",
      "subtitle": "Cuéntanos cuánto estiman recibir. Puedes añadir ingresos para todo el hogar o asociarlos a un integrante.",
      "note": "Son estimaciones para planificar: no registran dinero recibido ni crean transacciones.",
      "configure": "Configurar fuentes de ingreso",
      "addAnother": "Añadir otra fuente",
      "add": "Añadir fuente de ingreso",
      "name": "Nombre de la fuente",
      "placeholder": "Ej. Sueldo, negocio o alquiler",
      "amount": "Monto estimado",
      "currency": "Moneda",
      "frequency": "Frecuencia",
      "recipient": "¿A quién corresponde?",
      "general": "Todo el hogar",
      "weekly": "Semanal",
      "biweekly": "Quincenal (dos veces al mes)",
      "monthly": "Mensual",
      "yearly": "Anual",
      "variable": "Variable",
      "save": "Guardar fuente",
      "edit": "Editar",
      "remove": "Quitar",
      "cancel": "Cancelar",
      "skip": "Omitir por ahora y continuar",
      "validation": "Escribe un nombre y un monto válido (ej. 2500,50).",
      "unsaved": "Guarda la fuente o cancela el formulario antes de continuar.",
      "loadError": "No pudimos cargar tus fuentes de ingreso.",
      "retry": "Reintentar"
    },
    "homeCurrency": "Moneda del hogar",
    "currencyHelp": "Esta es la moneda actual de tu hogar. Puedes elegir otra o escribir su código de tres letras. Las nuevas fuentes de ingreso usarán esta moneda.",
    "currencyInvalid": "Escribe un código de moneda de tres letras, como BOB, USD o EUR.",
    "assets": {
      "title": "¿Qué activos tiene tu hogar?",
      "subtitle": "Añade tu patrimonio si quieres. Registra propiedades, vehículos e inversiones, siempre en dólares.",
      "note": "Son activos que ya tienes. Se guardan como patrimonio inicial en USD, sin registrar un ingreso, un gasto ni una compra nueva.",
      "total": "Patrimonio inicial registrado · USD",
      "configure": "Registrar mis activos",
      "addAnother": "Añadir otro activo",
      "chooseType": "¿Qué quieres registrar?",
      "name": "Nombre del activo",
      "alias": "Alias (opcional)",
      "aliasPlaceholder": "Ej. Casa de campo en Tiquipaya",
      "quantity": "Cantidad (admite decimales)",
      "purchasePrice": "Precio de compra por unidad · USD",
      "estimatedValue": "Valor estimado por unidad · USD",
      "useQuote": "No sé el precio: usar cotización disponible",
      "quoteNote": "Estimación de Twelve Data al {{date}}. Puede ser una cotización con demora o del último cierre; no es tu precio histórico de compra.",
      "value": "Valor de referencia",
      "save": "Guardar activo",
      "remove": "Quitar activo",
      "skip": "Omitir activos y continuar",
      "searchLabel": "Buscar por nombre o símbolo",
      "searchPlaceholder": "Ej. Google, GOOGL, SPY o Bitcoin",
      "search": "Buscar instrumento",
      "noResults": "No encontramos instrumentos en USD. Prueba el símbolo bursátil o un nombre más específico.",
      "queryRequired": "Escribe al menos dos caracteres para buscar.",
      "validation": "Selecciona el activo y completa el nombre, una cantidad y un precio positivos en USD. Para inversiones, elige un resultado de búsqueda.",
      "unsaved": "Guarda el activo o cancela el formulario antes de continuar.",
      "loadError": "No pudimos cargar tus activos. Inténtalo de nuevo.",
      "basis": {
        "purchase_price": "Precio de compra informado",
        "market_estimate": "Estimación de mercado, no coste histórico",
        "estimated_value": "Valor estimado informado"
      },
      "types": {
        "house": "Casa",
        "apartment": "Departamento",
        "land": "Terreno",
        "vehicle": "Vehículo",
        "stock": "Acciones",
        "etf": "ETF",
        "crypto": "Criptomonedas",
        "bond": "Bonos",
        "business": "Negocio",
        "precious_metal": "Metales preciosos",
        "other": "Otro activo",
        "savings": "Cuenta de ahorro",
        "term_deposit": "Depósito a plazo",
        "cash": "Dinero disponible",
        "monetary_investment": "Otra inversión monetaria"
      },
      "errors": {
        "market_unavailable": "No pudimos obtener los datos del mercado. Puedes intentar otra vez o indicar el precio de compra.",
        "market_rate_limit": "Se alcanzó el límite de consultas. Espera un minuto e inténtalo de nuevo.",
        "market_plan_unavailable": "La suscripción de Twelve Data no permite esta consulta. Puedes indicar el precio de compra.",
        "market_not_configured": "El servicio de precios todavía no está configurado. Puedes indicar el precio manualmente.",
        "usd_only": "Este instrumento no cotiza en USD. Elige uno denominado en dólares.",
        "invalid_quote": "El proveedor no devolvió una cotización válida con fecha.",
        "invalid_currency": "Escribe una moneda de tres letras, como BOB, BRL o CNY.",
        "fx_unavailable": "No pudimos obtener una tasa para esta moneda. Puedes intentarlo de nuevo o introducirla manualmente.",
        "invalid_fx_quote": "El proveedor no devolvió una tasa válida con su moneda y fecha."
      },
      "originalCurrency": "Moneda original",
      "originalBalance": "Saldo en la moneda original",
      "institution": "Banco o plataforma (opcional)",
      "maturityDate": "Vencimiento (opcional)",
      "usdPerUnit": "Valor de 1 {{currency}} en USD",
      "fxHelp": "Puedes introducir la conversión o consultar una tasa de referencia online. Conservamos el saldo en su moneda original y su equivalente inicial en USD.",
      "hasYield": "¿Genera intereses o recompensas?",
      "remindMonthly": "Quiero un recordatorio mensual",
      "reminderDay": "Día del mes (1–31)",
      "yieldHelp": "Guardamos tu preferencia para el futuro servicio de alertas. Todavía no se enviarán avisos ni se calcularán o registrarán rendimientos automáticamente.",
      "preferencesInvalid": "Revisa la moneda, el día del mes (1–31) y la fecha de vencimiento (YYYY-MM-DD).",
      "yield": {
        "interest": "Intereses",
        "rewards": "Recompensas",
        "both": "Ambos"
      },
      "useFxQuote": "No sé el tipo de cambio: obtener online",
      "fxQuoteNote": "Twelve Data · 1 {{currency}} = {{rate}} USD · {{date}}. Es una referencia del proveedor, no una cotización garantizada de tu banco.",
      "continue": "Continuar con mi plan"
    },
    "pyramid": {
      "title": "Dale un plan a tus ingresos",
      "subtitle": "Elige una pirámide y adáptala a tu hogar. Verás cuánto puedes destinar a cada área al mes.",
      "income": "Ingreso mensual estimado del hogar",
      "incomeHelp": "Convertimos los ingresos semanales y anuales a un promedio mensual; los quincenales cuentan dos veces al mes.",
      "noIncome": "Aún no hay ingresos periódicos para calcular montos. Puedes elegir tus porcentajes ahora y completar los ingresos después.",
      "excluded": "No incluimos {{count}} fuente(s) sin frecuencia fija o en otra moneda.",
      "editIncome": "Revisar mis fuentes de ingreso",
      "choose": "1. Elige un punto de partida",
      "customize": "2. Hazlo tuyo",
      "reset": "Restablecer plantilla",
      "percentLabel": "Porcentaje para {{name}}",
      "perMonth": "al mes",
      "total": "Total distribuido: {{total}}%",
      "totalValid": "Todo listo: estás distribuyendo el 100% de tus ingresos.",
      "totalError": "Los porcentajes deben sumar exactamente 100%. Ajusta los controles para poder continuar.",
      "estimateNote": "Son montos orientativos según tus ingresos estimados. Esta elección no mueve dinero ni registra gastos.",
      "save": "Guardar mi plan y empezar",
      "loadError": "No pudimos cargar tus plantillas e ingresos. Inténtalo de nuevo.",
      "saveError": "No pudimos guardar tu plan. Inténtalo de nuevo.",
      "templates": {
        "essential": {
          "name": "Pirámide esencial",
          "description": "Prioriza lo indispensable y los compromisos del hogar."
        },
        "balanced": {
          "name": "Pirámide equilibrada",
          "description": "Equilibra tus necesidades, compromisos y metas."
        },
        "wealth": {
          "name": "Pirámide patrimonial",
          "description": "Dedica una mayor parte a construir tu patrimonio."
        }
      },
      "levels": {
        "essential": {
          "needs": {
            "name": "Necesidades básicas",
            "description": "Alimentación, vivienda, salud y transporte."
          },
          "debts": {
            "name": "Deudas y compromisos",
            "description": "Cuotas, préstamos y obligaciones del hogar."
          },
          "personal": {
            "name": "Ocio y personales",
            "description": "Salidas, entretenimiento y gustos personales."
          },
          "saving": {
            "name": "Ahorro e inversiones",
            "description": "Fondo de emergencia, ahorro y crecimiento del patrimonio."
          }
        },
        "balanced": {
          "needs": {
            "name": "Necesidades básicas",
            "description": "Alimentación, vivienda, salud y transporte."
          },
          "debts": {
            "name": "Deudas y compromisos",
            "description": "Cuotas, préstamos y obligaciones del hogar."
          },
          "personal": {
            "name": "Ocio y personales",
            "description": "Salidas, entretenimiento y gustos personales."
          },
          "saving": {
            "name": "Ahorro e inversiones",
            "description": "Fondo de emergencia, ahorro y crecimiento del patrimonio."
          }
        },
        "wealth": {
          "needs": {
            "name": "Necesidades básicas",
            "description": "Alimentación, vivienda, salud y transporte."
          },
          "debts": {
            "name": "Deudas y compromisos",
            "description": "Cuotas, préstamos y obligaciones del hogar."
          },
          "personal": {
            "name": "Ocio y personales",
            "description": "Salidas, entretenimiento y gustos personales."
          },
          "saving": {
            "name": "Ahorro e inversiones",
            "description": "Fondo de emergencia, ahorro y crecimiento del patrimonio."
          }
        }
      },
      "customTitle": "Elegir mis porcentajes",
      "customHelp": "Ajusta las cuatro áreas con los sliders. Deben sumar 100%."
    }
  },
  "en": {
    "step": "Step {{step}} of 5",
    "homeTitle": "Give your household a name",
    "homeSubtitle": "A space to organize what matters together. You can change the name any time.",
    "homeName": "Household name",
    "homePlaceholder": "E.g. Garcia Family",
    "membersTitle": "Who is in your household?",
    "membersSubtitle": "You are already a member. Add your family and choose their relationship. They do not need an account to get started.",
    "member": "Member",
    "memberName": "Member name",
    "addMember": "Add member",
    "dad": "Dad",
    "mom": "Mom",
    "son": "Child",
    "other": "Other",
    "you": "you",
    "continue": "Continue",
    "finish": "Get started",
    "back": "Back",
    "nameRequired": "Enter your household name.",
    "memberNameRequired": "Enter the member name.",
    "unsavedMember": "Add the member you entered or clear the name before continuing.",
    "loadError": "We could not load members. Go back and try again.",
    "saveError": "We could not save your changes. Please try again.",
    "signOut": "Sign out",
    "income": {
      "title": "Would you like to set up income sources?",
      "subtitle": "Tell us what you expect to receive. Add shared household income or assign it to a member.",
      "note": "These are planning estimates: they do not record received money or create transactions.",
      "configure": "Set up income sources",
      "addAnother": "Add another source",
      "add": "Add income source",
      "name": "Source name",
      "placeholder": "E.g. Salary, business or rent",
      "amount": "Estimated amount",
      "currency": "Currency",
      "frequency": "Frequency",
      "recipient": "Who receives it?",
      "general": "Whole household",
      "weekly": "Weekly",
      "biweekly": "Twice monthly",
      "monthly": "Monthly",
      "yearly": "Yearly",
      "variable": "Variable",
      "save": "Save source",
      "edit": "Edit",
      "remove": "Remove",
      "cancel": "Cancel",
      "skip": "Skip for now and continue",
      "validation": "Enter a name and a valid amount (e.g. 2500.50).",
      "unsaved": "Save the source or cancel the form before continuing.",
      "loadError": "We could not load your income sources.",
      "retry": "Retry"
    },
    "homeCurrency": "Household currency",
    "currencyHelp": "This is your current household currency. Choose another or enter its three-letter code. New income sources will use this currency.",
    "currencyInvalid": "Enter a three-letter currency code such as BOB, USD or EUR.",
    "assets": {
      "title": "What assets does your household own?",
      "subtitle": "Optionally add property, vehicles and investments. All assets are recorded in US dollars.",
      "note": "These are assets you already own. They are recorded as opening USD patrimony, without creating income, expenses or a new purchase.",
      "total": "Registered opening assets · USD",
      "configure": "Register my assets",
      "addAnother": "Add another asset",
      "chooseType": "What would you like to register?",
      "name": "Asset name",
      "alias": "Alias (optional)",
      "aliasPlaceholder": "E.g. Country house in Tiquipaya",
      "quantity": "Quantity (decimals allowed)",
      "purchasePrice": "Purchase price per unit · USD",
      "estimatedValue": "Estimated value per unit · USD",
      "useQuote": "I do not know the price: use available quote",
      "quoteNote": "Twelve Data estimate as of {{date}}. This may be a delayed or closing quote; it is not your historical purchase price.",
      "value": "Reference value",
      "save": "Save asset",
      "remove": "Remove asset",
      "skip": "Skip assets and continue",
      "searchLabel": "Search by name or symbol",
      "searchPlaceholder": "E.g. Google, GOOGL, SPY or Bitcoin",
      "search": "Search instrument",
      "noResults": "No USD instruments found. Try the ticker symbol or a more specific name.",
      "queryRequired": "Enter at least two characters to search.",
      "validation": "Choose an asset, enter a name and positive USD price and quantity. For investments, select a search result.",
      "unsaved": "Save the asset or cancel the form before continuing.",
      "loadError": "We could not load your assets. Please retry.",
      "basis": {
        "purchase_price": "Reported purchase price",
        "market_estimate": "Market estimate, not historical cost",
        "estimated_value": "Reported estimated value"
      },
      "types": {
        "house": "House",
        "apartment": "Apartment",
        "land": "Land",
        "vehicle": "Vehicle",
        "stock": "Stocks",
        "etf": "ETF",
        "crypto": "Crypto",
        "bond": "Bonds",
        "business": "Business",
        "precious_metal": "Precious metals",
        "other": "Other asset",
        "savings": "Savings account",
        "term_deposit": "Term deposit",
        "cash": "Available cash",
        "monetary_investment": "Other monetary investment"
      },
      "errors": {
        "market_unavailable": "Market data is unavailable. Retry or enter the purchase price.",
        "market_rate_limit": "Query limit reached. Wait a minute and retry.",
        "market_plan_unavailable": "The Twelve Data subscription does not cover this query. You can enter the purchase price.",
        "market_not_configured": "Market prices are not configured. You can enter the price manually.",
        "usd_only": "This instrument is not quoted in USD. Choose a USD instrument.",
        "invalid_quote": "The provider did not return a valid timestamped quote.",
        "invalid_currency": "Enter a three-letter currency such as BOB, BRL or CNY.",
        "fx_unavailable": "No exchange rate is available for this currency. Try again or enter it manually.",
        "invalid_fx_quote": "The provider did not return a valid dated rate for this currency."
      },
      "originalCurrency": "Original currency",
      "originalBalance": "Balance in original currency",
      "institution": "Bank or platform (optional)",
      "maturityDate": "Maturity date (optional)",
      "usdPerUnit": "Value of 1 {{currency}} in USD",
      "fxHelp": "Enter the conversion manually or fetch an online reference rate. The original balance and its initial USD equivalent are preserved.",
      "hasYield": "Does it earn interest or rewards?",
      "remindMonthly": "I want a monthly reminder",
      "reminderDay": "Day of month (1–31)",
      "yieldHelp": "Your preference is saved for a future reminder service. No alerts, automatic yield calculations or yield postings are enabled yet.",
      "preferencesInvalid": "Check the currency, day of month (1–31) and maturity date (YYYY-MM-DD).",
      "yield": {
        "interest": "Interest",
        "rewards": "Rewards",
        "both": "Both"
      },
      "useFxQuote": "I do not know the exchange rate: fetch online",
      "fxQuoteNote": "Twelve Data · 1 {{currency}} = {{rate}} USD · {{date}}. Provider reference, not a guaranteed bank conversion rate.",
      "continue": "Continue to my plan"
    },
    "pyramid": {
      "title": "Give your income a plan",
      "subtitle": "Choose a pyramid and make it fit your household. See how much you can allocate to each area every month.",
      "income": "Estimated monthly household income",
      "incomeHelp": "Weekly and annual income are averaged monthly; twice-monthly income counts twice per month.",
      "noIncome": "No recurring income is available yet. Choose your percentages now and add income later.",
      "excluded": "We excluded {{count}} source(s) with variable frequency or another currency.",
      "editIncome": "Review income sources",
      "choose": "1. Choose a starting point",
      "customize": "2. Make it yours",
      "reset": "Reset template",
      "percentLabel": "Percentage for {{name}}",
      "perMonth": "per month",
      "total": "Total allocated: {{total}}%",
      "totalValid": "Ready: you are allocating 100% of your income.",
      "totalError": "Percentages must add up to exactly 100%. Use values from 0 to 100, with up to two decimals.",
      "estimateNote": "Amounts are a guide based on estimated income. Choosing a plan does not move money or record expenses.",
      "save": "Save my plan and get started",
      "loadError": "Could not load templates and income. Please try again.",
      "saveError": "Could not save your plan. Please try again.",
      "templates": {
        "essential": {
          "name": "Essential pyramid",
          "description": "Prioritize essentials and household commitments."
        },
        "balanced": {
          "name": "Balanced pyramid",
          "description": "Balance needs, commitments and goals."
        },
        "wealth": {
          "name": "Wealth pyramid",
          "description": "Allocate more toward building wealth."
        }
      },
      "levels": {
        "essential": {
          "needs": {
            "name": "Basic needs",
            "description": "Food, housing, health and transport."
          },
          "debts": {
            "name": "Debts and commitments",
            "description": "Loan payments and household obligations."
          },
          "personal": {
            "name": "Leisure and personal",
            "description": "Entertainment and personal spending."
          },
          "saving": {
            "name": "Savings and investments",
            "description": "Emergency fund, savings and wealth growth."
          }
        },
        "balanced": {
          "needs": {
            "name": "Basic needs",
            "description": "Food, housing, health and transport."
          },
          "debts": {
            "name": "Debts and commitments",
            "description": "Loan payments and household obligations."
          },
          "personal": {
            "name": "Leisure and personal",
            "description": "Entertainment and personal spending."
          },
          "saving": {
            "name": "Savings and investments",
            "description": "Emergency fund, savings and wealth growth."
          }
        },
        "wealth": {
          "needs": {
            "name": "Basic needs",
            "description": "Food, housing, health and transport."
          },
          "debts": {
            "name": "Debts and commitments",
            "description": "Loan payments and household obligations."
          },
          "personal": {
            "name": "Leisure and personal",
            "description": "Entertainment and personal spending."
          },
          "saving": {
            "name": "Savings and investments",
            "description": "Emergency fund, savings and wealth growth."
          }
        }
      },
      "customTitle": "Choose my percentages",
      "customHelp": "Adjust the four areas with the sliders. They must add up to 100%."
    }
  },
  "pt": {
    "step": "Etapa {{step}} de 5",
    "homeTitle": "Dê um nome ao seu lar",
    "homeSubtitle": "Um espaço para organizar juntos o que importa. Você pode mudar o nome quando quiser.",
    "homeName": "Nome do lar",
    "homePlaceholder": "Ex. Família Silva",
    "membersTitle": "Quem faz parte do seu lar?",
    "membersSubtitle": "Você já faz parte. Adicione os integrantes e escolha o parentesco. Eles não precisam de uma conta para começar.",
    "member": "Membro",
    "memberName": "Nome do integrante",
    "addMember": "Adicionar membro",
    "dad": "Pai",
    "mom": "Mãe",
    "son": "Filho/a",
    "other": "Outro",
    "you": "você",
    "continue": "Continuar",
    "finish": "Começar",
    "back": "Voltar",
    "nameRequired": "Digite o nome do seu lar.",
    "memberNameRequired": "Digite o nome do integrante.",
    "unsavedMember": "Adicione o integrante digitado ou apague o nome antes de continuar.",
    "loadError": "Não foi possível carregar os membros. Volte e tente novamente.",
    "saveError": "Não foi possível salvar. Tente novamente.",
    "signOut": "Sair",
    "income": {
      "title": "Quer configurar suas fontes de renda?",
      "subtitle": "Conte quanto esperam receber. Adicione renda para todo o lar ou associe a um integrante.",
      "note": "São estimativas para planejar: não registram dinheiro recebido nem criam transações.",
      "configure": "Configurar fontes de renda",
      "addAnother": "Adicionar outra fonte",
      "add": "Adicionar fonte de renda",
      "name": "Nome da fonte",
      "placeholder": "Ex. Salário, negócio ou aluguel",
      "amount": "Valor estimado",
      "currency": "Moeda",
      "frequency": "Frequência",
      "recipient": "A quem pertence?",
      "general": "Todo o lar",
      "weekly": "Semanal",
      "biweekly": "Quinzenal (duas vezes por mês)",
      "monthly": "Mensal",
      "yearly": "Anual",
      "variable": "Variável",
      "save": "Salvar fonte",
      "edit": "Editar",
      "remove": "Remover",
      "cancel": "Cancelar",
      "skip": "Pular por agora e continuar",
      "validation": "Digite um nome e um valor válido (ex. 2500,50).",
      "unsaved": "Salve a fonte ou cancele o formulário antes de continuar.",
      "loadError": "Não foi possível carregar suas fontes de renda.",
      "retry": "Tentar novamente"
    },
    "homeCurrency": "Moeda do lar",
    "currencyHelp": "Esta é a moeda atual do seu lar. Escolha outra ou digite o código de três letras. Novas fontes de renda usarão esta moeda.",
    "currencyInvalid": "Digite um código de moeda de três letras, como BOB, USD ou EUR.",
    "assets": {
      "title": "Quais ativos seu lar possui?",
      "subtitle": "Adicione imóveis, veículos e investimentos se quiser. Todos os ativos são registrados em dólares.",
      "note": "São ativos que você já possui. São registrados como patrimônio inicial em USD, sem gerar renda, despesa ou uma nova compra.",
      "total": "Patrimônio inicial registrado · USD",
      "configure": "Registrar meus ativos",
      "addAnother": "Adicionar outro ativo",
      "chooseType": "O que deseja registrar?",
      "name": "Nome do ativo",
      "alias": "Apelido (opcional)",
      "aliasPlaceholder": "Ex. Casa de campo em Tiquipaya",
      "quantity": "Quantidade (aceita decimais)",
      "purchasePrice": "Preço de compra por unidade · USD",
      "estimatedValue": "Valor estimado por unidade · USD",
      "useQuote": "Não sei o preço: usar cotação disponível",
      "quoteNote": "Estimativa da Twelve Data em {{date}}. Pode ser uma cotação com atraso ou de fechamento; não é seu preço histórico de compra.",
      "value": "Valor de referência",
      "save": "Salvar ativo",
      "remove": "Remover ativo",
      "skip": "Pular ativos e continuar",
      "searchLabel": "Buscar por nome ou símbolo",
      "searchPlaceholder": "Ex. Google, GOOGL, SPY ou Bitcoin",
      "search": "Buscar instrumento",
      "noResults": "Nenhum instrumento em USD encontrado. Tente o símbolo ou um nome mais específico.",
      "queryRequired": "Digite pelo menos dois caracteres para buscar.",
      "validation": "Selecione um ativo, informe nome, quantidade e preço positivos em USD. Para investimentos, escolha um resultado da busca.",
      "unsaved": "Salve o ativo ou cancele o formulário antes de continuar.",
      "loadError": "Não foi possível carregar os ativos. Tente novamente.",
      "basis": {
        "purchase_price": "Preço de compra informado",
        "market_estimate": "Estimativa de mercado, não custo histórico",
        "estimated_value": "Valor estimado informado"
      },
      "types": {
        "house": "Casa",
        "apartment": "Apartamento",
        "land": "Terreno",
        "vehicle": "Veículo",
        "stock": "Ações",
        "etf": "ETF",
        "crypto": "Criptomoedas",
        "bond": "Títulos",
        "business": "Negócio",
        "precious_metal": "Metais preciosos",
        "other": "Outro ativo",
        "savings": "Conta de poupança",
        "term_deposit": "Depósito a prazo",
        "cash": "Dinheiro disponível",
        "monetary_investment": "Outro investimento monetário"
      },
      "errors": {
        "market_unavailable": "Dados de mercado indisponíveis. Tente novamente ou informe o preço de compra.",
        "market_rate_limit": "Limite de consultas atingido. Aguarde um minuto e tente novamente.",
        "market_plan_unavailable": "A assinatura Twelve Data não permite esta consulta. Você pode informar o preço de compra.",
        "market_not_configured": "O serviço de preços não está configurado. Informe o preço manualmente.",
        "usd_only": "Este instrumento não é cotado em USD. Escolha um instrumento em dólares.",
        "invalid_quote": "O provedor não retornou uma cotação válida com data.",
        "invalid_currency": "Informe uma moeda de três letras, como BOB, BRL ou CNY.",
        "fx_unavailable": "Não foi possível obter uma taxa para esta moeda. Tente novamente ou informe manualmente.",
        "invalid_fx_quote": "O provedor não retornou uma taxa válida com moeda e data."
      },
      "originalCurrency": "Moeda original",
      "originalBalance": "Saldo na moeda original",
      "institution": "Banco ou plataforma (opcional)",
      "maturityDate": "Vencimento (opcional)",
      "usdPerUnit": "Valor de 1 {{currency}} em USD",
      "fxHelp": "Informe a conversão manualmente ou consulte uma taxa de referência online. Preservamos o saldo original e o equivalente inicial em USD.",
      "hasYield": "Gera juros ou recompensas?",
      "remindMonthly": "Quero um lembrete mensal",
      "reminderDay": "Dia do mês (1–31)",
      "yieldHelp": "A preferência será usada por um futuro serviço de alertas. Ainda não serão enviados avisos nem calculados ou registrados rendimentos automaticamente.",
      "preferencesInvalid": "Confira a moeda, o dia do mês (1–31) e o vencimento (YYYY-MM-DD).",
      "yield": {
        "interest": "Juros",
        "rewards": "Recompensas",
        "both": "Ambos"
      },
      "useFxQuote": "Não sei a taxa de câmbio: consultar online",
      "fxQuoteNote": "Twelve Data · 1 {{currency}} = {{rate}} USD · {{date}}. Referência do provedor, não uma taxa garantida pelo banco.",
      "continue": "Continuar para meu plano"
    },
    "pyramid": {
      "title": "Dê um plano à sua renda",
      "subtitle": "Escolha uma pirâmide e adapte ao seu lar. Veja quanto pode destinar a cada área por mês.",
      "income": "Renda mensal estimada do lar",
      "incomeHelp": "Rendas semanais e anuais são convertidas em médias mensais; rendas quinzenais contam duas vezes por mês.",
      "noIncome": "Ainda não há renda periódica para calcular valores. Escolha os percentuais agora e adicione renda depois.",
      "excluded": "Não incluímos {{count}} fonte(s) com frequência variável ou outra moeda.",
      "editIncome": "Revisar fontes de renda",
      "choose": "1. Escolha um ponto de partida",
      "customize": "2. Personalize",
      "reset": "Restaurar modelo",
      "percentLabel": "Percentual de {{name}}",
      "perMonth": "por mês",
      "total": "Total distribuído: {{total}}%",
      "totalValid": "Pronto: você está distribuindo 100% da renda.",
      "totalError": "Os percentuais devem somar exatamente 100%. Use valores de 0 a 100, com até duas casas decimais.",
      "estimateNote": "Valores orientativos baseados na renda estimada. Escolher o plano não movimenta dinheiro nem registra despesas.",
      "save": "Salvar meu plano e começar",
      "loadError": "Não foi possível carregar modelos e renda. Tente novamente.",
      "saveError": "Não foi possível salvar o plano. Tente novamente.",
      "templates": {
        "essential": {
          "name": "Pirâmide essencial",
          "description": "Priorize o essencial e os compromissos do lar."
        },
        "balanced": {
          "name": "Pirâmide equilibrada",
          "description": "Equilibre necessidades, compromissos e metas."
        },
        "wealth": {
          "name": "Pirâmide patrimonial",
          "description": "Dedique mais à construção do patrimônio."
        }
      },
      "levels": {
        "essential": {
          "needs": {
            "name": "Necessidades básicas",
            "description": "Alimentação, moradia, saúde e transporte."
          },
          "debts": {
            "name": "Dívidas e compromissos",
            "description": "Parcelas, empréstimos e obrigações do lar."
          },
          "personal": {
            "name": "Lazer e pessoais",
            "description": "Lazer e gastos pessoais."
          },
          "saving": {
            "name": "Poupança e investimentos",
            "description": "Reserva de emergência, poupança e patrimônio."
          }
        },
        "balanced": {
          "needs": {
            "name": "Necessidades básicas",
            "description": "Alimentação, moradia, saúde e transporte."
          },
          "debts": {
            "name": "Dívidas e compromissos",
            "description": "Parcelas, empréstimos e obrigações do lar."
          },
          "personal": {
            "name": "Lazer e pessoais",
            "description": "Lazer e gastos pessoais."
          },
          "saving": {
            "name": "Poupança e investimentos",
            "description": "Reserva de emergência, poupança e patrimônio."
          }
        },
        "wealth": {
          "needs": {
            "name": "Necessidades básicas",
            "description": "Alimentação, moradia, saúde e transporte."
          },
          "debts": {
            "name": "Dívidas e compromissos",
            "description": "Parcelas, empréstimos e obrigações do lar."
          },
          "personal": {
            "name": "Lazer e pessoais",
            "description": "Lazer e gastos pessoais."
          },
          "saving": {
            "name": "Poupança e investimentos",
            "description": "Reserva de emergência, poupança e patrimônio."
          }
        }
      },
      "customTitle": "Escolher minhas porcentagens",
      "customHelp": "Ajuste as quatro áreas com os controles. Elas devem somar 100%."
    }
  }
};

for (const [language, messages] of Object.entries(resources)) {
  i18n.addResourceBundle(language, 'onboarding', messages, true, true);
}
