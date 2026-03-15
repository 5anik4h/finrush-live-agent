UTILITY_TOOLS = [
    {
        "name": "get_market_price",
        "description": (
            "Get the current market price for a stock, ETF, crypto, or commodity ticker. "
            "Does NOT modify any data — purely informational. "
            "Call when the user asks 'how much is X worth', 'what's the price of Y', etc."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "The ticker symbol (e.g. AAPL, BTC, GC=F)."
                },
                "asset_type": {
                    "type": "string",
                    "enum": ["stock", "etf", "crypto", "commodity"],
                    "description": "The type of asset to look up."
                }
            },
            "required": ["ticker", "asset_type"]
        }
    },
    {
        "name": "get_all_categories",
        "description": (
            "Get the list of categories the user has used so far. "
            "Call this when the user asks what categories they have, "
            "or before suggesting a category for a new transaction."
        ),
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_exchange_rates",
        "description": (
            "Get the latest exchange rates for currencies versus the USD."
        ),
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "update_all_investment_prices",
        "description": (
            "Update the current market price for all the user's investments that have a valid ticker. "
            "Use this to refresh the portfolio valuation before reporting to the user. "
            "Only call for Group A assets (stock/crypto/etf/commodity) after user adds/sells or explicitly asks."
        ),
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
]
