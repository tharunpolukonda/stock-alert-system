import requests
import logging
from typing import Dict, List

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class DiscordNotifier:
    """Send notifications to Discord via webhook"""
    
    def __init__(self, webhook_url: str):
        """
        Initialize Discord notifier
        
        Args:
            webhook_url: Discord webhook URL
        """
        self.webhook_url = webhook_url
    
    def send_alert(self, alert_info: Dict) -> bool:
        """
        Send alert notification to Discord
        
        Args:
            alert_info: Dictionary containing alert details
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Determine color based on alert type
            color = 0x00FF00 if alert_info['alert_type'] == 'GAIN' else 0xFF0000
            
            # Determine emoji
            emoji = "📈" if alert_info['alert_type'] == 'GAIN' else "📉"
            
            # Format percentage change
            percent_change = alert_info['percent_change']
            percent_str = f"+{percent_change:.2f}%" if percent_change > 0 else f"{percent_change:.2f}%"
            
            # Create rich embed message
            embed = {
                "title": f"{emoji} Stock Alert: {alert_info['company_name']}",
                "description": f"**{alert_info['alert_type']} Alert Triggered!**",
                "color": color,
                "fields": [
                    {
                        "name": "Current Price",
                        "value": f"₹{alert_info['current_price']:,.2f}",
                        "inline": True
                    },
                    {
                        "name": "Baseline Price",
                        "value": f"₹{alert_info['baseline_price']:,.2f}",
                        "inline": True
                    },
                    {
                        "name": "Change",
                        "value": percent_str,
                        "inline": True
                    }
                ],
                "footer": {
                    "text": f"Alert for {alert_info.get('user_email', 'user')}"
                },
                "timestamp": None  # Discord will use current time
            }
            
            payload = {
                "embeds": [embed]
            }
            
            response = requests.post(self.webhook_url, json=payload)
            
            if response.status_code == 204:
                log.info(f"Successfully sent Discord notification for {alert_info['company_name']}")
                return True
            else:
                log.error(f"Failed to send Discord notification. Status: {response.status_code}")
                return False
        
        except Exception as e:
            log.error(f"Error sending Discord notification: {str(e)}")
            return False
    
    def send_batch_alerts(self, alerts: List[Dict]) -> int:
        """
        Send multiple alerts to Discord
        
        Args:
            alerts: List of alert dictionaries
            
        Returns:
            int: Number of successfully sent alerts
        """
        success_count = 0
        
        for alert in alerts:
            if self.send_alert(alert):
                success_count += 1
        
        return success_count
    
    def send_summary(self, total_alerts: int, triggered_alerts: int):
        """
        Send summary message to Discord
        
        Args:
            total_alerts: Total number of active alerts checked
            triggered_alerts: Number of alerts triggered
        """
        try:
            embed = {
                "title": "📊 Stock Alert Summary",
                "description": "Hourly alert check completed",
                "color": 0x3498db,
                "fields": [
                    {
                        "name": "Total Alerts Checked",
                        "value": str(total_alerts),
                        "inline": True
                    },
                    {
                        "name": "Alerts Triggered",
                        "value": str(triggered_alerts),
                        "inline": True
                    }
                ]
            }
            
            payload = {"embeds": [embed]}
            requests.post(self.webhook_url, json=payload)
            
        except Exception as e:
            log.error(f"Error sending summary: {str(e)}")


if __name__ == "__main__":
    # Test the notifier
    import os
    
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    
    if webhook_url:
        notifier = DiscordNotifier(webhook_url)
        
        # Test alert
        test_alert = {
            'company_name': 'Tata Steel Ltd',
            'alert_type': 'GAIN',
            'current_price': 165.50,
            'baseline_price': 150.00,
            'percent_change': 10.33,
            'user_email': 'test@example.com'
        }
        
        notifier.send_alert(test_alert)
    else:
        print("DISCORD_WEBHOOK_URL not set")
