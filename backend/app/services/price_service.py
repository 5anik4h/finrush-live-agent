import asyncio
import logging
import os
import random

import httpx

_FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")

logger = logging.getLogger("finvoice")

# Well-known ticker aliases for Yahoo Finance / global markets.
# Keys are what the user types (uppercase); values are the Yahoo Finance symbol.
_TICKER_ALIASES: dict[str, str] = {
    # ── Commodities / Metals (Yahoo Finance futures) ──────────────────────
    "GOLD": "GC=F",
    "XAU": "GC=F",
    "XAUUSD": "GC=F",
    "SILVER": "SI=F",
    "XAG": "SI=F",
    "XAGUSD": "SI=F",
    "PLATINUM": "PL=F",
    "XPT": "PL=F",
    "XPTUSD": "PL=F",
    "PALLADIUM": "PA=F",
    "OIL": "CL=F",
    "WTI": "CL=F",
    "CRUDE": "CL=F",
    "BRENT": "BZ=F",
    "NATGAS": "NG=F",
    "GAS": "NG=F",
    "WHEAT": "ZW=F",
    "CORN": "ZC=F",
    "SOYBEANS": "ZS=F",
    "COPPER": "HG=F",
    "COFFEE": "KC=F",
    "SUGAR": "SB=F",
    "COCOA": "CC=F",
    # ── Spanish stocks (BME) ────────────────────────────────────────────────
    "ITX": "ITX.MC",    # Inditex
    "SAN": "SAN.MC",    # Santander
    "BBVA": "BBVA.MC",  # BBVA
    "TEF": "TEF.MC",    # Telefonica
    "IBE": "IBE.MC",    # Iberdrola
    "REP": "REP.MC",    # Repsol
    "AMS": "AMS.MC",    # Amadeus
    "FER": "FER.MC",    # Ferrovial
    "CLNX": "CLNX.MC",  # Cellnex
    "MAP": "MAP.MC",    # Mapfre
    "ELE": "ELE.MC",    # Endesa
    "ACS": "ACS.MC",    # ACS
    "ACX": "ACX.MC",    # Acerinox
    "AENA": "AENA.MC",  # AENA
    "MEL": "MEL.MC",    # Melia Hotels
    # ── German stocks (XETRA) ────────────────────────────────────────────────
    "SAP": "SAP.DE",
    "ADS": "ADS.DE",    # Adidas
    "BMW": "BMW.DE",
    "MBG": "MBG.DE",    # Mercedes-Benz
    "DAI": "MBG.DE",
    "VOW": "VOW3.DE",   # VW
    "ALV": "ALV.DE",    # Allianz
    "DTE": "DTE.DE",    # Deutsche Telekom
    "SIE": "SIE.DE",    # Siemens
    "BAS": "BAS.DE",    # BASF
    "BAY": "BAYN.DE",   # Bayer
    "DBK": "DBK.DE",    # Deutsche Bank
    "MRK": "MRK.DE",    # Merck KGaA
    # ── Dutch stocks (AMS) ─────────────────────────────────────────────────
    "ASML": "ASML.AS",
    "PHIA": "PHIA.AS",  # Philips
    "UNA": "UNA.AS",    # Unilever NL
    "INGA": "INGA.AS",  # ING
    "HEIA": "HEIA.AS",  # Heineken
    # ── French stocks (EPA) ─────────────────────────────────────────────────
    "LVMH": "MC.PA",
    "AIR": "AIR.PA",    # Airbus
    "TTE": "TTE.PA",    # TotalEnergies
    "BNP": "BNP.PA",
    "SAN.PA": "SAN.PA", # Sanofi
    "OR": "OR.PA",      # L'Oreal
    "CAP": "CAP.PA",    # Capgemini
    # ── UK stocks (LSE) ─────────────────────────────────────────────────────
    "SHEL": "SHEL.L",   # Shell
    "AZN": "AZN.L",     # AstraZeneca
    "HSBA": "HSBA.L",   # HSBC
    "BP": "BP.L",       # BP
    "VOD": "VOD.L",     # Vodafone
    "BARC": "BARC.L",   # Barclays
    "LLOY": "LLOY.L",   # Lloyds
    "RIO": "RIO.L",     # Rio Tinto
    "GSK": "GSK.L",     # GSK
    "UL": "ULVR.L",     # Unilever UK
    # ── Italian stocks ─────────────────────────────────────────────────────
    "ENI": "ENI.MI",
    "ENEL": "ENEL.MI",
    "ISP": "ISP.MI",    # Intesa
    "UCG": "UCG.MI",    # UniCredit
}

# Rotate User-Agent strings to reduce GCP IP blocking by Yahoo Finance
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
]


def _yf_headers() -> dict:
    """Return Yahoo Finance headers with a random User-Agent."""
    return {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Origin": "https://finance.yahoo.com",
        "Referer": "https://finance.yahoo.com/",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }


async def _fetch_yahoo(symbol: str) -> float | None:
    """
    Fetch price from Yahoo Finance (Plan A).
    Tries v8 API first across query1/query2, then v7 as fallback.
    Returns price in USD or None if all attempts fail.
    """
    urls_v8 = [
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d",
        f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d",
    ]
    urls_v7 = [
        f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbol}",
        f"https://query2.finance.yahoo.com/v7/finance/quote?symbols={symbol}",
    ]

    async with httpx.AsyncClient(headers=_yf_headers(), timeout=8.0, follow_redirects=True) as client:
        # Try v8 URLs
        for url in urls_v8:
            try:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    result = data.get("chart", {}).get("result", [])
                    if result:
                        price = result[0].get("meta", {}).get("regularMarketPrice")
                        if price is not None:
                            logger.debug("Price fetched for %s: %s (yahoo v8)", symbol, price)
                            return float(price)
                elif res.status_code in (429, 401, 403):
                    logger.warning("Yahoo v8 blocked (%s) for %s — switching to v7", res.status_code, symbol)
                    await asyncio.sleep(0.5)
                    break
            except Exception as e:
                logger.debug("Yahoo v8 attempt failed for %s: %s", symbol, e)

        # Try v7 URLs
        for url in urls_v7:
            try:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    result = data.get("quoteResponse", {}).get("result", [])
                    if result:
                        price = result[0].get("regularMarketPrice")
                        if price is not None:
                            logger.debug("Price fetched for %s: %s (yahoo v7)", symbol, price)
                            return float(price)
                elif res.status_code in (429, 401, 403):
                    logger.warning("Yahoo v7 also blocked (%s) for %s", res.status_code, symbol)
                    await asyncio.sleep(0.5)
                    break
            except Exception as e:
                logger.debug("Yahoo v7 attempt failed for %s: %s", symbol, e)

    logger.warning("All Yahoo Finance endpoints failed for %s", symbol)
    return None


async def _fetch_finnhub(symbol: str) -> float | None:
    """
    Fetch price from Finnhub (Plan B).
    Requires FINNHUB_API_KEY env var. Falls back to 'demo' token if not set (very limited).
    Free tier: 60 req/min. Returns price in USD or None if it fails.
    Note: Finnhub uses exchange suffixes for non-US stocks (e.g. ITX for BME, not ITX.MC).
    """
    token = _FINNHUB_API_KEY or "demo"
    if not _FINNHUB_API_KEY:
        logger.warning("FINNHUB_API_KEY not set — using demo token (very limited)")
    url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={token}"
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": random.choice(_USER_AGENTS)})
            if res.status_code == 200:
                data = res.json()
                price = data.get("c")  # 'c' = current price
                if price and float(price) > 0:
                    logger.debug("Price fetched for %s: %s (finnhub)", symbol, price)
                    return float(price)
            elif res.status_code == 403:
                logger.warning("Finnhub 403 for %s — API key may be invalid or rate limited", symbol)
    except Exception as e:
        logger.debug("Finnhub attempt failed for %s: %s", symbol, e)
    return None


async def _fetch_stooq(ticker: str) -> float | None:
    """
    Fetch price from Stooq (Plan C).
    Free, no API key required. Good coverage for European stocks and some US tickers.
    Stooq does not support commodity futures (=F symbols).
    Returns price in local currency of the exchange (no currency conversion done here).
    """
    normalized = ticker.upper().strip()
    # Stooq does not support futures symbols (GC=F, SI=F, etc.)
    if "=F" in normalized:
        return None
    # Stooq uses lowercase symbols with exchange suffixes (e.g. itx.mc, asml.as)
    stooq_symbol = normalized.lower()
    # Stooq CSV endpoint: fields = symbol, date, time, open, high, low, close, volume
    url = f"https://stooq.com/q/l/?s={stooq_symbol}&f=sd2t2ohlcv&h&e=csv"
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": random.choice(_USER_AGENTS)})
            if res.status_code == 200:
                lines = res.text.strip().split("\n")
                if len(lines) >= 2:
                    parts = lines[1].split(",")
                    # CSV: Symbol,Date,Time,Open,High,Low,Close,Volume
                    if len(parts) >= 7:
                        close_str = parts[6].strip()
                        if close_str and close_str not in ("N/D", "N/A", ""):
                            try:
                                price = float(close_str)
                                if price > 0:
                                    logger.debug("Price fetched for %s: %s (stooq)", ticker, price)
                                    return price
                            except ValueError:
                                pass
    except Exception as e:
        logger.debug("Stooq attempt failed for %s: %s", ticker, e)
    return None


def get_ticker_currency(symbol: str) -> str:
    """
    Infer the native currency of a ticker symbol from its exchange suffix.

    Rules (by Yahoo Finance / Stooq suffix):
      *.MC  → EUR  (BME - Bolsa de Madrid)
      *.DE  → EUR  (XETRA - Frankfurt)
      *.PA  → EUR  (Euronext Paris)
      *.AS  → EUR  (Euronext Amsterdam)
      *.MI  → EUR  (Borsa Italiana)
      *.L   → GBP  (London Stock Exchange)
      =F    → USD  (Futures - always priced in USD)
      -USD  → USD  (Crypto vs USD pair)
      Everything else → USD  (US exchanges: NYSE, NASDAQ, etc.)
    """
    s = symbol.upper()
    if s.endswith(".MC") or s.endswith(".DE") or s.endswith(".PA") or \
       s.endswith(".AS") or s.endswith(".MI"):
        return "EUR"
    if s.endswith(".L"):
        return "GBP"
    # Futures (GC=F, CL=F, …) and crypto (*-USD) are always USD
    return "USD"


async def fetch_current_price(ticker: str, asset_type: str = "stock") -> float | None:
    """
    Fetch current market price using Plan A → Plan B → Plan C fallback chain.

    Plan A: Yahoo Finance (multiple URL patterns + User-Agent rotation + ticker aliases)
    Plan B: Finnhub free tier
    Plan C: Stooq (European stocks, global coverage, no API key)
    Plan D (agent): Google Search → update_investment() — handled in system_prompt.py

    Ticker aliases (_TICKER_ALIASES dict) map common names like GOLD, ITX, SAP to their
    Yahoo Finance equivalents (GC=F, ITX.MC, SAP.DE).

    Returns price in USD (for US/crypto assets) or local currency for non-US stocks.
    """
    normalized = ticker.upper().strip()

    # Apply alias mapping first (e.g. GOLD → GC=F, ITX → ITX.MC)
    if normalized in _TICKER_ALIASES:
        symbol = _TICKER_ALIASES[normalized]
        logger.info("Ticker alias applied: %s → %s", normalized, symbol)
    elif asset_type == "crypto":
        # Crypto: append -USD suffix if not already present
        symbol = f"{normalized}-USD" if not normalized.endswith("-USD") else normalized
    else:
        symbol = normalized

    # Plan A: Yahoo Finance
    price = await _fetch_yahoo(symbol)
    if price is not None:
        return price

    # Plan B: Finnhub (uses original ticker without exchange suffix, works best for US)
    logger.info("Yahoo Finance failed for %s — trying Finnhub (Plan B)", symbol)
    price = await _fetch_finnhub(normalized)
    if price is not None:
        return price

    # Plan C: Stooq (good for European stocks; skips futures automatically)
    logger.info("Finnhub failed for %s — trying Stooq (Plan C)", normalized)
    price = await _fetch_stooq(symbol)
    if price is not None:
        return price

    logger.warning("All price sources failed for %s (asset_type=%s)", ticker, asset_type)
    return None
