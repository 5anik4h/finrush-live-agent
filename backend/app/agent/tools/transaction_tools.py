TRANSACTION_TOOLS = [
    {
        "name": "add_transaction",
        "description": (
            "Add a new financial transaction (income or expense) to the user's records. "
            "IMPORTANT: Use only categories from the fixed list. "
            "Always confirm with the user before executing if the amount is large or unusual."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "currency": {
                    "type": "string",
                    "description": "3-letter currency code (USD, EUR, GBP). Pass the currency the user stated (e.g. '100 euros' -> EUR). Backend stores both original amount and USD equivalent."
                },
                "amount": {
                    "type": "number",
                    "description": "The monetary amount in the specified currency (always positive). Backend calculates the USD equivalent automatically."
                },
                "type": {
                    "type": "string",
                    "enum": ["income", "expense"],
                    "description": "Whether this is money coming in (income) or going out (expense)."
                },
                "category": {
                    "type": "string",
                    "description": (
                        "The category of the transaction. "
                        "Must be an existing category from the fixed list. "
                        "Do not create new categories."
                    )
                },
                "description": {
                    "type": "string",
                    "description": (
                        "A brief description of the transaction. "
                        "Maximum 50 characters. Written in the user's current language."
                    )
                },
                "date": {
                    "type": "string",
                    "description": "The date of the transaction in YYYY-MM-DD format. Defaults to today."
                }
            },
            "required": ["amount", "type", "category"]
        }
    },
    {
        "name": "get_balance",
        "description": (
            "Get the user's current overall balance (total income minus total expenses). "
            "Call when the user asks 'how much money do I have', 'what is my balance', etc."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "description": "Optional period: 'this month' or 'all time'."
                },
                "date_from": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format for a custom period."
                },
                "date_to": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format for a custom period."
                }
            }
        }
    },
    {
        "name": "get_transactions",
        "description": (
            "Get a list of the user's transactions, optionally filtered by category or date range. "
            "Call when the user asks to see their transactions, spending on a category, etc."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of transactions to return (1-100, default 10)."
                },
                "category": {
                    "type": "string",
                    "description": "Filter by category name (e.g. 'groceries', 'rent')."
                },
                "date_from": {
                    "type": "string",
                    "description": "Start date filter in YYYY-MM-DD format."
                },
                "date_to": {
                    "type": "string",
                    "description": "End date filter in YYYY-MM-DD format."
                }
            }
        }
    },
    {
        "name": "get_spending_summary",
        "description": (
            "Get a breakdown of the user's expenses grouped by category for a period. "
            "Call when the user asks 'where is my money going', 'spending summary', etc."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "enum": ["this month", "all time"],
                    "description": "Time period for the summary. Defaults to 'this month'. Ignored if date ranges are provided."
                },
                "date_from": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format for a custom period."
                },
                "date_to": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format for a custom period."
                }
            }
        }
    },
    {
        "name": "delete_transaction",
        "description": (
            "Delete a transaction by its short ID. "
            "IMPORTANT: If the user doesn't provide the ID, use 'get_transactions' first "
            "to find the correct transaction, then call this tool."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {
                    "type": "integer",
                    "description": "The short numeric ID of the transaction to delete (shown as '#' in the dashboard)."
                }
            },
            "required": ["transaction_id"]
        }
    },
    {
        "name": "update_transaction",
        "description": (
            "Update an existing transaction's amount, category, or description. "
            "IMPORTANT: Use only categories from the fixed list."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "currency": {
                    "type": "string",
                    "description": "3-letter currency code (USD, EUR, GBP). Pass the currency the user stated. Backend stores both original amount and USD equivalent."
                },
                "transaction_id": {
                    "type": "integer",
                    "description": "The short numeric ID of the transaction to update."
                },
                "amount": {
                    "type": "number",
                    "description": "The new monetary amount (optional)."
                },
                "type": {
                    "type": "string",
                    "enum": ["income", "expense"],
                    "description": "The new type (income/expense) (optional)."
                },
                "category": {
                    "type": "string",
                    "description": "The new category (optional). Must be from the fixed list."
                },
                "description": {
                    "type": "string",
                    "description": "The new description (optional). Maximum 50 characters."
                },
                "date": {
                    "type": "string",
                    "description": "The new date in YYYY-MM-DD format (optional)."
                }
            },
            "required": ["transaction_id"]
        }
    },
    {
        "name": "search_transactions",
        "description": (
            "Search transactions by free-text description using partial matching. "
            "Use when the user asks to find transactions containing specific words "
            "(e.g. 'find all Uber transactions', 'show me expenses with Netflix', "
            "'find insurance payments'). "
            "Complements get_transactions which filters by category/date. "
            "Returns matching transactions sorted by date (most recent first)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "Free-text search string to match against transaction descriptions "
                        "(case-insensitive, partial match). E.g. 'uber', 'netflix', 'insurance'."
                    )
                },
                "category": {
                    "type": "string",
                    "description": "Optional: also filter by category (e.g. 'transport', 'subscriptions')."
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default 20, max 100)."
                }
            },
            "required": ["query"]
        }
    },
]
