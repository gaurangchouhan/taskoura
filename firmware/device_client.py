"""
Taskoura BioLock - ESP32 Firmware Network Client & Service Loop
Implements:
  - Cryptographic HMAC-SHA256 request signing & proof calculation (RFC 2104)
  - Nonce & Unix timestamp generation with NTP clock synchronization
  - Reconnecting Wi-Fi manager with exponential backoff
  - Small HTTP(S) client with timeout support
  - 3-second job polling loop (/api/device/biolock/jobs/next)
  - Job execution (ENROLL, VERIFY_ACCESS, DELETE_TEMPLATE)
  - Duplicate job protection (ring buffer of last 10 jobs)
  - Lease drop handling (sends nothing if network drops mid-job; never guesses)
  - Watchdog recovery after repeated persistent failures
  - Strict confidentiality: NEVER logs or prints DEVICE_KEY
"""

import time
import os
import config
import led
import enroll
import verify

# Import secrets safely
try:
    import device_secrets
except ImportError:
    device_secrets = None

# MicroPython vs CPython module shims
try:
    import uhashlib as hashlib
except ImportError:
    import hashlib

# ==============================================================================
# 1. PURE PYTHON HMAC-SHA256 (RFC 2104)
# ==============================================================================
def hmac_sha256(key_bytes, message_bytes):
    """
    Computes HMAC-SHA256 according to RFC 2104.
    Works identically across MicroPython (uhashlib) and CPython (hashlib).
    """
    block_size = 64

    # If key is longer than block size, hash it down
    if len(key_bytes) > block_size:
        h = hashlib.sha256()
        h.update(key_bytes)
        key_bytes = h.digest()

    # Zero-pad key to block_size
    if len(key_bytes) < block_size:
        key_bytes = key_bytes + b'\x00' * (block_size - len(key_bytes))

    o_key_pad = bytes((b ^ 0x5c) for b in key_bytes)
    i_key_pad = bytes((b ^ 0x36) for b in key_bytes)

    # Inner hash: H(i_key_pad || message)
    inner = hashlib.sha256()
    inner.update(i_key_pad)
    inner.update(message_bytes)
    inner_digest = inner.digest()

    # Outer hash: H(o_key_pad || inner_digest)
    outer = hashlib.sha256()
    outer.update(o_key_pad)
    outer.update(inner_digest)
    return outer.digest()

def sha256_hex(data_bytes):
    """Computes SHA-256 hex string of data bytes."""
    h = hashlib.sha256()
    h.update(data_bytes)
    digest = h.digest()
    return "".join("%02x" % b for b in digest)

# ==============================================================================
# 2. CONTRACT SIGNING & PROOFS
# ==============================================================================
def sign_request(method, path, body, device_id, device_key_hex, timestamp_str=None, nonce_hex=None):
    """
    Produces headers for /api/device/biolock/** according to CONTRACT:
      X-Device-Id: <deviceId>
      X-Timestamp: <unix_seconds>
      X-Nonce: <16 bytes hex>
      X-Signature: hex(HMAC-SHA256(deviceKey, METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + SHA256hex(body)))
    """
    method_upper = method.upper()
    if timestamp_str is None:
        timestamp_str = str(int(time.time()))

    if nonce_hex is None:
        raw_nonce = os.urandom(16)
        nonce_hex = "".join("%02x" % b for b in raw_nonce)

    body_bytes = body.encode('utf-8') if isinstance(body, str) else (body or b"")
    body_hash_hex = sha256_hex(body_bytes)

    # Construct canonical payload exactly per CONTRACT
    canonical = "%s\n%s\n%s\n%s\n%s" % (
        method_upper,
        path,
        timestamp_str,
        nonce_hex,
        body_hash_hex
    )

    # Compute HMAC-SHA256 signature
    key_bytes = bytes.fromhex(device_key_hex) if hasattr(bytes, 'fromhex') else _hex_to_bytes(device_key_hex)
    sig_digest = hmac_sha256(key_bytes, canonical.encode('utf-8'))
    signature_hex = "".join("%02x" % b for b in sig_digest)

    headers = {
        "X-Device-Id": device_id,
        "X-Timestamp": timestamp_str,
        "X-Nonce": nonce_hex,
        "X-Signature": signature_hex,
        "User-Agent": "Taskoura-BioLock-ESP32/1.0"
    }

    if body_bytes:
        headers["Content-Type"] = "application/json"

    return headers

def generate_proof(device_key_hex, job_id, challenge, outcome, slot=None):
    """
    Calculates sensor execution proof according to CONTRACT:
      proof = hex(HMAC-SHA256(deviceKey, jobId + "|" + challenge + "|" + outcome + "|" + (slot ?? "")))
    """
    slot_str = str(slot) if slot is not None else ""
    proof_payload = "%s|%s|%s|%s" % (job_id, challenge, outcome, slot_str)

    key_bytes = bytes.fromhex(device_key_hex) if hasattr(bytes, 'fromhex') else _hex_to_bytes(device_key_hex)
    proof_digest = hmac_sha256(key_bytes, proof_payload.encode('utf-8'))
    return "".join("%02x" % b for b in proof_digest)

def _hex_to_bytes(hex_str):
    """Fallback hex decoding for micro-environments."""
    return bytes(int(hex_str[i:i+2], 16) for i in range(0, len(hex_str), 2))

# ==============================================================================
# 3. WI-FI & NTP MANAGEMENT
# ==============================================================================
_last_ntp_sync = 0

def wifi_connect(ssid=None, password=None, max_retries=5, initial_backoff_sec=1):
    """
    Connects to Wi-Fi with exponential backoff.
    Falls back gracefully on CPython host simulator.
    """
    if ssid is None and device_secrets:
        ssid = device_secrets.WIFI_SSID
    if password is None and device_secrets:
        password = device_secrets.WIFI_PASSWORD

    try:
        import network
        wlan = network.WLAN(network.STA_IF)
        wlan.active(True)
        if wlan.isconnected():
            return True

        print("[BioLock] Connecting to Wi-Fi '%s'..." % ssid)
        backoff = initial_backoff_sec
        for attempt in range(1, max_retries + 1):
            wlan.connect(ssid, password)
            start = time.time()
            while time.time() - start < 10:
                if wlan.isconnected():
                    ip = wlan.ifconfig()[0]
                    print("[BioLock] Wi-Fi connected! IP: %s" % ip)
                    led.led_blink(2, 100)
                    return True
                time.sleep(0.5)

            print("[BioLock] Wi-Fi attempt %d/%d failed. Retrying in %ds..." % (attempt, max_retries, backoff))
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)

        print("[BioLock] Failed to connect to Wi-Fi after %d attempts." % max_retries)
        return False
    except ImportError:
        # CPython simulator or host environment
        return True

def ntp_sync(force=False):
    """
    Synchronizes system clock via NTP.
    Ensures accurate Unix timestamp for HMAC signature validation.
    """
    global _last_ntp_sync
    now = time.time()

    # Re-sync every NTP_SYNC_INTERVAL_HOURS unless forced
    if not force and _last_ntp_sync > 0 and (now - _last_ntp_sync) < (config.NTP_SYNC_INTERVAL_HOURS * 3600):
        return True

    try:
        import ntptime
        ntptime.host = config.NTP_HOST
        print("[BioLock] Synchronizing clock via NTP (%s)..." % config.NTP_HOST)
        ntptime.settime()
        _last_ntp_sync = time.time()
        print("[BioLock] NTP sync successful. UTC Unix time: %d" % int(_last_ntp_sync))
        return True
    except Exception as e:
        print("[BioLock] Warning: NTP synchronization failed: %s" % e)
        return False

# ==============================================================================
# 4. LIGHTWEIGHT HTTP CLIENT
# ==============================================================================
def http_request(method, url, headers=None, body=None, timeout_sec=10):
    """
    Lightweight HTTP(S) requester compatible with MicroPython and CPython.
    Returns: (status_code, response_body_str, response_headers_dict)
    """
    # Prefer urequests on MicroPython, requests/urllib on CPython
    try:
        import urequests
        kwargs = {}
        if headers:
            kwargs["headers"] = headers
        if body:
            kwargs["data"] = body

        res = None
        if method.upper() == "GET":
            res = urequests.get(url, **kwargs)
        elif method.upper() == "POST":
            res = urequests.post(url, **kwargs)
        else:
            res = urequests.request(method.upper(), url, **kwargs)

        status_code = res.status_code
        text = res.text
        resp_headers = res.headers if hasattr(res, 'headers') else {}
        res.close()
        return status_code, text, resp_headers
    except ImportError:
        pass

    # Standard CPython urllib fallback
    try:
        import urllib.request
        import urllib.error

        req = urllib.request.Request(
            url,
            data=body.encode('utf-8') if body else None,
            headers=headers or {},
            method=method.upper()
        )

        try:
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                status_code = resp.status
                text = resp.read().decode('utf-8')
                resp_headers = dict(resp.headers)
                return status_code, text, resp_headers
        except urllib.error.HTTPError as he:
            status_code = he.code
            text = he.read().decode('utf-8')
            resp_headers = dict(he.headers)
            return status_code, text, resp_headers
    except Exception as e:
        raise RuntimeError("HTTP request failed: %s" % e)

# ==============================================================================
# 5. RECENT JOBS RING BUFFER (DUPLICATE JOB PROTECTION)
# ==============================================================================
class RecentJobsCache:
    """Ring buffer holding the last N processed job IDs to prevent duplicates."""
    def __init__(self, capacity=10):
        self.capacity = capacity
        self.items = []

    def contains(self, job_id):
        return job_id in self.items

    def add(self, job_id):
        if job_id not in self.items:
            self.items.append(job_id)
            if len(self.items) > self.capacity:
                self.items.pop(0)

# ==============================================================================
# 6. BIOLOCK SERVICE LOOP
# ==============================================================================
class BioLockClient:
    def __init__(self, base_url=None, device_id=None, device_key=None):
        if device_secrets:
            self.base_url = (base_url or device_secrets.BASE_URL).rstrip("/")
            self.device_id = device_id or device_secrets.DEVICE_ID
            self.device_key = device_key or device_secrets.DEVICE_KEY
        else:
            self.base_url = (base_url or "http://localhost:8080").rstrip("/")
            self.device_id = device_id or ""
            self.device_key = device_key or ""

        self.recent_jobs = RecentJobsCache(config.RECENT_JOBS_MAX)
        self.consecutive_failures = 0
        self.wdt = None
        self._network_offline_flag = False
        self._init_watchdog()

    def is_network_available(self):
        """Checks if Wi-Fi interface is currently connected."""
        if self._network_offline_flag:
            return False
        try:
            import network
            wlan = network.WLAN(network.STA_IF)
            return wlan.isconnected()
        except ImportError:
            return True

    def _init_watchdog(self):
        """Initializes hardware watchdog if enabled."""
        if config.ENABLE_WATCHDOG:
            try:
                import machine
                self.wdt = machine.WDT(timeout=config.WATCHDOG_TIMEOUT_SEC * 1000)
            except (ImportError, AttributeError):
                self.wdt = None

    def feed_watchdog(self):
        if self.wdt is not None:
            try:
                self.wdt.feed()
            except Exception:
                pass

    def check_failure_recovery(self):
        """Reboots or resets device if failures exceed maximum threshold."""
        if self.consecutive_failures >= config.MAX_CONSECUTIVE_FAILURES:
            print("[BioLock] CRITICAL: %d consecutive failures. Triggering safe system restart..." % self.consecutive_failures)
            try:
                import machine
                machine.reset()
            except Exception:
                pass

    def poll_next_job(self):
        """
        Polls GET /api/device/biolock/jobs/next.
        Returns: (job_dict, retry_after_sec)
        """
        path = "/api/device/biolock/jobs/next"
        url = self.base_url + path
        headers = sign_request("GET", path, "", self.device_id, self.device_key)

        try:
            status, text, resp_headers = http_request("GET", url, headers=headers, timeout_sec=10)

            if status == 200:
                self.consecutive_failures = 0
                import json
                job = json.loads(text)
                return job, 0

            elif status == 204:
                # No jobs available (heartbeat success)
                self.consecutive_failures = 0
                return None, 0

            elif status == 429:
                # Rate limited: check Retry-After header
                retry_header = resp_headers.get("Retry-After") or resp_headers.get("retry-after")
                retry_after = int(retry_header) if retry_header and retry_header.isdigit() else config.RETRY_AFTER_DEFAULT_SEC
                print("[BioLock] Rate limited (429). Waiting %ds..." % retry_after)
                return None, retry_after

            else:
                self.consecutive_failures += 1
                print("[BioLock] Poll returned HTTP %d: %s" % (status, text))
                return None, 0

        except Exception as e:
            self.consecutive_failures += 1
            print("[BioLock] Network error polling next job: %s" % e)
            return None, 0

    def submit_job_result(self, job_id, outcome, slot, challenge):
        """
        Calculates proof and submits POST /api/device/biolock/jobs/{jobId}/result.
        """
        path = "/api/device/biolock/jobs/%s/result" % job_id
        url = self.base_url + path

        proof = generate_proof(self.device_key, job_id, challenge, outcome, slot)

        import json
        payload = {
            "outcome": outcome,
            "proof": proof
        }
        if slot is not None:
            payload["slot"] = slot

        body_str = json.dumps(payload)
        headers = sign_request("POST", path, body_str, self.device_id, self.device_key)

        try:
            status, text, _ = http_request("POST", url, headers=headers, body=body_str, timeout_sec=10)
            if status == 200:
                print("[BioLock] Job %s outcome '%s' submitted successfully." % (job_id, outcome))
                return True
            else:
                print("[BioLock] Job result submission failed (HTTP %d): %s" % (status, text))
                return False
        except Exception as e:
            print("[BioLock] Network error submitting job result: %s" % e)
            return False

    def handle_job(self, job):
        """
        Dispatches a claimed job according to type:
          - ENROLL
          - VERIFY_ACCESS
          - DELETE_TEMPLATE
        """
        job_id = job.get("jobId")
        job_type = job.get("type")
        challenge = job.get("challenge")
        expected_slot = job.get("expectedSlot")
        slot = job.get("slot")

        if not job_id or not job_type or not challenge:
            print("[BioLock] Invalid job payload received.")
            return

        # Check duplicate protection
        if self.recent_jobs.contains(job_id):
            print("[BioLock] Job %s was already processed. Skipping duplicate." % job_id)
            return

        # Mark job as processed in local cache
        self.recent_jobs.add(job_id)
        print("[BioLock] Executing %s job (id: %s)..." % (job_type, job_id))

        outcome = "FAILED"
        result_slot = None

        if job_type == "ENROLL":
            # ENROLL job
            outcome, result_slot = enroll.enroll(target_slot=slot, timeout_sec=45)

        elif job_type == "VERIFY_ACCESS":
            # VERIFY_ACCESS job
            outcome, result_slot = verify.verify_expected(expected_slot=expected_slot, timeout_sec=45)

        elif job_type == "DELETE_TEMPLATE":
            # DELETE_TEMPLATE job
            target = slot if slot is not None else expected_slot
            outcome, result_slot = enroll.delete_slot(target)

        else:
            print("[BioLock] Unknown job type: %s" % job_type)
            outcome = "FAILED"

        # If Wi-Fi or backend dropped mid-job: send nothing and let lease expire, never guess
        if not self.is_network_available():
            print("[BioLock] Wi-Fi or backend dropped mid-job. Sending nothing; letting lease expire.")
            return

        # Submit signed result with HMAC proof
        try:
            self.submit_job_result(job_id, outcome, result_slot, challenge)
        except Exception as e:
            print("[BioLock] Connection dropped during result submission (%s). Letting lease expire." % e)

    def run_service(self):
        """Main service loop."""
        print("=" * 60)
        print("  Taskoura BioLock Hardware Service Starting")
        print("  Device ID : %s" % self.device_id)
        print("  Base URL  : %s" % self.base_url)
        print("=" * 60)

        # 1. Connect Wi-Fi
        if not wifi_connect():
            print("[BioLock] Wi-Fi unavailable. Exiting service.")
            return

        # 2. Sync Clock via NTP before any signed API calls
        ntp_sync(force=True)

        error_backoff = 1

        while True:
            self.feed_watchdog()
            self.check_failure_recovery()

            # Periodic NTP sync
            ntp_sync(force=False)

            job, retry_after = self.poll_next_job()

            if retry_after > 0:
                time.sleep(retry_after)
                continue

            if job:
                error_backoff = 1
                try:
                    self.handle_job(job)
                except Exception as e:
                    print("[BioLock] Error handling job: %s" % e)
            else:
                if self.consecutive_failures > 0:
                    # Exponential backoff on errors
                    error_backoff = min(error_backoff * 2, config.MAX_ERROR_BACKOFF_SEC)
                    time.sleep(error_backoff)
                else:
                    error_backoff = 1
                    time.sleep(config.POLL_INTERVAL_SEC)

def run():
    """Entry point to launch the BioLock service."""
    client = BioLockClient()
    client.run_service()
