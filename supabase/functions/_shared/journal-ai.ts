// Pure helpers for Journal AI parsing (Text, Audio, Photo) using Meta models.

export type JournalAiCategory = {
  key: string;
  name: string;
  description?: string;
};

export type JournalAiItem = {
  concept: string;
  amount: string;
  category: string;
};

export type JournalAiResult = {
  concept: string;
  amount: string;
  category: string;
  type: 'expense' | 'income';
  items: JournalAiItem[];
  confidence?: number;
  transcript?: string;
};

export class JournalAiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

// Build the system prompt with strict schema instructions and constrained category keys
export function buildSystemPrompt(
  currency = 'BOB',
  categories: JournalAiCategory[] = []
): string {
  const categoryListing =
    categories.length > 0
      ? categories
          .map(
            (c) =>
              `- ${c.key} (${c.name}${c.description ? `: ${c.description}` : ''})`
          )
          .join('\n')
      : '- general (General household expenses)';

  return `You are an expert financial ledger assistant inside a family budget app.
Your task is to extract structured financial transaction data from natural language user input, voice transcription text, or scanned receipts / invoices.

Household currency: ${currency}

Available budget categories:
${categoryListing}

Rules:
1. "concept": Extract a clear, concise title for the transaction or merchant name (e.g. "Supermercado Líder", "Almuerzo de trabajo", "Farmacia San Rafael", "Carga de combustible", "Sueldo").
2. "amount": Total numeric value as a formatted 2-decimal string (e.g. "45.00", "120.50"). Never include currency symbols in amount.
3. "type": Classify as "expense" (default for purchases, groceries, services, bills) or "income" (for wages, salary, dividends, refunds, gifts received).
4. "category": Must be one exact category key selected from the available budget categories listed above. Choose the closest matching category.
5. "items": If specific itemized products or breakdown lines are mentioned with their individual amounts, extract them into the "items" array. If no breakdown is present, return a single item matching the main concept and amount.
6. "confidence": A number between 0.0 and 1.0 indicating confidence in extraction.

CRITICAL: Respond ONLY with a valid JSON object matching the schema below. No markdown fences, no explanatory prose:
{
  "concept": "Merchant or main concept",
  "amount": "0.00",
  "category": "category_key",
  "type": "expense",
  "items": [
    {
      "concept": "Item description",
      "amount": "0.00",
      "category": "category_key"
    }
  ],
  "confidence": 0.95
}`;
}

// Parse and validate the JSON output returned by Meta muse-spark model
export function parseJournalAiResponse(
  rawText: string,
  categories: JournalAiCategory[] = []
): JournalAiResult {
  if (!rawText || typeof rawText !== 'string') {
    throw new JournalAiError('empty_llm_response', 502, 'LLM returned an empty response.');
  }

  // Clean code fences if returned by model
  let cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  // Find start and end brackets
  const startIndex = cleaned.indexOf('{');
  const endIndex = cleaned.lastIndexOf('}');
  if (startIndex === -1 || endIndex <= startIndex) {
    throw new JournalAiError('invalid_json_format', 502, 'LLM response does not contain valid JSON.');
  }

  cleaned = cleaned.slice(startIndex, endIndex + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw new JournalAiError('json_parse_error', 502, `Failed to parse LLM JSON: ${err?.message}`);
  }

  // Normalize concept
  const concept = typeof parsed.concept === 'string' && parsed.concept.trim()
    ? parsed.concept.trim()
    : 'Movimiento registrado';

  // Normalize amount
  let numAmount = 0;
  if (typeof parsed.amount === 'number') {
    numAmount = parsed.amount;
  } else if (typeof parsed.amount === 'string') {
    const sanitized = parsed.amount.replace(/[^0-9.,]/g, '').replace(',', '.');
    numAmount = parseFloat(sanitized) || 0;
  }
  const amountStr = Math.max(0, numAmount).toFixed(2);

  // Normalize type
  const txType: 'expense' | 'income' =
    parsed.type === 'income' ? 'income' : 'expense';

  // Normalize category
  const validKeys = new Set(categories.map((c) => c.key));
  let categoryKey = typeof parsed.category === 'string' ? parsed.category.trim() : '';
  if (!validKeys.has(categoryKey)) {
    // Attempt case-insensitive or partial match
    const lowerKey = categoryKey.toLowerCase();
    const match = categories.find(
      (c) =>
        c.key.toLowerCase() === lowerKey ||
        c.name.toLowerCase() === lowerKey ||
        c.name.toLowerCase().includes(lowerKey)
    );
    categoryKey = match?.key || categories[0]?.key || 'general';
  }

  // Normalize items
  const items: JournalAiItem[] = [];
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    for (const rawItem of parsed.items) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const itConcept = typeof rawItem.concept === 'string' && rawItem.concept.trim()
        ? rawItem.concept.trim()
        : concept;
      let itNum = 0;
      if (typeof rawItem.amount === 'number') {
        itNum = rawItem.amount;
      } else if (typeof rawItem.amount === 'string') {
        const san = rawItem.amount.replace(/[^0-9.,]/g, '').replace(',', '.');
        itNum = parseFloat(san) || 0;
      }
      let itCat = typeof rawItem.category === 'string' ? rawItem.category.trim() : categoryKey;
      if (!validKeys.has(itCat)) {
        itCat = categoryKey;
      }
      items.push({
        concept: itConcept,
        amount: Math.max(0, itNum).toFixed(2),
        category: itCat,
      });
    }
  }

  if (items.length === 0) {
    items.push({
      concept,
      amount: amountStr,
      category: categoryKey,
    });
  }

  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.9;

  return {
    concept,
    amount: amountStr,
    category: categoryKey,
    type: txType,
    items,
    confidence,
  };
}

// Call Meta muse-spark-1.3 model via OpenAI-compatible endpoint
export async function callMetaLlm(
  messages: Array<{ role: string; content: any }>,
  options?: {
    model?: string;
    metaApiKey?: string;
    temperature?: number;
  }
): Promise<string> {
  const model = options?.model || 'muse-spark-1.3';
  const apiKey =
    options?.metaApiKey ||
    'LLM_1601850044361661_nWMUaAofmDRVL7K8ByCZ_J5TCRs';

  const response = await fetch('https://api.meta.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.1,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new JournalAiError(
      'meta_llm_error',
      response.status,
      body ? JSON.stringify(body) : `Meta LLM request failed with status ${response.status}`
    );
  }

  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new JournalAiError('empty_llm_completion', 502, 'Meta LLM returned empty completion.');
  }

  return content.trim();
}

