BUDGET_TOOLS = [
    {
        "name": "add_budget",
        "description": (
            "Create a new budget for a set of categories over a date period. "
            "Use only categories from the fixed list. "
            "A budget tracks spending (or income) against a target amount. "
            "Use type='expense' for spending budgets, type='income' for income targets."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "currency": {
                    "type": "string",
                    "description": "The 3-letter currency code (e.g. USD, EUR, GBP). MUST be specified if the user asks in a specific currency (e.g. '100€' -> EUR)."
                },
                "name": {
                    "type": "string",
                    "description": "A short descriptive name for the budget. Maximum 50 characters."
                },
                "type": {
                    "type": "string",
                    "enum": ["income", "expense"],
                    "description": "Whether this budget tracks expenses or income."
                },
                "amount": {
                    "type": "number",
                    "description": "The target amount for this budget (always positive)."
                },
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of category names this budget applies to."
                },
                "date_from": {
                    "type": "string",
                    "description": "Start date of the budget period in YYYY-MM-DD format (optional)."
                },
                "date_to": {
                    "type": "string",
                    "description": "End date of the budget period in YYYY-MM-DD format (optional)."
                },
                "recurrence": {
                    "type": "string",
                    "enum": ["daily", "weekly", "monthly", "yearly"],
                    "description": "How often this budget repeats. Default: 'monthly'."
                }
            },
            "required": ["name", "type", "amount", "categories"]
        }
    },
    {
        "name": "get_budgets",
        "description": (
            "Get all budgets the user has created. "
            "Call when the user asks about their budgets or budget progress."
        ),
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "update_budget",
        "description": (
            "Update an existing budget's name, amount, categories, or date range. "
            "If the user doesn't provide the budget ID, call get_budgets first to find it. "
            "Only include fields the user wants to change."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "currency": {
                    "type": "string",
                    "description": "The 3-letter currency code (e.g. USD, EUR, GBP). MUST be specified if the user asks in a specific currency (e.g. '100€' -> EUR)."
                },
                "budget_id": {
                    "type": "string",
                    "description": "The UUID or numeric ID (short_id) of the budget to update."
                },
                "name": {
                    "type": "string",
                    "description": "New name for the budget (optional). Maximum 50 characters."
                },
                "amount": {
                    "type": "number",
                    "description": "New target amount for the budget (optional, always positive)."
                },
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "New list of categories for this budget (optional)."
                },
                "date_from": {
                    "type": "string",
                    "description": "New start date in YYYY-MM-DD format (optional)."
                },
                "date_to": {
                    "type": "string",
                    "description": "New end date in YYYY-MM-DD format (optional)."
                },
                "recurrence": {
                    "type": "string",
                    "enum": ["daily", "weekly", "monthly", "yearly"],
                    "description": "New recurrence frequency (optional). Options: daily, weekly, monthly, yearly."
                }
            },
            "required": ["budget_id"]
        }
    },
    {
        "name": "delete_budget",
        "description": (
            "Delete a budget by its ID. "
            "If the user doesn't provide the ID, call get_budgets first to find it."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "budget_id": {
                    "type": "string",
                    "description": "The UUID or numeric ID (short_id) of the budget to delete."
                }
            },
            "required": ["budget_id"]
        }
    },
    {
        "name": "get_budget_history",
        "description": (
            "Get the history of archived or completed budget cycles. "
            "Returns a list of previous cycles with their spent amounts and performance. "
            "Each entry includes the original budget's short_id for reference."
        ),
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
]
