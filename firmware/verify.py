"""
Taskoura BioLock - Verification Routine
Waits for the Project Leader to verify their physical fingerprint on the R307S sensor.
Provides slow-blinking LED feedback while waiting for finger interaction.
"""

import time
import fingerprint
import led

def verify_expected(expected_slot, timeout_sec=60, check_cancelled=None):
    """
    Waits for the leader's fingerprint with slow LED blinking.
    Compares the captured print against the expected enrolled slot.

    Outcomes:
      "MATCH": Finger verified and matched expectedSlot.
      "WRONG_FINGER": Finger recognized in sensor flash, but belonging to a different slot.
      "NO_MATCH": Finger not recognized in sensor flash.
      "TIMEOUT": Job expired or leader did not touch sensor in time.
      "CANCELLED": Job was cancelled remotely.
      "FAILED": Hardware communication or capture failure.
    """
    print("[BioLock] Waiting for Project Leader fingerprint (expected slot %s, timeout %ds)..." % (expected_slot, timeout_sec))
    start_time = time.time()
    last_blink_time = 0
    blink_state = False

    while (time.time() - start_time) < timeout_sec:
        # Check if job was cancelled or expired
        if check_cancelled is not None and check_cancelled():
            led.led_off()
            print("[BioLock] Verification cancelled.")
            return "CANCELLED", None

        # Slow-blink LED (toggle every 500 ms) while waiting
        now = time.time()
        if now - last_blink_time >= 0.5:
            blink_state = not blink_state
            led.led_set(blink_state)
            last_blink_time = now

        # Poll sensor for finger presence
        code = fingerprint.read_image()
        if code == fingerprint.CONFIRM_OK:
            # Finger detected! Turn LED solid on
            led.led_on()
            print("[BioLock] Finger detected! Analyzing...")

            # Convert image to template in CharBuffer1
            tz_code = fingerprint.image_to_template(1)
            if tz_code != fingerprint.CONFIRM_OK:
                print("[BioLock] Image quality low or invalid (code 0x%02X)" % tz_code)
                led.led_blink(3, 50)
                return "FAILED", None

            # Search sensor database for matching template
            search_code, matched_slot, score = fingerprint.search_finger(1, start_slot=0, count=300)

            led.led_off()

            if search_code == fingerprint.CONFIRM_OK and matched_slot is not None:
                print("[BioLock] Match found in slot %d (score %d)" % (matched_slot, score))
                if expected_slot is not None and matched_slot == int(expected_slot):
                    print("[BioLock] SUCCESS: Leader fingerprint confirmed for slot %d!" % matched_slot)
                    led.led_blink(2, 250)
                    return "MATCH", matched_slot
                else:
                    print("[BioLock] MISMATCH: Finger matched slot %d but expected %s" % (matched_slot, expected_slot))
                    led.led_blink(4, 50)
                    return "WRONG_FINGER", matched_slot

            elif search_code == fingerprint.CONFIRM_NO_MATCH:
                print("[BioLock] REJECTED: Fingerprint not found in sensor database.")
                led.led_blink(3, 100)
                return "NO_MATCH", None
            else:
                print("[BioLock] Search failed with code 0x%02X" % search_code)
                led.led_blink(3, 50)
                return "FAILED", None

        time.sleep(0.05)

    led.led_off()
    print("[BioLock] Verification timed out.")
    return "TIMEOUT", None

def verify_finger(timeout_sec=20):
    """Local standalone verification test."""
    return verify_expected(expected_slot=None, timeout_sec=timeout_sec)
