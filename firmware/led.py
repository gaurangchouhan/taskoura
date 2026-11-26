"""
Taskoura BioLock - LED Indicator Driver
Provides visual feedback for hardware events, errors, and finger prompt waiting.
"""

import time
import config

_led_pin = None

def led_init():
    """Initializes the LED pin. Falls back gracefully on host CPython."""
    global _led_pin
    try:
        import machine
        _led_pin = machine.Pin(config.LED_PIN, machine.Pin.OUT)
        _led_pin.value(0)
    except (ImportError, AttributeError):
        _led_pin = None

def led_on():
    """Turns the indicator LED on."""
    if _led_pin is not None:
        try:
            _led_pin.value(1)
        except Exception:
            pass

def led_off():
    """Turns the indicator LED off."""
    if _led_pin is not None:
        try:
            _led_pin.value(0)
        except Exception:
            pass

def led_blink(times=2, delay_ms=100):
    """Flashes the LED quickly for feedback or errors."""
    for _ in range(times):
        led_on()
        time.sleep_ms(delay_ms) if hasattr(time, 'sleep_ms') else time.sleep(delay_ms / 1000.0)
        led_off()
        time.sleep_ms(delay_ms) if hasattr(time, 'sleep_ms') else time.sleep(delay_ms / 1000.0)

def led_set(state):
    """Sets the LED directly (1=on, 0=off)."""
    if state:
        led_on()
    else:
        led_off()
