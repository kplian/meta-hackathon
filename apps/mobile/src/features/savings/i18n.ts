import i18n from '../../i18n';
const resources = {
  es: {
    title: 'Tu ahorro del mes', generated: 'Ahorro generado hasta hoy', formula: 'Ingresos recibidos menos gastos reales de este mes.',
    target: 'Meta mensual: {{amount}}', achieved: 'Meta alcanzada hasta hoy', gap: 'Faltan {{amount}} para la meta', noTarget: 'Sin meta mensual configurada',
    provisional: 'El resultado puede cambiar con los próximos ingresos y gastos del mes.',
    allocated: 'Dinero movido este mes', investments: 'Del disponible a inversiones', vaults: 'Del disponible a bóvedas',
    returns: 'De inversiones y bóvedas al disponible: {{amount}}',
    transferNote: 'Son transferencias, no gastos ni ahorro nuevo. Pueden usar ahorros de meses anteriores. Mover el mismo dinero varias veces no aumenta el ahorro generado.',
    prior: 'Mes anterior ({{month}}): {{amount}} de ahorro / déficit.',
    loadError: 'No pudimos cargar el resumen mensual de ahorro.', loading: 'Cargando el ahorro del mes…',
    progress: '{{percent}}% de la meta', deficit: 'Déficit hasta hoy: {{amount}}',
  },
  en: {
    title: 'Your savings this month', generated: 'Savings generated so far', formula: 'Income received minus actual expenses this month.',
    target: 'Monthly goal: {{amount}}', achieved: 'Goal reached so far', gap: '{{amount}} still needed for the goal', noTarget: 'No monthly goal configured',
    provisional: 'The result may change as more income and expenses arrive this month.',
    allocated: 'Money moved this month', investments: 'From available cash to investments', vaults: 'From available cash to vaults',
    returns: 'From investments and vaults back to available cash: {{amount}}',
    transferNote: 'These are transfers, not expenses or new savings. They may use savings from earlier months. Moving the same money several times does not increase savings generated.',
    prior: 'Previous month ({{month}}): {{amount}} in savings / deficit.',
    loadError: 'We could not load the monthly savings summary.', loading: 'Loading this month’s savings…',
    progress: '{{percent}}% of goal', deficit: 'Deficit so far: {{amount}}',
  },
  pt: {
    title: 'Sua poupança do mês', generated: 'Poupança gerada até agora', formula: 'Receitas recebidas menos despesas reais deste mês.',
    target: 'Meta mensal: {{amount}}', achieved: 'Meta atingida até agora', gap: 'Faltam {{amount}} para a meta', noTarget: 'Sem meta mensal configurada',
    provisional: 'O resultado pode mudar com as próximas receitas e despesas do mês.',
    allocated: 'Dinheiro movimentado neste mês', investments: 'Do disponível para investimentos', vaults: 'Do disponível para cofres',
    returns: 'De investimentos e cofres para o disponível: {{amount}}',
    transferNote: 'São transferências, não despesas nem nova poupança. Podem usar economias de meses anteriores. Movimentar o mesmo dinheiro várias vezes não aumenta a poupança gerada.',
    prior: 'Mês anterior ({{month}}): {{amount}} de poupança / déficit.',
    loadError: 'Não foi possível carregar o resumo mensal de poupança.', loading: 'Carregando a poupança do mês…',
    progress: '{{percent}}% da meta', deficit: 'Déficit até agora: {{amount}}',
  },
};
for (const [language, messages] of Object.entries(resources)) i18n.addResourceBundle(language, 'monthlySavings', messages, true, true);
