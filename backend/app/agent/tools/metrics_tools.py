METRICS_TOOLS = [
    {
        "name": "get_financial_summary",
        "description": (
            "Get the user's complete financial overview — all KPIs pre-computed and ready in the user's currency. "
            "Returns: net_worth, balance, investment_value, savings_total, "
            "month_income, month_expenses, month_net, total_income, total_expenses, "
            "total_invested, total_current_value, total_pnl, total_pnl_pct, "
            "savings_rate_pct, savings_this_month, savings_best_month, savings_active_pots. "
            "ALWAYS call this tool when the user asks any of: "
            "'What is my net worth / patrimonio?', 'How much do I have?', "
            "'What's my balance / balance total?', 'How much have I invested?', "
            "'What are my savings?', 'What's my financial situation?', "
            "'Give me a summary of my finances', 'How am I doing financially?'. "
            "These values are IDENTICAL to what the user sees in the dashboard — use them verbatim."
        ),
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_chart_data",
        "description": (
            "Get pre-computed chart data for a specific chart in the dashboard. "
            "All monetary values are returned in the user's configured currency. "
            "This data matches exactly what the user sees in the app charts. "
            "\n\nAvailable chart_types and when to use them:"
            "\n- 'wealth_evolution': 12-month series of net_worth, balance, investment, savings. "
            "Use when: 'How has my wealth evolved?', 'Show me my patrimony over time', 'How did I do last year?'"
            "\n- 'balance_by_category_expense': Spending breakdown by category (all time, excluding transfers). "
            "Use when: 'How much have I spent on X?', 'What's my biggest expense category?', "
            "'How much on subscriptions/food/transport?'"
            "\n- 'balance_by_category_income': Income breakdown by category (all time). "
            "Use when: 'What are my income sources?', 'How much salary vs freelance?'"
            "\n- 'investment_by_type': Current value, invested amount, and PnL per asset type. "
            "Use when: 'How is each investment type performing?', 'How much in stocks vs crypto?', "
            "'Which asset type has the best return?'"
            "\n- 'savings_monthly': Monthly contributions and withdrawals for last 12 months. "
            "Use when: 'How much did I save each month?', 'When did I save the most?'"
            "\n- 'savings_cumulative': Cumulative net savings over last 12 months. "
            "Use when: 'How has my total savings grown?', 'Am I saving consistently?'"
            "\n- 'budget_progress': Current cycle progress for each active budget. "
            "Use when: 'How am I doing with my budgets?', 'Am I over budget on X?', "
            "'How much left in my X budget?'"
            "\n- 'savings_pot_progress': Balance and progress for each savings pot/hucha. "
            "Use when: 'How close am I to my savings goal?', 'How much in each pot?'"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "enum": [
                        "wealth_evolution",
                        "balance_by_category_expense",
                        "balance_by_category_income",
                        "investment_by_type",
                        "savings_monthly",
                        "savings_cumulative",
                        "budget_progress",
                        "savings_pot_progress",
                    ],
                    "description": "The chart to retrieve data for."
                }
            },
            "required": ["chart_type"]
        }
    },
]
