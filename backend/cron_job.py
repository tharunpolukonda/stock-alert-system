import os
import logging
from datetime import datetime
import pytz
from alert_engine import AlertEngine
from discord_notifier import DiscordNotifier

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)


def is_market_open():
    """
    Check if Indian stock market is currently open
    Market hours: Monday-Friday, 9:30 AM - 3:30 PM IST
    
    Returns:
        bool: True if market is open, False otherwise
    """
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    
    # Check if it's a weekday (Monday=0, Sunday=6)
    if now.weekday() >= 5:  # Saturday or Sunday
        log.info(f"Market closed: Weekend (Day {now.weekday()})")
        return False
    
    # Check if within market hours (9:30 AM - 3:30 PM)
    market_open_time = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close_time = now.replace(hour=15, minute=30, second=0, microsecond=0)
    
    if market_open_time <= now <= market_close_time:
        log.info(f"Market is OPEN - Current time: {now.strftime('%H:%M:%S IST')}")
        return True
    else:
        log.info(f"Market closed: Outside trading hours - Current time: {now.strftime('%H:%M:%S IST')}")
        return False


def main():
    """Main cron job function"""
    log.info("=" * 60)
    log.info("Stock Alert Cron Job Started")
    log.info("=" * 60)
    
    # Check if market is open
    if not is_market_open():
        log.info("Skipping alert check - market is closed")
        return
    
    # Get environment variables
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    discord_webhook = os.getenv("DISCORD_WEBHOOK_URL")
    
    # Validate environment variables
    if not supabase_url:
        log.error("SUPABASE_URL environment variable not set")
        return
    
    if not supabase_key:
        log.error("SUPABASE_SERVICE_KEY environment variable not set")
        return
    
    if not discord_webhook:
        log.error("DISCORD_WEBHOOK_URL environment variable not set")
        return
    
    try:
        # Initialize alert engine
        log.info("Initializing alert engine...")
        engine = AlertEngine(supabase_url, supabase_key)
        
        # Process alerts
        log.info("Processing alerts...")
        triggered_alerts = engine.process_alerts()
        
        # Send Discord notifications
        if triggered_alerts:
            log.info(f"Sending {len(triggered_alerts)} Discord notifications...")
            notifier = DiscordNotifier(discord_webhook)
            
            success_count = notifier.send_batch_alerts(triggered_alerts)
            log.info(f"Successfully sent {success_count}/{len(triggered_alerts)} notifications")
        else:
            log.info("No alerts triggered")
        
        log.info("=" * 60)
        log.info("Stock Alert Cron Job Completed Successfully")
        log.info("=" * 60)
    
    except Exception as e:
        log.error(f"Error in cron job: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
