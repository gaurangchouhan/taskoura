#!/usr/bin/env python3
"""
Taskoura BioLock - Hardware PC Device Simulator (CPython standard library only)
Simulates the ESP32 + R307S fingerprint device for end-to-end testing without hardware.

Rules & Security:
  - Standard library only (urllib, hmac, hashlib, json, time, os, sys, argparse).
  - Device key loaded ONLY from env BIOLOCK_DEVICE_KEY (never a CLI arg, never printed).
  - Persists simulated enrolled fingerprint slots in .biolock_sim_state.json.
  - Maintains ring buffer of last 10 handled jobIds to prevent duplicate processing.
  - Backs off cleanly on 401, 429 (Retry-After), 5xx, and network drops.
"""

import sys
import os
import time
import json
import argparse
import hashlib
import hmac
import urllib.request
import urllib.error

STATE_FILE = ".biolock_sim_state.json"

def sha256_hex(data_bytes: bytes) -> str:
    return hashlib.sha256(data_bytes).hexdigest()

def hmac_sha256_hex(key_bytes: bytes, message_bytes: bytes) -> str:
    return hmac.new(key_bytes, message_bytes, hashlib.sha256).hexdigest()

def sign_request(method: str, path: str, body_bytes: bytes, device_id: str, device_key_hex: str, timestamp_str: str = None, nonce_hex: str = None) -> dict:
    """Signs an HTTP request matching the Taskoura BioLock CONTRACT."""
    method_upper = method.upper()
    ts = timestamp_str if timestamp_str is not None else str(int(time.time()))
    nonce = nonce_hex if nonce_hex is not None else os.urandom(16).hex()
    body_hash = sha256_hex(body_bytes if body_bytes else b"")

    canonical = f"{method_upper}\n{path}\n{ts}\n{nonce}\n{body_hash}"
    key_bytes = bytes.fromhex(device_key_hex)
    signature = hmac_sha256_hex(key_bytes, canonical.encode("utf-8"))

    headers = {
        "X-Device-Id": device_id,
        "X-Timestamp": ts,
        "X-Nonce": nonce,
        "X-Signature": signature,
        "User-Agent": "Taskoura-BioLock-Simulator/1.0"
    }
    if body_bytes:
        headers["Content-Type"] = "application/json"
    return headers

def generate_proof(device_key_hex: str, job_id: str, challenge: str, outcome: str, slot: int = None) -> str:
    """Calculates outcome proof matching the Taskoura BioLock CONTRACT."""
    slot_str = str(slot) if slot is not None else ""
    payload = f"{job_id}|{challenge}|{outcome}|{slot_str}"
    key_bytes = bytes.fromhex(device_key_hex)
    return hmac_sha256_hex(key_bytes, payload.encode("utf-8"))

def load_sim_state() -> dict:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"enrolled_slots": [1]}

def save_sim_state(state: dict):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        sys.stderr.write(f"[Simulator] Warning: failed to save state: {e}\n")

class BioLockSimulator:
    def __init__(self, base_url: str, device_id: str, device_key_hex: str, finger_mode: str = "match", poll_interval: int = 3, verbose: bool = False):
        self.base_url = base_url.rstrip("/")
        self.device_id = device_id
        self._device_key = device_key_hex  # strictly private, never printed
        self.finger_mode = finger_mode.lower()
        self.poll_interval = poll_interval
        self.verbose = verbose
        self.recent_jobs = []  # Ring buffer of up to 10 jobIds
        self.backoff_sec = 2

    def _log(self, msg: str):
        if self.verbose:
            print(f"[Simulator] {msg}")

    def http_request(self, method: str, path: str, body_bytes: bytes = b""):
        url = self.base_url + path
        headers = sign_request(method, path, body_bytes, self.device_id, self._device_key)

        req = urllib.request.Request(
            url,
            data=body_bytes if body_bytes else None,
            headers=headers,
            method=method.upper()
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_body = resp.read().decode("utf-8")
                return resp.status, resp_body, dict(resp.headers)
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8") if he.fp else ""
            return he.code, err_body, dict(he.headers)
        except urllib.error.URLError as ue:
            return 0, str(ue.reason), {}
        except Exception as e:
            return 0, str(e), {}

    def poll_next_job(self):
        path = "/api/device/biolock/jobs/next"
        status, body, headers = self.http_request("GET", path)

        if status == 200:
            self.backoff_sec = 2
            try:
                job_data = json.loads(body)
                return job_data, 0
            except Exception as e:
                self._log(f"Failed to parse job JSON: {e}")
                return None, self.poll_interval

        elif status == 204:
            self.backoff_sec = 2
            return None, self.poll_interval

        elif status == 429:
            retry_header = headers.get("Retry-After") or headers.get("retry-after")
            wait = int(retry_header) if retry_header and retry_header.isdigit() else self.poll_interval
            self._log(f"HTTP 429 Rate limited. Waiting {wait}s...")
            return None, wait

        elif status == 401:
            print(f"[Simulator] Error: HTTP 401 Unauthorized. Check BIOLOCK_DEVICE_KEY and device registration.")
            return None, 10

        elif status >= 500 or status == 0:
            print(f"[Simulator] Backend unavailable (Status: {status}). Backing off for {self.backoff_sec}s...")
            wait = self.backoff_sec
            self.backoff_sec = min(self.backoff_sec * 2, 30)
            return None, wait

        else:
            self._log(f"Unexpected HTTP {status}: {body}")
            return None, self.poll_interval

    def submit_result(self, job_id: str, challenge: str, outcome: str, slot: int = None) -> bool:
        path = f"/api/device/biolock/jobs/{job_id}/result"
        proof = generate_proof(self._device_key, job_id, challenge, outcome, slot)

        payload = {
            "outcome": outcome,
            "proof": proof
        }
        if slot is not None:
            payload["slot"] = slot

        body_bytes = json.dumps(payload).encode("utf-8")
        status, resp_text, _ = self.http_request("POST", path, body_bytes)

        if status == 200:
            print(f"[Simulator] Result accepted for job {job_id} ({outcome}, slot={slot})")
            return True
        else:
            print(f"[Simulator] Failed to submit result (HTTP {status}): {resp_text}")
            return False

    def handle_enroll(self, job: dict):
        job_id = job.get("jobId")
        challenge = job.get("challenge")
        server_slot = job.get("slot")

        state = load_sim_state()
        enrolled = set(state.get("enrolled_slots", []))

        # Finger mode check
        if self.finger_mode == "error":
            print(f"[Simulator] ENROLL failed: simulated sensor error")
            self.submit_result(job_id, challenge, "FAILED", None)
            return
        elif self.finger_mode == "timeout":
            print(f"[Simulator] ENROLL timed out: user did not place finger")
            self.submit_result(job_id, challenge, "TIMEOUT", None)
            return

        # Assign slot: server suggested slot, or lowest free integer >= 1
        if server_slot and server_slot not in enrolled:
            target_slot = server_slot
        else:
            target_slot = 1
            while target_slot in enrolled:
                target_slot += 1

        enrolled.add(target_slot)
        state["enrolled_slots"] = sorted(list(enrolled))
        save_sim_state(state)

        print(f"[Simulator] Fingerprint enrolled into simulated slot #{target_slot}")
        self.submit_result(job_id, challenge, "ENROLLED", target_slot)

    def handle_verify_access(self, job: dict):
        job_id = job.get("jobId")
        challenge = job.get("challenge")
        expected_slot = job.get("expectedSlot", 1)

        state = load_sim_state()
        enrolled = state.get("enrolled_slots", [1])

        print(f"[Simulator] VERIFY_ACCESS for expected slot #{expected_slot} (mode: {self.finger_mode})")

        if self.finger_mode == "match":
            # Match expected slot
            self.submit_result(job_id, challenge, "MATCH", expected_slot)
        elif self.finger_mode == "wrong":
            # Different enrolled finger
            wrong_slot = expected_slot + 1 if (expected_slot + 1) in enrolled else 99
            self.submit_result(job_id, challenge, "WRONG_FINGER", wrong_slot)
        elif self.finger_mode == "nomatch":
            self.submit_result(job_id, challenge, "NO_MATCH", None)
        elif self.finger_mode == "timeout":
            self.submit_result(job_id, challenge, "TIMEOUT", None)
        elif self.finger_mode == "error":
            self.submit_result(job_id, challenge, "FAILED", None)
        else:
            self.submit_result(job_id, challenge, "MATCH", expected_slot)

    def handle_delete_template(self, job: dict):
        job_id = job.get("jobId")
        challenge = job.get("challenge")
        slot = job.get("slot")

        state = load_sim_state()
        enrolled = set(state.get("enrolled_slots", []))

        if slot in enrolled:
            enrolled.remove(slot)
            state["enrolled_slots"] = sorted(list(enrolled))
            save_sim_state(state)
            print(f"[Simulator] Deleted template from slot #{slot}")

        self.submit_result(job_id, challenge, "DELETED", slot)

    def execute_job(self, job: dict):
        job_id = job.get("jobId")
        job_type = job.get("type")

        # Ring buffer check (last 10 jobs)
        if job_id in self.recent_jobs:
            self._log(f"Job {job_id} already processed. Ignoring.")
            return

        self.recent_jobs.append(job_id)
        if len(self.recent_jobs) > 10:
            self.recent_jobs.pop(0)

        print(f"\n[Simulator] Claimed Job: {job_type} (id: {job_id})")

        if job_type == "ENROLL":
            self.handle_enroll(job)
        elif job_type == "VERIFY_ACCESS":
            self.handle_verify_access(job)
        elif job_type == "DELETE_TEMPLATE":
            self.handle_delete_template(job)
        else:
            print(f"[Simulator] Unknown job type: {job_type}")

    def run(self, once: bool = False):
        masked_id = self.device_id[:8] + "..." if len(self.device_id) > 8 else self.device_id
        print("=" * 60)
        print("  Taskoura BioLock PC Device Simulator (CPython)")
        print(f"  Target Server : {self.base_url}")
        print(f"  Device ID     : {masked_id}")
        print(f"  Finger Mode   : {self.finger_mode.upper()}")
        print(f"  Poll Interval : {self.poll_interval}s")
        print("=" * 60)
        print("[Simulator] Waiting for jobs (Ctrl+C to quit)...")

        while True:
            job, wait_sec = self.poll_next_job()
            if job:
                self.execute_job(job)
                if once:
                    print("[Simulator] --once specified, exiting after 1 job.")
                    break
            else:
                if self.verbose:
                    sys.stdout.write(".")
                    sys.stdout.flush()

            time.sleep(wait_sec)

def main():
    parser = argparse.ArgumentParser(description="Taskoura BioLock Hardware PC Device Simulator")
    parser.add_argument("--base-url", default=os.environ.get("BIOLOCK_BASE_URL", "http://localhost:8080"), help="Taskoura backend base URL")
    parser.add_argument("--device-id", default=os.environ.get("BIOLOCK_DEVICE_ID", ""), help="BioLock Device UUID")
    parser.add_argument("--finger", choices=["match", "wrong", "nomatch", "timeout", "error"], default="match", help="Simulated fingerprint outcome")
    parser.add_argument("--poll", type=int, default=3, help="Polling interval in seconds (default: 3)")
    parser.add_argument("--once", action="store_true", help="Exit after processing one job")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    # Load device key ONLY from env or fallback to firmware/device_secrets.py
    device_key = os.environ.get("BIOLOCK_DEVICE_KEY", "")
    device_id = args.device_id

    if not device_key or not device_id:
        try:
            sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "firmware")))
            import device_secrets
            if not device_key:
                device_key = getattr(device_secrets, "DEVICE_KEY", "")
            if not device_id:
                device_id = getattr(device_secrets, "DEVICE_ID", "")
        except ImportError:
            pass

    if not device_id:
        sys.stderr.write("Error: BioLock Device ID is required via --device-id or env BIOLOCK_DEVICE_ID.\n")
        sys.exit(1)

    if not device_key:
        sys.stderr.write("Error: BioLock Device Key is required via env BIOLOCK_DEVICE_KEY (never CLI argument).\n")
        sys.exit(1)

    sim = BioLockSimulator(
        base_url=args.base_url,
        device_id=device_id,
        device_key_hex=device_key,
        finger_mode=args.finger,
        poll_interval=args.poll,
        verbose=args.verbose
    )

    try:
        sim.run(once=args.once)
    except KeyboardInterrupt:
        print("\n[Simulator] Stopped by user.")

if __name__ == "__main__":
    main()
