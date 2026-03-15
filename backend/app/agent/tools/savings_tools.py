SAVINGS_TOOLS = [
    {
        "name": "add_savings_pot",
        "description": (
            "Create a new savings pot for the user. "
            "A savings pot is a goal-based container for saving money toward a target. "
            "The user can optionally set a target amount."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "currency": {
                    "type": "string",
                    "description": "The 3-letter currency code (e.g. USD, EUR, GBP) if specified."
                },
                "name": {
                    "type": "string",
                    "description": "Name of the savings pot (e.g. 'Emergency Fund', 'Japan Trip')."
                },
                "target_amount": {
                    "type": "number",
                    "description": "Optional target/goal amount for this pot. Omit for open-ended saving."
                }
            },
            "required": ["name"]
        }
    },
    {
        "name": "get_savings_pots",
        "description": (
            "Get all savings pots for the user. "
            "Returns name, balance, target, and recent contributions. "
            "Call when the user asks about their savings pots or savings goals."
        ),
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "update_savings_pot",
        "description": (
            "Update a savings pot's name or target amount. "
            "Use get_savings_pots first if the user doesn't provide the pot ID."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "currency": {
                    "type": "string",
                    "description": "The 3-letter currency code (e.g. USD, EUR, GBP) if specified."
                },
                "pot_id": {
                    "type": "string",
                    "description": "The UUID or numeric ID (short_id) of the savings pot to update."
                },
                "name": {
                    "type": "string",
                    "description": "New name for the pot (optional)."
                },
                "target_amount": {
                    "type": "number",
                    "description": "New target amount (optional). Use 0 or null to remove the target."
                }
            },
            "required": ["pot_id"]
        }
    },
    {
        "name": "delete_savings_pot",
        "description": (
            "Delete a savings pot and all its contribution history. "
            "WARNING: This also removes all contribution records for this pot. "
            "Use get_savings_pots first if the user doesn't provide the pot ID."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "pot_id": {
                    "type": "string",
                    "description": "The UUID or numeric ID (short_id) of the savings pot to delete."
                }
            },
            "required": ["pot_id"]
        }
    },
    {
        "name": "add_savings_contribution",
        "description": (
            "Deposit money into a savings pot. "
            "This ALSO creates an expense transaction with category 'savings_contribution' "
            "in the user's balance to reflect the cash outflow. "
            "Use get_savings_pots first if the user doesn't provide the pot ID."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "currency": {
                    "type": "string",
                    "description": "The 3-letter currency code (e.g. USD, EUR, GBP) if specified."
                },
                "pot_id": {
                    "type": "string",
                    "description": "The UUID or numeric ID (short_id) of the savings pot to deposit into."
                },
                "amount": {
                    "type": "number",
                    "description": "The amount to deposit (must be positive)."
                },
                "note": {
                    "type": "string",
                    "description": "Optional note for this contribution."
                },
                "date": {
                    "type": "string",
                    "description": "Date in YYYY-MM-DD format. Defaults to today."
                }
            },
            "required": ["pot_id", "amount"]
        }
    },
    {
        "name": "withdraw_from_savings",
        "description": (
            "Withdraw money from a savings pot back to the user's balance. "
            "This ALSO creates an income transaction with category 'savings_withdrawal' "
            "in the user's balance to reflect the cash inflow. "
            "The withdrawal amount cannot exceed the pot's current balance. "
            "Use get_savings_pots first if the user doesn't provide the pot ID."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "currency": {
                    "type": "string",
                    "description": "The 3-letter currency code (e.g. USD, EUR, GBP) if specified."
                },
                "pot_id": {
                    "type": "string",
                    "description": "The UUID or numeric ID (short_id) of the savings pot to withdraw from."
                },
                "amount": {
                    "type": "number",
                    "description": "The amount to withdraw (must be positive)."
                },
                "note": {
                    "type": "string",
                    "description": "Optional note for this withdrawal."
                },
                "date": {
                    "type": "string",
                    "description": "Date in YYYY-MM-DD format. Defaults to today."
                }
            },
            "required": ["pot_id", "amount"]
        }
    },
]
