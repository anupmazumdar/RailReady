import re
from typing import Any, Dict
from fastapi import HTTPException

# Blacklisted sensitive keys and keywords that indicate credentials or financial secrets
PROHIBITED_KEYWORD_PATTERNS = [
    re.compile(r"pass(word|wd)?", re.IGNORECASE),
    re.compile(r"otp", re.IGNORECASE),
    re.compile(r"pin", re.IGNORECASE),
    re.compile(r"cvv", re.IGNORECASE),
    re.compile(r"cvc", re.IGNORECASE),
    re.compile(r"card_?num(ber)?", re.IGNORECASE),
    re.compile(r"bank(ing)?", re.IGNORECASE),
    re.compile(r"upi", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
]

# Patterns for 16-digit card numbers or typical OTP/PIN digits
SUSPICIOUS_VALUE_PATTERNS = [
    re.compile(r"^\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}$"), # Credit/debit card numbers
    re.compile(r"^\d{3,4}$"), # Standalone 3 or 4 digit numbers labeled as cvv/pin
]


def inspect_for_credentials(data: Any, path: str = ""):
    """
    Recursively inspect incoming request payloads.
    Strictly reject any payload that contains credential fields, OTPs, PINs, or payment details.
    """
    if isinstance(data, dict):
        for key, value in data.items():
            current_path = f"{path}.{key}" if path else key
            for pattern in PROHIBITED_KEYWORD_PATTERNS:
                if pattern.search(key):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Security Violation: Sensitive parameter '{key}' detected at '{current_path}'. "
                            "This application strictly forbids entering IRCTC passwords, OTPs, PINs, or banking details."
                        )
                    )
            inspect_for_credentials(value, current_path)
    elif isinstance(data, list):
        for index, item in enumerate(data):
            inspect_for_credentials(item, f"{path}[{index}]")
    elif isinstance(data, str):
        # Prevent script injection or malicious HTML payloads in user inputs
        if re.search(r"<\s*script[^>]*>", data, re.IGNORECASE):
            raise HTTPException(
                status_code=400,
                detail="Security Violation: Malicious script tags are prohibited in input data."
            )


def sanitize_input_text(text: str) -> str:
    """Sanitize string fields to prevent HTML injection."""
    if not text:
        return ""
    # Strip HTML tags
    cleaned = re.sub(r"<[^>]*>", "", text)
    return cleaned.strip()
