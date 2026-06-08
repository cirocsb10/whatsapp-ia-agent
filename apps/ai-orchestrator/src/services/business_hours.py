from datetime import datetime


_DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def is_business_open(business_hours: dict | None) -> bool:
    """Return True if the current local time falls within the configured business hours."""
    if not business_hours or not isinstance(business_hours, dict):
        return True

    now = datetime.now()
    day_key = _DAY_NAMES[now.weekday()]
    day_cfg = business_hours.get(day_key)

    if not day_cfg or not isinstance(day_cfg, dict):
        return True

    if not day_cfg.get("enabled", False):
        return False

    try:
        start_h, start_m = map(int, day_cfg["start"].split(":"))
        end_h, end_m = map(int, day_cfg["end"].split(":"))
    except (KeyError, ValueError):
        return True

    current_minutes = now.hour * 60 + now.minute
    start_minutes = start_h * 60 + start_m
    end_minutes = end_h * 60 + end_m

    return start_minutes <= current_minutes < end_minutes
