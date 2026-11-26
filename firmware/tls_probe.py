"""
Taskoura BioLock - ESP32-S2 TLS Probe & Memory Diagnostics
Validates:
  1. System Clock / NTP Time Synchronization (required for X.509 validity checking)
  2. Free RAM before and after TLS handshake (ESP32-S2 memory footprint)
  3. HTTPS connection to BASE_URL (taskoura.onrender.com)
  4. Root CA Certificate Verification (GlobalSign Root CA / GTS Root R4)

SECURITY DISCLOSURE:
If the MicroPython build or memory limitations prevent strict X.509 validation,
the HMAC-SHA256 protocol guarantees request integrity, freshness, and replay
protection, but does not guarantee end-to-end confidentiality against active
man-in-the-middle attacks on untrusted Wi-Fi.
HTTP (plain text) on local LAN is strictly for laboratory demos and development.
"""

import time
import gc
import config

try:
    import device_secrets
except ImportError:
    device_secrets = None

# Root CA Certificate for taskoura.onrender.com
# Issuer: GlobalSign Root CA / Google Trust Services (GTS Root R4)
# Discovered via: openssl s_client -showcerts -connect taskoura.onrender.com:443
GTS_ROOT_R4_CA = (
    b"-----BEGIN CERTIFICATE-----\n"
    b"MIIDejCCAmKgAwIBAgIQf+UwvzMTQ77dghYQST2KGzANBgkqhkiG9w0BAQsFADBX\n"
    b"MQswCQYDVQQGEwJCRTEZMBcGA1UEChMQR2xvYmFsU2lnbiBudi1zYTEQMA4GA1UE\n"
    b"CxMHUm9vdCBDQTEbMBkGA1UEAxMSR2xvYmFsU2lnbiBSb290IENBMB4XDTIzMTEx\n"
    b"NTAzNDMyMVoXDTI4MDEyODAwMDA0MlowRzELMAkGA1UEBhMCVVMxIjAgBgNVBAoT\n"
    b"GUdvb2dsZSBUcnVzdCBTZXJ2aWNlcyBMTEMxFDASBgNVBAMTC0dUUyBSb290IFI0\n"
    b"MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE83Rzp2iLYK5DuDXFgTB7S0md+8Fhzube\n"
    b"Rr1r1WEYNa5A3XP3iZEwWus87oV8okB2O6nGuEfYKueSkWpz6bFyOZ8pn6KY019e\n"
    b"WIZlD6GEZQbR3IvJx3PIjGov5cSr0R2Ko4H/MIH8MA4GA1UdDwEB/wQEAwIBhjAd\n"
    b"BgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDwYDVR0TAQH/BAUwAwEB/zAd\n"
    b"BgNVHQ4EFgQUgEzW63T/STaj1dj8tT7FavCUHYwwHwYDVR0jBBgwFoAUYHtmGkUN\n"
    b"l8qJUC99BM00qP/8/UswNgYIKwYBBQUHAQEEKjAoMCYGCCsGAQUFBzAChhpodHRw\n"
    b"Oi8vaS5wa2kuZ29vZy9nc3IxLmNydDAtBgNVHR8EJjAkMCKgIKAehhxodHRwOi8v\n"
    b"Yy5wa2kuZ29vZy9yL2dzcjEuY3JsMBMGA1UdIAQMMAowCAYGZ4EMAQIBMA0GCSqG\n"
    b"SIb3DQEBCwUAA4IBAQAYQrsPBtYDh5bjP2OBDwmkoWhIDDkic574y04tfzHpn+cJ\n"
    b"odI2D4SseesQ6bDrarZ7C30ddLibZatoKiws3UL9xnELz4ct92vID24FfVbiI1hY\n"
    b"+SW6FoVHkNeWIP0GCbaM4C6uVdF5dTUsMVs/ZbzNnIdCp5Gxmx5ejvEau8otR/Cs\n"
    b"kGN+hr/W5GvT1tMBjgWKZ1i4//emhA1JG1BbPzoLJQvyEotc03lXjTaCzv8mEbep\n"
    b"8RqZ7a2CPsgRbuvTPBwcOMBBmuFeU88+FSBX6+7iP0il8b4Z0QFqIwwMHfs/L6K1\n"
    b"vepuoxtGzi4CZ68zJpiq1UvSqTbFJjtbD4seiMHl\n"
    b"-----END CERTIFICATE-----\n"
)

def run_probe():
    print("\n" + "=" * 60)
    print("  Taskoura BioLock ESP32-S2 TLS & Memory Probe")
    print("=" * 60)

    # 1. Memory stats before TLS
    gc.collect()
    free_ram_before = gc.mem_free() if hasattr(gc, 'mem_free') else 0
    print("[TLS Probe] Free RAM before network/TLS: %d bytes (%.1f KB)" % (free_ram_before, free_ram_before / 1024.0))

    # 2. Clock & NTP Status
    now = time.time()
    print("[TLS Probe] Current Unix epoch: %d" % int(now))
    if now < 1700000000:
        print("[TLS Probe] WARNING: System clock is NOT synchronized. X.509 cert validation will fail without NTP!")
    else:
        print("[TLS Probe] System clock is synchronized.")

    base_url = device_secrets.BASE_URL if device_secrets else "https://taskoura.onrender.com"
    print("[TLS Probe] Target URL: %s" % base_url)

    # Parse hostname and port
    url_no_scheme = base_url.replace("https://", "").replace("http://", "").split("/")[0]
    if ":" in url_no_scheme:
        host, port_str = url_no_scheme.split(":")
        port = int(port_str)
    else:
        host = url_no_scheme
        port = 443 if base_url.startswith("https") else 80

    print("[TLS Probe] Connecting to %s:%d..." % (host, port))

    try:
        import usocket as socket
        import ussl as ssl
    except ImportError:
        try:
            import socket
            import ssl
        except ImportError:
            print("[TLS Probe] Neither ussl nor ssl available on this runtime.")
            return

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10.0)

    try:
        addr = socket.getaddrinfo(host, port)[0][-1]
        sock.connect(addr)
        print("[TLS Probe] TCP connection established.")

        if port == 443 or base_url.startswith("https"):
            print("[TLS Probe] Attempting TLS handshake with Root CA cadata...")
            gc.collect()

            # Test 1: Full validation with Root CA
            try:
                ssl_sock = ssl.wrap_socket(
                    sock,
                    server_hostname=host,
                    cadata=GTS_ROOT_R4_CA,
                    cert_reqs=ssl.CERT_REQUIRED
                )
                print("[TLS Probe] SUCCESS: TLS handshake verified certificate against pinned GTS Root R4!")
                is_pinned = True
            except (TypeError, ValueError, AttributeError) as ve:
                print("[TLS Probe] Note: MicroPython ussl does not support cadata/CERT_REQUIRED parameter: %s" % ve)
                # Fallback test with standard wrap_socket
                ssl_sock = ssl.wrap_socket(sock, server_hostname=host)
                print("[TLS Probe] TLS handshake completed without local CA validation.")
                is_pinned = False

            # Memory stats after TLS handshake
            free_ram_after = gc.mem_free() if hasattr(gc, 'mem_free') else 0
            consumed = free_ram_before - free_ram_after
            print("[TLS Probe] Free RAM after TLS handshake: %d bytes (consumed: %d bytes)" % (free_ram_after, consumed))

            # Send minimal HTTP request to test link
            req = "GET /api/biolock/status HTTP/1.1\r\nHost: %s\r\nUser-Agent: BioLock-TLS-Probe\r\nConnection: close\r\n\r\n" % host
            ssl_sock.write(req.encode('utf-8') if hasattr(ssl_sock, 'write') else req)
            resp = ssl_sock.read(512)
            print("[TLS Probe] Received %d bytes from server." % len(resp))
            ssl_sock.close()

            print("-" * 60)
            if is_pinned:
                print("RESULT: Strict Certificate Verification IS SUPPORTED & PINNED.")
            else:
                print("RESULT: Strict Certificate Verification is NOT supported by this ussl build.")
                print("SECURITY NOTE: HMAC-SHA256 signature guarantees message integrity & freshness.")
                print("Confidentiality depends on transport TLS. http:// is for local demos only.")
            print("-" * 60)

        else:
            print("[TLS Probe] Plain HTTP mode detected. No TLS validation performed.")
            sock.close()

    except Exception as e:
        print("[TLS Probe] Connection or TLS probe failed: %s" % e)
        try:
            sock.close()
        except Exception:
            pass

if __name__ == "__main__":
    run_probe()
