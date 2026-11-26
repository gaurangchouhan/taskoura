#!/usr/bin/env python3
"""
Taskoura BioLock - Hardware PC Device Simulator (CPython)
Simulates the physical ESP32-S2 + R307S device for local and automated testing
without requiring physical hardware.

Supports:
  - Exact CONTRACT HMAC-SHA256 request signing and proof calculation
  - Configurable simulated fingerprint outcomes: MATCH, WRONG_FINGER, NO_MATCH, TIMEOUT, FAILED, DUPLICATE
  - Simulated network drop (tests backend lease expiration without guessing)
  - Interactive mode (--outcome ASK) to choose outcome interactively when a job arrives
"""

import sys
import os
import time
import argparse
import json
import hashlib
import hmac

def sha256_hex(data_bytes):
    return hashlib.sha256(data_bytes).hexdigest()

def hmac_sha256(key_bytes, message_bytes):
    return hmac.new(key_bytes, message_bytes, hashlib.sha256).hexdigest()

def sign_request(method, path, body_bytes, device_id, device_key_hex):
    """Generates headers matching Taskoura BioLock CONTRACT."""
    method_upper = method.upper()
    timestamp_str = str(int(time.time()))
    nonce_hex = os.urandom(16).hex()
    body_hash_hex = sha256_hex(body_bytes)

    canonical = f"{method_upper}\n{path}\n{timestamp_str}\n{nonce_hex}\n{body_hash_hex}"
    key_bytes = bytes.fromhex(device_key_hex)
    signature_hex = hmac_sha256(key_bytes, canonical.encode('utf-8'))

    headers = {
        "X-Device-Id": device_id,
        "X-Timestamp": timestamp_str,
        "X-Nonce": nonce_hex,
        "X-Signature": signature_hex,
        "User-Agent": "Taskoura-BioLock-Simulator/1.0"
    }
    if body_bytes:
        headers["Content-Type"] = "application/json"
    return headers

def generate_proof(device_key_hex, job_id, challenge, outcome, slot=None):
    """Calculates proof matching Taskoura BioLock CONTRACT."""
    slot_str = str(slot) if slot is not None else ""
    proof_payload = f"{job_id}|{challenge}|{outcome}|{slot_str}"
    key_bytes = bytes.fromhex(device_key_hex)
    return hmac_sha256(key_bytes, proof_payload.encode('utf-8'))

def send_http(method, url, headers=None, body=None, timeout_sec=10):
    """HTTP client using requests or urllib."""
    try:
        import requests
        resp = requests.request(
            method,
            url,
            headers=headers,
            data=body,
            timeout=timeout_sec
        )
        return resp.status_code, resp.text, resp.headers
    except ImportError:
        import urllib.request
        import urllib.error

        req = urllib.request.Request(
            url,
            data=body.encode('utf-8') if isinstance(body, str) else body,
            headers=headers or {},
            method=method.upper()
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout_sec) as r:
                return r.status, r.read().decode('utf-8'), dict(r.headers)
        except urllib.error.HTTPError as he:
            return he.code, he.read().decode('utf-8'), dict(he.headers)

class BioLockSimulator:
    def __init__(self, base_url, device_id, device_key, outcome_mode="MATCH", slot=1, network_drop=False):
        self.base_url = base_url.rstrip("/")
        self.device_id = device_id
        self.device_key = device_key
        self.outcome_mode = outcome_mode.upper()
        self.simulated_slot = slot
        self.simulate_network_drop = network_drop
        self.recent_jobs = []

    def poll_job(self):
        path = "/api/device/biolock/jobs/next"
        url = self.base_url + path
        headers = sign_request("GET", path, b"", self.device_id, self.device_key)

        status, text, resp_headers = send_http("GET", url, headers=headers)
        if status == 200:
            return json.loads(text), 0
        elif status == 204:
            return None, 0
        elif status == 429:
            retry = resp_headers.get("Retry-After") or resp_headers.get("retry-after") or "3"
            return None, int(retry) if retry.isdigit() else 3
        elif status == 401:
            print(f"[Simulator] HTTP 401 Unauthorized! Check DEVICE_ID and DEVICE_KEY.")
            return None, 5
        else:
            print(f"[Simulator] HTTP {status}: {text}")
            return None, 3

    def submit_result(self, job_id, outcome, slot, challenge):
        path = f"/api/device/biolock/jobs/{job_id}/result"
        url = self.base_url + path

        proof = generate_proof(self.device_key, job_id, challenge, outcome, slot)
        payload = {
            "outcome": outcome,
            "proof": proof
        }
        if slot is not None:
            payload["slot"] = slot

        body_str = json.dumps(payload)
        headers = sign_request("POST", path, body_str.encode('utf-8'), self.device_id, self.device_key)

        print(f"[Simulator] Submitting {outcome} (slot={slot}) with proof...")
        status, text, _ = send_http("POST", url, headers=headers, body=body_str)
        if status == 200:
            print(f"[Simulator] SUCCESS: Backend accepted result for job {job_id}")
            return True
        else:
            print(f"[Simulator] FAILED: Backend returned HTTP {status}: {text}")
            return False

    def execute_job(self, job):
        job_id = job.get("jobId")
        job_type = job.get("type")
        challenge = job.get("challenge")
        expected_slot = job.get("expectedSlot")
        slot = job.get("slot")

        print("\n" + "=" * 60)
        print(f"[Simulator] Job Claimed:")
        print(f"  ID           : {job_id}")
        print(f"  Type         : {job_type}")
        print(f"  ExpectedSlot : {expected_slot}")
        print(f"  Slot         : {slot}")
        print(f"  Challenge    : {challenge}")
        print("=" * 60)

        # Duplicate protection
        if job_id in self.recent_jobs:
            print(f"[Simulator] Skipping duplicate job {job_id}")
            return

        self.recent_jobs.append(job_id)
        if len(self.recent_jobs) > 10:
            self.recent_jobs.pop(0)

        # Simulated network drop scenario
        if self.simulate_network_drop:
            print("[Simulator] *** NETWORK DROP SIMULATION ***")
            print("[Simulator] Disconnecting mid-job. Sending nothing to backend!")
            print("[Simulator] The backend lease will safely expire (lease_until).")
            return

        # Determine simulated outcome
        chosen_outcome = self.outcome_mode
        if chosen_outcome == "ASK":
            print("Select simulated outcome:")
            print("  1. MATCH (Correct finger)")
            print("  2. WRONG_FINGER (Different finger in sensor)")
            print("  3. NO_MATCH (Unrecognized finger)")
            print("  4. TIMEOUT (User did not touch sensor)")
            print("  5. ENROLLED (Successful enrollment)")
            print("  6. FAILED (Sensor hardware error)")
            c = input("Choice (1-6): ").strip()
            mapping = {
                "1": "MATCH",
                "2": "WRONG_FINGER",
                "3": "NO_MATCH",
                "4": "TIMEOUT",
                "5": "ENROLLED",
                "6": "FAILED"
            }
            chosen_outcome = mapping.get(c, "MATCH")

        # Outcome mapping based on job type
        result_slot = None
        if job_type == "ENROLL":
            if chosen_outcome in ("MATCH", "ENROLLED"):
                chosen_outcome = "ENROLLED"
                result_slot = slot if slot is not None else self.simulated_slot
            elif chosen_outcome == "DUPLICATE":
                result_slot = slot if slot is not None else self.simulated_slot
            else:
                result_slot = None

        elif job_type == "VERIFY_ACCESS":
            if chosen_outcome == "MATCH":
                result_slot = expected_slot if expected_slot is not None else self.simulated_slot
            elif chosen_outcome == "WRONG_FINGER":
                result_slot = (expected_slot + 1) if expected_slot is not None else 99
            else:
                result_slot = None

        elif job_type == "DELETE_TEMPLATE":
            chosen_outcome = "DELETED" if chosen_outcome not in ("FAILED", "TIMEOUT") else chosen_outcome
            result_slot = slot if slot is not None else expected_slot

        # Submit signed proof
        self.submit_result(job_id, chosen_outcome, result_slot, challenge)

    def run(self, once=False, poll_interval=3):
        print("=" * 60)
        print("  Taskoura BioLock Hardware PC Simulator")
        print(f"  Target URL   : {self.base_url}")
        print(f"  Device ID    : {self.device_id}")
        print(f"  Outcome Mode : {self.outcome_mode}")
        print("=" * 60)

        while True:
            job, wait_sec = self.poll_job()
            if wait_sec > 0:
                time.sleep(wait_sec)
                continue

            if job:
                self.execute_job(job)
                if once:
                    break
            else:
                sys.stdout.write(".")
                sys.stdout.flush()
                time.sleep(poll_interval)

def main():
    parser = argparse.ArgumentParser(description="Taskoura BioLock Hardware PC Device Simulator")
    parser.add_argument("--base-url", default="http://localhost:8080", help="Taskoura backend base URL")
    parser.add_argument("--device-id", default="", help="Device ID (UUID)")
    parser.add_argument("--device-key", default="", help="Device Key (64-char hex string)")
    parser.add_argument("--outcome", default="MATCH", choices=["MATCH", "WRONG_FINGER", "NO_MATCH", "TIMEOUT", "FAILED", "ENROLLED", "DUPLICATE", "ASK"], help="Simulated finger outcome")
    parser.add_argument("--slot", type=int, default=1, help="Simulated slot number")
    parser.add_argument("--simulate-network-drop", action="store_true", help="Simulate network drop mid-job")
    parser.add_argument("--poll-interval", type=int, default=3, help="Polling interval in seconds")
    parser.add_argument("--once", action="store_true", help="Exit after processing 1 job")

    args = parser.parse_args()

    # Try loading from device_secrets if missing
    device_id = args.device_id
    device_key = args.device_key
    if not device_id or not device_key:
        try:
            sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "firmware")))
            import device_secrets
            device_id = device_id or getattr(device_secrets, "DEVICE_ID", "")
            device_key = device_key or getattr(device_secrets, "DEVICE_KEY", "")
        except ImportError:
            pass

    if not device_id or not device_key:
        print("ERROR: --device-id and --device-key are required (or create firmware/device_secrets.py).")
        sys.exit(1)

    sim = BioLockSimulator(
        base_url=args.base_url,
        device_id=device_id,
        device_key=device_key,
        outcome_mode=args.outcome,
        slot=args.slot,
        network_drop=args.simulate_network_drop
    )
    try:
        sim.run(once=args.once, poll_interval=args.poll_interval)
    except KeyboardInterrupt:
        print("\nSimulator stopped.")

if __name__ == "__main__":
    main()
