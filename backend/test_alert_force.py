import os
import logging
from alert_engine import AlertEngine
from discord_notifier import DiscordNotifier
from dotenv import load_dotenv

# Load env variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

def main():
    print("Force Test: Starting...")
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    discord_webhook = os.getenv("DISCORD_WEBHOOK_URL")
    
    if not discord_webhook:
        print("Error: DISCORD_WEBHOOK_URL is missing!")
        return

    print("Initializing Engine...")
    engine = AlertEngine(supabase_url, supabase_key)
    
    print("Processing Alerts (Ignoring Market Hours)...")
    triggered_alerts = engine.process_alerts()
    
    if triggered_alerts:
        print(f"Triggered {len(triggered_alerts)} alerts!")
        notifier = DiscordNotifier(discord_webhook)
        count = notifier.send_batch_alerts(triggered_alerts)
        print(f"Sent {count} notifications to Discord.")
    else:
        print("No alerts triggered. check if your gain/loss thresholds are met.")

if __name__ == "__main__":
    main()
