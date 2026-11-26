"""
Taskoura BioLock - Hardware Device Secrets Template
Copy this file to 'device_secrets.py' and fill in your actual credentials.

CRITICAL SECURITY RULES:
1. 'device_secrets.py' MUST NEVER be committed to Git (it is in .gitignore).
2. NEVER share or log your DEVICE_KEY. It is shown ONCE in Taskoura when registered.
3. PIN overrides are NOT allowed in this file. Hardware GPIO pins must stay in config.py.
"""

# Wi-Fi Credentials
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

# Taskoura Backend Base URL (No trailing slash)
# For local development / demo: "http://192.168.1.100:8080"
# For production: "https://taskoura.onrender.com"
BASE_URL = "http://192.168.1.100:8080"

# Registered Device ID (UUID string)
DEVICE_ID = "00000000-0000-0000-0000-000000000000"

# One-time Device Key derived from Master Key (64-character lowercase hex string)
DEVICE_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
