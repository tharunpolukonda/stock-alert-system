import os
import logging
from supabase import create_client, Client
from scraper import StockScraper
from datetime import datetime
from typing import List, Dict

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class AlertEngine:
    """Engine for checking stock prices against user alerts and triggering notifications"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """
        Initialize the alert engine
        
        Args:
            supabase_url: Supabase project URL
            supabase_key: Supabase service role key
        """
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.scraper = StockScraper()
    
    def get_active_alerts(self) -> List[Dict]:
        """
        Fetch all active alerts from database
        
        Returns:
            List of active alert configurations
        """
        try:
            response = self.supabase.table('user_alerts')\
                .select('*, stocks(*), user_profiles(*)')\
                .eq('is_active', True)\
                .execute()
            
            return response.data
        except Exception as e:
            log.error(f"Error fetching active alerts: {str(e)}")
            return []
    
    def check_alert_condition(self, current_price: float, baseline_price: float, 
                            gain_threshold: float, loss_threshold: float) -> Dict:
        """
        Check if alert condition is met
        
        Args:
            current_price: Current stock price
            baseline_price: Baseline price set by user
            gain_threshold: Gain threshold percentage (e.g., 10.0)
            loss_threshold: Loss threshold percentage (e.g., 5.0)
            
        Returns:
            Dict with alert status and details
        """
        percent_change = ((current_price - baseline_price) / baseline_price) * 100
        
        alert_triggered = False
        alert_type = None
        
        if percent_change >= gain_threshold:
            alert_triggered = True
            alert_type = "GAIN"
        elif percent_change <= -loss_threshold:
            alert_triggered = True
            alert_type = "LOSS"
        
        return {
            'triggered': alert_triggered,
            'type': alert_type,
            'percent_change': percent_change,
            'current_price': current_price,
            'baseline_price': baseline_price
        }
    
    def save_price_history(self, stock_id: str, price: float):
        """
        Save price data to history table
        
        Args:
            stock_id: Stock UUID
            price: Current price
        """
        try:
            self.supabase.table('price_history').insert({
                'stock_id': stock_id,
                'price': price,
                'recorded_at': datetime.utcnow().isoformat()
            }).execute()
            
            log.info(f"Saved price history for stock {stock_id}: {price}")
        except Exception as e:
            log.error(f"Error saving price history: {str(e)}")
    
    def log_alert(self, alert_id: str, user_id: str, stock_id: str, 
                  trigger_price: float, baseline_price: float, 
                  percent_change: float, alert_type: str, message: str):
        """
        Log triggered alert to database
        
        Args:
            alert_id: Alert UUID
            user_id: User UUID
            stock_id: Stock UUID
            trigger_price: Price that triggered the alert
            baseline_price: Baseline price
            percent_change: Percentage change
            alert_type: Type of alert (GAIN/LOSS)
            message: Alert message
        """
        try:
            self.supabase.table('alert_logs').insert({
                'alert_id': alert_id,
                'user_id': user_id,
                'stock_id': stock_id,
                'trigger_price': trigger_price,
                'baseline_price': baseline_price,
                'percent_change': percent_change,
                'alert_type': alert_type,
                'message': message,
                'triggered_at': datetime.utcnow().isoformat()
            }).execute()
            
            log.info(f"Logged alert for user {user_id}: {message}")
        except Exception as e:
            log.error(f"Error logging alert: {str(e)}")
    
    def process_alerts(self) -> List[Dict]:
        """
        Main method to process all active alerts
        
        Returns:
            List of triggered alerts
        """
        log.info("Starting alert processing...")
        
        active_alerts = self.get_active_alerts()
        log.info(f"Found {len(active_alerts)} active alerts")
        
        triggered_alerts = []
        
        for alert in active_alerts:
            try:
                company_name = alert['stocks']['company_name']
                stock_id = alert['stock_id']
                
                # Scrape current price
                log.info(f"Checking price for {company_name}")
                scrape_result = self.scraper.scrape_stock_price(company_name)
                
                if not scrape_result['success']:
                    log.error(f"Failed to scrape {company_name}: {scrape_result['error']}")
                    continue
                
                current_price = scrape_result['price']
                
                # Save price history
                self.save_price_history(stock_id, current_price)
                
                # Check alert condition
                alert_check = self.check_alert_condition(
                    current_price,
                    float(alert['baseline_price']),
                    float(alert['gain_threshold_percent']),
                    float(alert['loss_threshold_percent'])
                )
                
                if alert_check['triggered']:
                    alert_info = {
                        'alert_id': alert['id'],
                        'user_id': alert['user_id'],
                        'stock_id': stock_id,
                        'company_name': company_name,
                        'alert_type': alert_check['type'],
                        'current_price': current_price,
                        'baseline_price': float(alert['baseline_price']),
                        'percent_change': alert_check['percent_change'],
                        'user_email': alert['user_profiles']['email']
                    }
                    
                    triggered_alerts.append(alert_info)
                    
                    # Log the alert
                    message = f"{company_name} {alert_check['type']}: {alert_check['percent_change']:.2f}% change"
                    self.log_alert(
                        alert['id'],
                        alert['user_id'],
                        stock_id,
                        current_price,
                        float(alert['baseline_price']),
                        alert_check['percent_change'],
                        alert_check['type'],
                        message
                    )
                    
                    log.info(f"Alert triggered: {message}")
            
            except Exception as e:
                log.error(f"Error processing alert {alert.get('id', 'unknown')}: {str(e)}")
                continue
        
        log.info(f"Alert processing complete. {len(triggered_alerts)} alerts triggered.")
        return triggered_alerts


if __name__ == "__main__":
    # Test the alert engine
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        log.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
    else:
        engine = AlertEngine(supabase_url, supabase_key)
        triggered = engine.process_alerts()
        print(f"Triggered alerts: {len(triggered)}")
