import requests
from bs4 import BeautifulSoup
import re
import logging
import time

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class StockScraper:
    """Scraper for fetching stock prices from screener.in using HTTP requests (no browser needed)"""

    BASE_URL = "https://www.screener.in"
    SEARCH_URL = "https://www.screener.in/api/company/search/"

    def __init__(self, headless=False):  # headless param kept for backward compatibility
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        })
        # Prime the session with a homepage visit to collect cookies
        try:
            self.session.get(self.BASE_URL, timeout=10)
            log.info("Session initialized with screener.in cookies")
        except Exception as e:
            log.warning(f"Could not prime session: {e}")

    def scrape_stock_price(self, company_name: str) -> dict:
        """
        Fetch the current stock price for a given company from screener.in.

        Args:
            company_name (str): Name of the company to search (e.g. "Tata Steel")

        Returns:
            dict: { company_name, price, success, error }
        """
        try:
            # ── Step 1: Search for company ─────────────────────────────────
            search_resp = self.session.get(
                self.SEARCH_URL,
                params={"q": company_name, "v": "3", "fts": "1"},
                headers={
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": self.BASE_URL + "/",
                },
                timeout=15,
            )
            search_resp.raise_for_status()
            results = search_resp.json()

            if not results:
                return {
                    "company_name": company_name,
                    "price": None,
                    "success": False,
                    "error": f'No company found matching "{company_name}" on screener.in',
                }

            company = results[0]
            company_url = self.BASE_URL + company["url"]
            found_name = company.get("name", company_name)
            log.info(f"Found: {found_name} → {company_url}")

            # ── Step 2: Fetch company page ──────────────────────────────────
            page_resp = self.session.get(
                company_url,
                headers={"Referer": self.BASE_URL + "/"},
                timeout=20,
            )
            page_resp.raise_for_status()

            soup = BeautifulSoup(page_resp.text, "html.parser")
            price = self._extract_price(soup)

            if price is None:
                return {
                    "company_name": found_name,
                    "price": None,
                    "success": False,
                    "error": "Could not extract current price from screener.in page",
                }

            log.info(f"Price for {found_name}: ₹{price}")
            return {
                "company_name": found_name,
                "price": price,
                "success": True,
                "error": None,
            }

        except requests.exceptions.ConnectionError as e:
            return {"company_name": company_name, "price": None, "success": False,
                    "error": f"Connection error reaching screener.in: {e}"}
        except requests.exceptions.Timeout:
            return {"company_name": company_name, "price": None, "success": False,
                    "error": "Request to screener.in timed out — try again shortly"}
        except requests.exceptions.HTTPError as e:
            return {"company_name": company_name, "price": None, "success": False,
                    "error": f"HTTP error from screener.in: {e}"}
        except Exception as e:
            log.error(f"Unexpected error scraping {company_name}: {e}")
            return {"company_name": company_name, "price": None, "success": False, "error": str(e)}

    def _extract_price(self, soup: BeautifulSoup):
        """
        Parse current price from a screener.in company HTML page.

        Screener.in shows the current price in the top-ratios section:
          <ul id="top-ratios">
            <li>
              <span class="name">Current Price</span>
              <span class="nowrap"><span class="number">₹ 141.25</span></span>
            </li>
            ...
          </ul>
        """
        try:
            # ── Method 1: top-ratios list — most reliable ──────────────────
            top_ratios = soup.find("ul", id="top-ratios")
            if top_ratios:
                for li in top_ratios.find_all("li"):
                    name_span = li.find("span", class_="name")
                    if name_span and "Current Price" in name_span.get_text():
                        number_span = li.find("span", class_="number")
                        if number_span:
                            raw = number_span.get_text(strip=True)
                            cleaned = re.sub(r"[₹,\s]", "", raw)
                            # handle ranges like "141 / 148" → take first
                            cleaned = cleaned.split("/")[0].strip()
                            return float(cleaned)

            # ── Method 2: first .number span that is a reasonable price ────
            for span in soup.find_all("span", class_="number"):
                text = re.sub(r"[₹,\s]", "", span.get_text(strip=True))
                text = text.split("/")[0].strip()
                try:
                    val = float(text)
                    if 0.5 < val < 1_000_000:  # sane Indian stock price range
                        return val
                except ValueError:
                    continue

            return None

        except Exception as e:
            log.error(f"Error extracting price: {e}")
            return None

    def scrape_multiple_stocks(self, company_names: list) -> list:
        """
        Scrape prices for multiple companies with a small delay between requests.

        Args:
            company_names (list): List of company name strings

        Returns:
            list: List of result dicts
        """
        results = []
        for i, name in enumerate(company_names):
            result = self.scrape_stock_price(name)
            results.append(result)
            if i < len(company_names) - 1:
                time.sleep(1)  # polite delay between requests
        return results


if __name__ == "__main__":
    scraper = StockScraper(headless=False)
    result = scraper.scrape_stock_price("Tata Steel")
    print(result)
