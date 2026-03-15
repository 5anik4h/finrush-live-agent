from .transaction_tools import TRANSACTION_TOOLS
from .investment_tools import INVESTMENT_TOOLS
from .budget_tools import BUDGET_TOOLS
from .savings_tools import SAVINGS_TOOLS
from .utility_tools import UTILITY_TOOLS
from .metrics_tools import METRICS_TOOLS

TOOLS_LIST = (
    TRANSACTION_TOOLS
    + INVESTMENT_TOOLS
    + BUDGET_TOOLS
    + SAVINGS_TOOLS
    + UTILITY_TOOLS
    + METRICS_TOOLS
)


def define_tools() -> list:
    """Return the full list of agent tool definitions.

    Maintains compatibility with live_agent.py which calls define_tools().
    """
    return TOOLS_LIST
