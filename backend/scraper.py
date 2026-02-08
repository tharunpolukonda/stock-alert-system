from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import logging
import os

# logging setup
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class StockScraper:
    """Scraper for fetching stock prices from screener.in"""
    
    def __init__(self, headless=False):
        """
        Initialize the scraper
        
        Args:
            headless (bool): Run browser in headless mode (for GitHub Actions)
        """
        self.headless = headless
        self.driver = None
    
    def _setup_driver(self):
        """Setup Chrome driver with appropriate options"""
        chrome_options = Options()
        
        if self.headless:
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
        
        chrome_options.add_argument('--window-size=1920,1080')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.maximize_window()
    
    def scrape_stock_price(self, company_name):
        """
        Scrape stock price for a given company
        
        Args:
            company_name (str): Name of the company to search
            
        Returns:
            dict: {
                'company_name': str,
                'price': float,
                'success': bool,
                'error': str (if any)
            }
        """
        try:
            self._setup_driver()
            
            log.info(f"Scraping price for: {company_name}")
            
            # Navigate to screener.in
            self.driver.get("https://www.screener.in/")
            
            wait = WebDriverWait(self.driver, 20)
            
            # 1️⃣ Search company
            search_box = wait.until(
                EC.element_to_be_clickable((
                    By.XPATH,
                    "(//div[contains(@class,'home-search')]//input[@data-company-search='true'])[1]"
                ))
            )
            
            self.driver.execute_script(f"""
                const input = arguments[0];
                input.focus();
                input.value = '{company_name}';
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
            """, search_box)
            
            time.sleep(2)
            search_box.send_keys(Keys.ENTER)
            
            # 2️⃣ WAIT for company page value to load
            market_cap_span = wait.until(
                EC.visibility_of_element_located((
                    By.XPATH,
                    "//div[contains(@class,'font-size-18') and contains(@class,'strong')]//span"
                ))
            )
            
            # 3️⃣ Extract text
            raw_value = market_cap_span.text  # ₹ 3,124
            clean_value = raw_value.replace("₹", "").replace(",", "").strip()
            
            # 4️⃣ Log output
            log.info(f"{company_name} Market Cap Value: {clean_value}")
            
            price_float = float(clean_value)
            
            return {
                'company_name': company_name,
                'price': price_float,
                'success': True,
                'error': None
            }
            
        except Exception as e:
            log.error(f"Error scraping {company_name}: {str(e)}")
            return {
                'company_name': company_name,
                'price': None,
                'success': False,
                'error': str(e)
            }
        
        finally:
            if self.driver:
                time.sleep(2)
                self.driver.quit()
    
    def scrape_multiple_stocks(self, company_names):
        """
        Scrape prices for multiple companies
        
        Args:
            company_names (list): List of company names
            
        Returns:
            list: List of result dictionaries
        """
        results = []
        for company_name in company_names:
            result = self.scrape_stock_price(company_name)
            results.append(result)
            time.sleep(3)  # Rate limiting between requests
        
        return results


if __name__ == "__main__":
    # Test the scraper
    scraper = StockScraper(headless=False)
    result = scraper.scrape_stock_price("Tata Steel Ltd")
    print(result)
