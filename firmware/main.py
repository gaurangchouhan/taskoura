"""
Taskoura BioLock - Hardware Main Entrypoint
Provides:
  - 5-second boot countdown to allow stopping auto-start
  - Auto-start BioLock service on boot
  - Interactive diagnostic menu for hardware testing
"""

import time
import sys
import config
import led
import fingerprint
import enroll
import verify
import device_client

def countdown_auto_start(window_sec=5):
    """
    Counts down window_sec seconds.
    If the user inputs a key/Enter, aborts auto-start and drops to menu.
    Returns True if auto-start should proceed, False if aborted.
    """
    if not config.AUTO_START:
        return False

    print("\n" + "=" * 60)
    print("  Taskoura BioLock ESP32-S2 Firmware Booting")
    print("  Auto-starting BioLock service in %d seconds..." % window_sec)
    print("  Press Enter or Ctrl+C to STOP and open interactive menu.")
    print("=" * 60)

    try:
        # Check non-blocking input if available
        import select
        for remaining in range(window_sec, 0, -1):
            sys.stdout.write("\rStarting in %d... [Press Enter to Cancel] " % remaining)
            if hasattr(sys.stdout, 'flush'):
                sys.stdout.flush()

            # Poll stdin for 1 second
            r, _, _ = select.select([sys.stdin], [], [], 1.0)
            if r:
                sys.stdin.readline()
                print("\n[BioLock] Auto-start cancelled by user. Entering menu.")
                return False

        print("\n[BioLock] Auto-start window elapsed. Launching service...")
        return True
    except (ImportError, Exception):
        # Fallback for environments without select
        time.sleep(1)
        return True

def print_menu():
    print("\n" + "=" * 48)
    print("       Taskoura BioLock Diagnostic Menu")
    print("=" * 48)
    print("  1. Ping Sensor & Read System Parameters")
    print("  2. Local Fingerprint Enrollment Test")
    print("  3. Local Fingerprint Verification Test")
    print("  4. Local Delete Template by Slot")
    print("  5. Empty All Sensor Templates (Danger)")
    print("  6. Run TLS Probe (HTTPS Connection & RAM)")
    print("  7. Run BioLock Service (Wi-Fi & Polling)")
    print("  8. Toggle Auto-Start on Boot (Current: %s)" % config.AUTO_START)
    print("  0. Exit to REPL")
    print("=" * 48)

def test_sensor():
    print("\n[Diag] Initializing sensor communication...")
    if fingerprint.init_sensor():
        print("[Diag] Sensor communication: OK (Password Verified)")
        code, count = fingerprint.template_count()
        if code == fingerprint.CONFIRM_OK:
            print("[Diag] Enrolled Templates in Flash: %d" % count)
        else:
            print("[Diag] Could not read template count (code 0x%02X)" % code)
        led.led_blink(2, 100)
    else:
        print("[Diag] Sensor communication: FAILED. Check wiring (TX/RX) and power.")
        led.led_blink(4, 50)

def main():
    led.led_init()

    # Check 5-second auto-start window
    if countdown_auto_start(config.AUTO_START_WINDOW_SEC):
        try:
            device_client.run()
            return
        except KeyboardInterrupt:
            print("\n[BioLock] Service stopped by user.")

    # Interactive diagnostic menu
    while True:
        print_menu()
        try:
            choice = input("Enter choice (0-8): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            break

        if choice == "1":
            test_sensor()
        elif choice == "2":
            enroll.enroll()
        elif choice == "3":
            verify.verify_finger()
        elif choice == "4":
            try:
                slot_str = input("Enter slot number to delete: ").strip()
                enroll.delete_slot(int(slot_str))
            except ValueError:
                print("Invalid slot number.")
        elif choice == "5":
            confirm = input("Are you sure you want to delete ALL templates? (yes/no): ").strip()
            if confirm.lower() == "yes":
                code = fingerprint.empty_database()
                if code == fingerprint.CONFIRM_OK:
                    print("Sensor database cleared successfully.")
                else:
                    print("Failed to clear database (code 0x%02X)" % code)
        elif choice == "6":
            try:
                import tls_probe
                tls_probe.run_probe()
            except ImportError:
                print("tls_probe module not available.")
        elif choice == "7":
            try:
                device_client.run()
            except KeyboardInterrupt:
                print("\n[BioLock] Service stopped by user.")
        elif choice == "8":
            config.AUTO_START = not config.AUTO_START
            print("Auto-start updated to: %s" % config.AUTO_START)
        elif choice == "0":
            print("Exiting to REPL.")
            break
        else:
            print("Invalid selection.")

if __name__ == "__main__":
    main()
