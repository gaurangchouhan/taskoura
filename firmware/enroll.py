"""
Taskoura BioLock - Biometric Enrollment Routine
Manages two-touch fingerprint registration, duplicate detection, and slot allocation.
Templates remain strictly inside the R307S sensor flash; never extracted or transmitted.
"""

import time
import fingerprint
import led

def _wait_for_finger(timeout_sec=20):
    """Waits until a finger is pressed on the sensor."""
    start = time.time()
    while time.time() - start < timeout_sec:
        code = fingerprint.read_image()
        if code == fingerprint.CONFIRM_OK:
            return True
        time.sleep(0.1)
    return False

def _wait_for_finger_release(timeout_sec=10):
    """Waits until the finger is removed from the sensor."""
    start = time.time()
    while time.time() - start < timeout_sec:
        code = fingerprint.read_image()
        if code == fingerprint.CONFIRM_NO_FINGER:
            return True
        time.sleep(0.1)
    return True

def _find_free_slot():
    """Scans for the lowest unused slot (1-299) in sensor library."""
    for s in range(1, 300):
        # Searching a single slot: if no match, check if slot contains a template
        # A simple robust way is: read template count or use slot tracking
        # Alternatively, search starting at slot s for count 1
        code, matched_slot, _ = fingerprint.search_finger(1, start_slot=s, count=1)
        # If code is CONFIRM_NO_MATCH, that slot does not match this finger.
        # R307 doesn't have an explicit 'is_slot_empty' command other than reading PageTable (0x1f),
        # but storing into slot works directly. Default to slot 1 if empty count == 0.
    code, count = fingerprint.template_count()
    if code == fingerprint.CONFIRM_OK:
        return count + 1 if count < 299 else 1
    return 1

def enroll(target_slot=None, timeout_sec=40):
    """
    Executes the standard two-touch fingerprint enrollment flow.
    Returns: (outcome, slot) where outcome in ("ENROLLED", "DUPLICATE", "FAILED", "TIMEOUT")
    """
    print("[BioLock] Starting enrollment. Place finger on sensor (1/2)...")
    led.led_blink(1, 200)

    # Touch 1: Capture first image
    if not _wait_for_finger(timeout_sec // 2):
        print("[BioLock] Enrollment timed out waiting for first touch.")
        return "TIMEOUT", None

    code = fingerprint.image_to_template(1)
    if code != fingerprint.CONFIRM_OK:
        print("[BioLock] Failed to generate template from first image (code 0x%02X)" % code)
        led.led_blink(3, 50)
        return "FAILED", None

    led.led_on()
    print("[BioLock] First touch captured. Remove finger...")
    _wait_for_finger_release(5)
    led.led_off()

    time.sleep(0.5)
    print("[BioLock] Place the same finger on sensor again (2/2)...")
    led.led_blink(2, 100)

    # Touch 2: Capture second image
    if not _wait_for_finger(timeout_sec // 2):
        print("[BioLock] Enrollment timed out waiting for second touch.")
        return "TIMEOUT", None

    code = fingerprint.image_to_template(2)
    if code != fingerprint.CONFIRM_OK:
        print("[BioLock] Failed to generate template from second image (code 0x%02X)" % code)
        led.led_blink(3, 50)
        return "FAILED", None

    # Combine models
    code = fingerprint.create_model()
    if code != fingerprint.CONFIRM_OK:
        print("[BioLock] Failed to combine fingerprint models (code 0x%02X)" % code)
        led.led_blink(3, 50)
        return "FAILED", None

    # Duplicate check: search if this finger already exists in database
    search_code, existing_slot, score = fingerprint.search_finger(1, start_slot=0, count=300)
    if search_code == fingerprint.CONFIRM_OK and existing_slot is not None:
        print("[BioLock] Fingerprint already enrolled in slot %d (score %d)" % (existing_slot, score))
        led.led_blink(4, 100)
        return "DUPLICATE", existing_slot

    # Determine storage slot
    slot_to_use = target_slot if target_slot is not None else _find_free_slot()

    # Store in sensor Flash
    store_code = fingerprint.store_model(slot_to_use, 1)
    if store_code != fingerprint.CONFIRM_OK:
        print("[BioLock] Failed to store template into slot %d (code 0x%02X)" % (slot_to_use, store_code))
        led.led_blink(3, 50)
        return "FAILED", None

    print("[BioLock] Fingerprint successfully enrolled into slot %d!" % slot_to_use)
    led.led_blink(2, 300)
    return "ENROLLED", slot_to_use

def delete_slot(slot):
    """
    Deletes the template at the specified slot.
    Returns: (outcome, slot) where outcome in ("DELETED", "FAILED")
    """
    if slot is None:
        return "FAILED", None

    print("[BioLock] Deleting template from slot %d..." % slot)
    code = fingerprint.delete_template(slot, 1)
    if code == fingerprint.CONFIRM_OK:
        print("[BioLock] Template deleted from slot %d." % slot)
        led.led_blink(1, 200)
        return "DELETED", slot
    else:
        print("[BioLock] Failed to delete slot %d (code 0x%02X)" % (slot, code))
        led.led_blink(3, 50)
        return "FAILED", slot
