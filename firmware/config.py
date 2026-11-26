"""
Taskoura BioLock - Hardware Configuration
Target Hardware: ESP32-S2 with GROW / Synochip R307 / R307S Optical Fingerprint Sensor.
"""

# ==============================================================================
# 1. HARDWARE PIN CONFIGURATION (ESP32-S2)
# ==============================================================================
# Hardware UART mapping for R307S sensor
UART_ID = 1
TX_PIN = 17       # ESP32-S2 GPIO 17 -> Sensor RX (Green wire)
RX_PIN = 18       # ESP32-S2 GPIO 18 -> Sensor TX (White wire)
BAUD_RATE = 57600 # Default R307/R307S baud rate

# Onboard status / activity LED
LED_PIN = 15      # Built-in or external indicator LED

# Sensor Communication Parameters
SENSOR_ADDRESS = 0xFFFFFFFF  # Default broadcast address
SENSOR_PASSWORD = 0x00000000 # Default factory password

# ==============================================================================
# 2. OPERATIONAL & NETWORK TIMINGS
# ==============================================================================
POLL_INTERVAL_SEC = 3        # Standard job poll interval (CONTRACT: every 3s)
RETRY_AFTER_DEFAULT_SEC = 3  # Default wait on HTTP 429 if header missing
MAX_ERROR_BACKOFF_SEC = 30   # Maximum exponential backoff on network errors
LEASE_SAFETY_MARGIN_SEC = 5  # Stop processing if lease has < 5s remaining

# NTP Time Synchronization
NTP_HOST = "pool.ntp.org"
NTP_SYNC_INTERVAL_HOURS = 4  # Periodic re-synchronization

# Failure Recovery & Watchdog
MAX_CONSECUTIVE_FAILURES = 10 # Trigger watchdog reset after N persistent failures
ENABLE_WATCHDOG = True       # Enable hardware WDT if supported
WATCHDOG_TIMEOUT_SEC = 60    # WDT timeout period

# Boot & Service Execution
AUTO_START = True            # Auto-start BioLock service on boot
AUTO_START_WINDOW_SEC = 5    # Grace window to press Stop / enter menu

# Cache Protection
RECENT_JOBS_MAX = 10         # Prevent duplicate job execution (remember last 10)
