import pytest
from fastapi import HTTPException
from security.validator import inspect_for_credentials, sanitize_input_text


def test_password_rejection():
    """Verify that any payload containing a password key is rejected."""
    bad_payload = {
        "from_station": "NDLS",
        "irctc_password": "supersecretpassword123"
    }
    with pytest.raises(HTTPException) as exc_info:
        inspect_for_credentials(bad_payload)
    assert exc_info.value.status_code == 400
    assert "Security Violation" in exc_info.value.detail


def test_otp_rejection():
    """Verify that any payload containing an OTP key is rejected."""
    bad_payload = {
        "name": "Ramesh",
        "otp": "982341"
    }
    with pytest.raises(HTTPException) as exc_info:
        inspect_for_credentials(bad_payload)
    assert exc_info.value.status_code == 400


def test_pin_and_cvv_rejection():
    """Verify that any payment PIN or card CVV fields are rejected."""
    for key in ["upi_pin", "cvv", "card_cvc"]:
        with pytest.raises(HTTPException) as exc_info:
            inspect_for_credentials({"name": "Test", key: "123"})
        assert exc_info.value.status_code == 400


def test_malicious_script_tag_rejection():
    """Verify that XSS script tags in strings are rejected."""
    with pytest.raises(HTTPException) as exc_info:
        inspect_for_credentials("<script>alert('pwned')</script>")
    assert exc_info.value.status_code == 400


def test_html_sanitization():
    """Verify that harmless HTML tags are cleanly stripped."""
    raw = "<b>Rajdhani Express</b>"
    cleaned = sanitize_input_text(raw)
    assert cleaned == "Rajdhani Express"
