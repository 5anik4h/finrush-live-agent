INVESTMENT_TOOLS = [
    {
        "name": "add_investment",
        "description": (
            "Add a new investment to the portfolio. Supports 10 asset types in 3 groups.\n\n"
            "CURRENCY RULE (CRITICAL): All monetary amounts (buy_price, total_amount, quantity for Group B/forex) "
            "MUST be in the user's currently selected currency from RUNTIME USER CONTEXT. "
            "NEVER send USD amounts when the user has EUR or GBP selected. "
            "Always set 'currency' to match the user's selected currency.\n\n"
            "GROUP A (tradeable, live price updates): stock, commodity, crypto, etf.\n"
            "Required: name, asset_type. Provide quantity OR total_amount (not both required). "
            "buy_price is optional — if omitted, fetched live and converted to user's currency automatically.\n\n"
            "GROUP B (interest-bearing, unified schema): fixedincome, account, crowdlending.\n"
            "Required: name, total_amount (principal/capital), extra.apy. "
            "Optional: extra.frequency (daily/weekly/monthly/quarterly/annual), extra.reinvest (bool), extra.end_date.\n"
            "NOTE: When reinvest=true, a periodic income transaction (investment_return) is created automatically each period by a scheduled job.\n\n"
            "GROUP C (special):\n"
            "- fund: name, quantity, buy_price, optional extra.current_value, extra.ter.\n"
            "- realestate: name, extra.estimated_value, extra.purchase_price, extra.pending_mortgage, extra.monthly_rent. "
            "NO balance transaction is created for real estate (equity tracked separately in net worth).\n"
            "NOTE: When monthly_rent>0, a monthly income transaction (investment_return) is created automatically on day 1 of each month by a scheduled job.\n"
            "- forex: name, quantity (deposit amount), currency (deposit currency)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "asset_type": {
                    "type": "string",
                    "enum": ["stock", "commodity", "crypto", "etf", "fund",
                             "fixedincome", "crowdlending", "realestate", "forex", "account"],
                    "description": (
                        "stock=Acciones, commodity=Materias primas, crypto=Criptomonedas, "
                        "etf=ETF, fund=Fondos, fixedincome=Renta fija, "
                        "crowdlending=Crowdlending, realestate=Inmobiliario, "
                        "forex=Divisas, account=Cuentas remuneradas"
                    )
                },
                "ticker": {
                    "type": "string",
                    "description": "Ticker symbol (e.g. TSLA, ETH, XAUUSD). Required for Group A."
                },
                "name": {
                    "type": "string",
                    "description": "Display name or descriptive label. Required."
                },
                "quantity": {
                    "type": "number",
                    "description": (
                        "Number of units/shares (Group A, fund). "
                        "Also used as the deposit amount for forex. "
                        "Alternative to total_amount for Group A."
                    )
                },
                "buy_price": {
                    "type": "number",
                    "description": (
                        "Purchase price per unit in user's selected currency. "
                        "For Group A: optional (fetched live if omitted). "
                        "For fund: price per unit/participación."
                    )
                },
                "total_amount": {
                    "type": "number",
                    "description": (
                        "Total amount in user's selected currency. "
                        "For Group A: alternative to quantity (derives quantity from price). "
                        "For Group B: this IS the principal/capital amount."
                    )
                },
                "currency": {
                    "type": "string",
                    "description": (
                        "MUST match the user's currently selected currency (USD/EUR/GBP). "
                        "Read from RUNTIME USER CONTEXT. Backend stores original + USD equivalent automatically."
                    )
                },
                "date": {
                    "type": "string",
                    "description": "Purchase/start date in YYYY-MM-DD format (optional, defaults to today)."
                },
                "extra": {
                    "type": "object",
                    "description": (
                        "Type-specific fields:\n"
                        "fund: {current_value, ter}\n"
                        "fixedincome/account/crowdlending: {apy, frequency, reinvest (bool), end_date}\n"
                        "realestate: {estimated_value, pending_mortgage, monthly_rent, purchase_price}\n"
                        "No extra fields needed for stock/crypto/etf/commodity/forex."
                    )
                }
            },
            "required": ["asset_type", "name"]
        }
    },
    {
        "name": "get_investments",
        "description": (
            "Get all investment positions across all 10 asset types. "
            "Returns unified list with current value, invested amount, and P&L (or accrued interest for Group B). "
            "Call when the user asks about their portfolio, total value, or specific holdings."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "asset_type": {
                    "type": "string",
                    "enum": ["stock", "commodity", "crypto", "etf", "fund",
                             "fixedincome", "crowdlending", "realestate", "forex", "account"],
                    "description": "Optional: filter by asset type. If omitted, returns all types."
                }
            }
        }
    },
    {
        "name": "update_investment",
        "description": (
            "Update an existing investment position. "
            "If the user doesn't provide the ID, call get_investments first.\n\n"
            "CURRENCY RULE: All monetary amounts must be in user's selected currency. "
            "Include 'currency' field if the user changes currency — this re-denominates the position.\n\n"
            "Group A (stock/crypto/etf/commodity): quantity, buy_price, current_price, ticker, name, date.\n"
            "Fund: quantity, buy_price, current_value, ter, name, date.\n"
            "Group B (fixedincome/account/crowdlending): quantity (principal/capital), apy, frequency, "
            "accumulated_interest, reinvest, start_date, end_date.\n"
            "Real estate: estimated_value, pending_mortgage, monthly_rent, purchase_price.\n"
            "Forex: quantity (deposit amount), currency, name."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "investment_id": {
                    "type": "integer",
                    "description": "The short numeric ID of the investment to update."
                },
                "asset_type": {
                    "type": "string",
                    "enum": ["stock", "commodity", "crypto", "etf", "fund",
                             "fixedincome", "crowdlending", "realestate", "forex", "account"],
                    "description": "Asset type (needed to find the correct table)."
                },
                "quantity": {
                    "type": "number",
                    "description": (
                        "New quantity/units (Group A, fund). "
                        "New principal/capital amount for Group B (replaces old principal/capital). "
                        "New deposit amount for forex."
                    )
                },
                "buy_price": {
                    "type": "number",
                    "description": "New purchase price per unit (Group A, fund). In user's selected currency."
                },
                "current_price": {
                    "type": "number",
                    "description": "New current market price override (Group A). In user's selected currency."
                },
                "current_value": {
                    "type": "number",
                    "description": "New total current value (fund only). In user's selected currency."
                },
                "ter": {
                    "type": "number",
                    "description": "TER/management fee % (fund only)."
                },
                "name": {
                    "type": "string",
                    "description": "New display name."
                },
                "ticker": {
                    "type": "string",
                    "description": "Correct/update the ticker symbol (Group A)."
                },
                "date": {
                    "type": "string",
                    "description": "New date in YYYY-MM-DD format."
                },
                "apy": {
                    "type": "number",
                    "description": "New APY % (Group B: fixedincome, account, crowdlending)."
                },
                "frequency": {
                    "type": "string",
                    "description": "New compounding frequency: daily|weekly|monthly|quarterly|annual (Group B)."
                },
                "accumulated_interest": {
                    "type": "number",
                    "description": "Override accumulated interest (Group B, use to manually correct)."
                },
                "reinvest": {
                    "type": "boolean",
                    "description": "Enable/disable interest reinvestment (Group B)."
                },
                "start_date": {
                    "type": "string",
                    "description": "New start date YYYY-MM-DD (Group B)."
                },
                "end_date": {
                    "type": "string",
                    "description": "New maturity/end date YYYY-MM-DD (fixedincome, crowdlending)."
                },
                "estimated_value": {
                    "type": "number",
                    "description": "New estimated market value (realestate). In user's selected currency."
                },
                "pending_mortgage": {
                    "type": "number",
                    "description": "Remaining mortgage/debt (realestate). In user's selected currency."
                },
                "monthly_rent": {
                    "type": "number",
                    "description": "Monthly rental income (realestate). Set to 0 to stop rent tracking."
                },
                "purchase_price": {
                    "type": "number",
                    "description": "Original purchase price (realestate). In user's selected currency."
                },
                "currency": {
                    "type": "string",
                    "description": (
                        "New currency (USD/EUR/GBP). Include ONLY if user explicitly changes currency. "
                        "This re-denominates the position and updates rate_at_entry."
                    )
                }
            },
            "required": ["investment_id", "asset_type"]
        }
    },
    {
        "name": "delete_investment",
        "description": (
            "Delete an investment position by its short ID and asset type. "
            "If the user doesn't provide the ID, call get_investments first."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "investment_id": {
                    "type": "integer",
                    "description": "The short numeric ID of the investment to delete."
                },
                "asset_type": {
                    "type": "string",
                    "enum": ["stock", "commodity", "crypto", "etf", "fund",
                             "fixedincome", "crowdlending", "realestate", "forex", "account"],
                    "description": "Asset type (needed to find the correct table)."
                }
            },
            "required": ["investment_id", "asset_type"]
        }
    },
    {
        "name": "sell_investment",
        "description": (
            "Sell (partially or fully) a GROUP A investment ONLY (stock/commodity/crypto/etf). "
            "GROUP A ONLY — for all other types, use delete_investment:\n"
            "  - fund → delete_investment (no income transaction)\n"
            "  - fixedincome/account/crowdlending (Group B) → delete_investment (no income transaction)\n"
            "  - realestate → delete_investment (no income transaction)\n"
            "  - forex → delete_investment (no income transaction)\n"
            "Reduces quantity on partial sell; deletes position on full sell. "
            "Creates an income transaction with category 'investment_return'. "
            "Call get_investments first if user doesn't provide the ID."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "investment_id": {
                    "type": "integer",
                    "description": "The short numeric ID of the investment to sell."
                },
                "asset_type": {
                    "type": "string",
                    "enum": ["stock", "commodity", "crypto", "etf", "fund",
                             "fixedincome", "crowdlending", "realestate", "forex", "account"],
                    "description": "Asset type."
                },
                "quantity": {
                    "type": "number",
                    "description": "Units to sell. If omitted, sells the entire position."
                },
                "sale_price": {
                    "type": "number",
                    "description": (
                        "Price per unit at sale. If omitted for Group A, fetches live price. "
                        "For Group B, defaults to stored current value."
                    )
                }
            },
            "required": ["investment_id", "asset_type"]
        }
    },
]
