import logging
from typing import Dict, Any

logger = logging.getLogger("tatkal_notifications")

NOTIFICATION_MILESTONES = {
    900: "15 minutes until Tatkal opening. Please review your passenger details and login to IRCTC manually.",
    600: "10 minutes until Tatkal opening. Make sure your payment method is ready.",
    300: "5 minutes until Tatkal opening! Prepare to search for your train on the official IRCTC portal.",
    60: "1 minute remaining! Tatkal window opens in 60 seconds.",
    0: "Tatkal booking window should now be open. Please open/use IRCTC manually."
}


def get_notification_for_seconds(seconds_left: int) -> Dict[str, Any]:
    """
    Returns notification details if seconds_left matches a milestone threshold.
    """
    # Threshold window within 2 seconds
    for milestone, message in NOTIFICATION_MILESTONES.items():
        if abs(seconds_left - milestone) <= 1:
            return {
                "triggered": True,
                "milestone": milestone,
                "title": "Tatkal Booking Alert",
                "message": message,
                "sound": True
            }

    return {"triggered": False}
