export interface Category {
  value: string; // normalized lowercase ASCII stored in DB
  label_en: string;
  label_es: string;
  emoji?: string;
  description?: string; // Guidance for the agent
}

export const INCOME_CATEGORIES: Category[] = [
  { value: "salary", label_en: "Salary/Payroll", label_es: "Nómina", emoji: "💼", description: "Regular monthly paycheck from employer, payroll, or bonuses." },
  { value: "freelance", label_en: "Freelance/Invoices", label_es: "Facturas", emoji: "🧾", description: "Income from self-employed work, consulting, or specific project invoices." },
  { value: "investments", label_en: "Investments", label_es: "Inversiones", emoji: "📈", description: "General income from selling assets or realized investment gains." },
  { value: "interests", label_en: "Interests", label_es: "Intereses", emoji: "💰", description: "Interest earned from savings accounts, deposits, or lending." },
  { value: "dividends", label_en: "Dividends", label_es: "Dividendos", emoji: "💸", description: "Periodic payments from stocks or ETFs." },
  { value: "gifts", label_en: "Gifts", label_es: "Regalos", emoji: "🎁", description: "Money received as a present from family, friends, or others." },
  { value: "sales", label_en: "Sales", label_es: "Ventas", emoji: "🛒", description: "Proceeds from selling personal items (Vinted, eBay, second-hand)." },
  { value: "rental_income", label_en: "Rental Income", label_es: "Ingresos por Alquiler", emoji: "🏘️", description: "Rent received from properties owned by the user." },
  { value: "awards", label_en: "Awards", label_es: "Premios", emoji: "🏆", description: "Money won from contests, lotteries, competitions, or prize money." },
  { value: "savings_withdrawal", label_en: "Savings Withdrawal", label_es: "Retirada de Hucha", emoji: "🐷", description: "Moving money from a savings pot back to the main balance." },
  { value: "investment_return", label_en: "Investment Return", label_es: "Retorno de Inversión", emoji: "📈", description: "Direct profits returned from specific investment projects." },
  { value: "other", label_en: "Other", label_es: "Otros", emoji: "💰", description: "Any income that doesn't fit into the specific categories above." },
];

export const EXPENSE_CATEGORIES: Category[] = [
  { value: "supermarket", label_en: "Supermarket", label_es: "Supermercado", emoji: "🛒", description: "Groceries, food shopping, household supplies (cleaning, pantry items)." },
  { value: "house", label_en: "House", label_es: "Hogar", emoji: "🏠", description: "Rent, mortgage, home improvements, furniture, or decoration." },
  { value: "vehicle", label_en: "Vehicle", label_es: "Vehículo", emoji: "🚗", description: "Car payments, gas/fuel, car insurance, repairs, or maintenance." },
  { value: "transport", label_en: "Transport", label_es: "Transporte", emoji: "🚌", description: "Public transport, taxis, trains, buses, or shared mobility services." },
  { value: "shopping", label_en: "Shopping", label_es: "Compras", emoji: "🛍️", description: "Clothing, electronics, household appliances, or personal shopping." },
  { value: "entertainment", label_en: "Entertainment", label_es: "Ocio", emoji: "🎮", description: "Cinema, concerts, parties, hobbies, video games, or events." },
  { value: "health", label_en: "Health", label_es: "Salud", emoji: "🏥", description: "Doctors, pharmacy, medicine, gym, dental, or psychotherapy." },
  { value: "snacks", label_en: "Snacks", label_es: "Snacks", emoji: "🥨", description: "Quick bites, coffee on the go, vending machines, or light food." },
  { value: "pets", label_en: "Pets", label_es: "Mascotas", emoji: "🐾", description: "Vet, pet food, toys, grooming, or pet supplies." },
  { value: "gifts", label_en: "Gifts", label_es: "Regalos", emoji: "🎁", description: "Buying presents for family, friends, or special occasions." },
  { value: "beauty", label_en: "Beauty", label_es: "Belleza", emoji: "💅", description: "Haircuts, cosmetics, spa, skincare, or aesthetic treatments." },
  { value: "education", label_en: "Education", label_es: "Educación", emoji: "📚", description: "Courses, books, tuition fees, workshops, or training." },
  { value: "travel", label_en: "Travel", label_es: "Viajes", emoji: "✈️", description: "Flights, hotels, vacation packages, and holiday expenses." },
  { value: "bills", label_en: "Bills", label_es: "Facturas", emoji: "📦", description: "Internet, phone, electricity, water, or other household utilities." },
  { value: "restaurants", label_en: "Restaurants", label_es: "Restaurantes", emoji: "🍽️", description: "Dining out, sit-down meals, food delivery (Deliveroo, JustEat)." },
  { value: "subscriptions", label_en: "Subscriptions", label_es: "Suscripciones", emoji: "📱", description: "Netflix, Spotify, recurring software, or digital services." },
  { value: "taxes", label_en: "Taxes", label_es: "Impuestos", emoji: "🏛️", description: "Income tax, property tax, VAT, or government fees/fines." },
  { value: "clothing", label_en: "Clothing", label_es: "Ropa", emoji: "👕", description: "Clothes, shoes, accessories, fashion items, or apparel. Use when user explicitly mentions clothing or fashion." },
  { value: "technology", label_en: "Technology", label_es: "Tecnología", emoji: "💻", description: "Electronics, gadgets, computers, phones, gaming consoles, software, or tech accessories. Use when user explicitly mentions tech/electronics." },
  { value: "gambling", label_en: "Gambling", label_es: "Apuestas", emoji: "🎰", description: "Bets, casino, lottery, sports betting, or gambling activities." },
  { value: "breakfast", label_en: "Breakfast", label_es: "Desayunos", emoji: "🥐", description: "Morning meals at a bakery or café. Use ONLY when user explicitly says 'breakfast' or 'desayuno'." },
  { value: "investment_transfer", label_en: "Investment Transfer", label_es: "Traspaso a Inversión", emoji: "💳", description: "Money transferred from balance to an investment account." },
  { value: "savings_contribution", label_en: "Savings Contribution", label_es: "Aportación a Hucha", emoji: "🐷", description: "Money transferred from balance to a specific savings pot." },
  { value: "other", label_en: "Other", label_es: "Otros", emoji: "❓", description: "Anything that doesn't fit the above specific categories." },
];

export const ALL_CATEGORIES: Category[] = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export function normalizeCategory(cat: string): string {
  if (!cat) return "other";
  return cat
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getCategoryLabel(value: string, lang: string): string {
  const normValue = normalizeCategory(value);
  const cat = ALL_CATEGORIES.find((c) => c.value === normValue);
  if (!cat) return value;
  return lang === "es" ? cat.label_es : cat.label_en;
}

export function getCategoryEmoji(value: string): string {
  const normValue = normalizeCategory(value);
  const cat = ALL_CATEGORIES.find((c) => c.value === normValue);
  return cat?.emoji ?? "💰";
}

// Ordered as specified: Acciones, Materias primas, Criptomonedas, ETF, Fondos,
// Renta fija, Crowdlending, Inmobiliario, Divisas, Cuentas
export const ASSET_TYPES = [
  { value: "stock",        label_en: "Stocks",        label_es: "Acciones",        emoji: "📈", group: "A" },
  { value: "commodity",    label_en: "Commodities",   label_es: "Materias primas", emoji: "🥇", group: "A" },
  { value: "crypto",       label_en: "Crypto",        label_es: "Criptomonedas",   emoji: "₿",  group: "A" },
  { value: "etf",          label_en: "ETFs",          label_es: "ETFs",            emoji: "🗂️", group: "A" },
  { value: "fund",         label_en: "Funds",         label_es: "Fondos",          emoji: "🏛️", group: "A" },
  { value: "fixedincome",  label_en: "Fixed Income",  label_es: "Renta fija",      emoji: "🏦", group: "B" },
  { value: "crowdlending", label_en: "Crowdlending",  label_es: "Crowdlending",    emoji: "🤝", group: "B" },
  { value: "realestate",   label_en: "Real Estate",   label_es: "Inmobiliario",    emoji: "🏠", group: "C" },
  { value: "forex",        label_en: "Forex",         label_es: "Divisas",         emoji: "💱", group: "C" },
  { value: "account",      label_en: "Accounts",      label_es: "Cuentas",         emoji: "💳", group: "B" },
] as const;

export type AssetType = (typeof ASSET_TYPES)[number]["value"];

// Tipos con precio de mercado actualizable automáticamente
export const PRICE_FETCH_ASSET_TYPES: AssetType[] = ["stock", "commodity", "crypto", "etf"];

// Grupo B: interés compuesto automático
export const GROUP_B_ASSET_TYPES: AssetType[] = ["fixedincome", "account", "crowdlending"];

export function getAssetTypeLabel(value: string, lang: string): string {
  const type = ASSET_TYPES.find((t) => t.value === value);
  if (!type) return value;
  return lang === "es" ? type.label_es : type.label_en;
}
