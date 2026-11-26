#!/usr/bin/env python3
"""
Taskoura BioLock - Firmware Host Test Suite (CPython)
Tests:
  1. Cryptographic HMAC-SHA256 (RFC 2202 compliance & pure-Python parity)
  2. Request signing and proof calculation per CONTRACT
  3. Fake UART simulation for R307S optical sensor protocol
  4. Fingerprint enrollment, verification, and template deletion flows
  5. Job execution state machine & duplicate job protection (last 10 ring buffer)
  6. Failure handling, mid-job network drops (lease expiration), and safe recovery
  7. Strict confidentiality: device key never leaked or printed
"""

import sys
import os
import unittest
import time
import json
import hashlib
import hmac

# Add firmware directory to path
FIRMWARE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, FIRMWARE_DIR)

import config
import led
import fingerprint
import enroll
import verify
import device_client

# ==============================================================================
# 1. FAKE UART SIMULATOR FOR R307S
# ==============================================================================
class FakeR307SUART:
    """Simulates the hardware UART connected to the R307/R307S sensor."""
    def __init__(self):
        self.tx_buffer = bytearray()
        self.rx_buffer = bytearray()
        self.enrolled_slots = {}  # slot -> dummy template
        self.simulated_finger_state = None  # None, "CORRECT", "WRONG", "UNKNOWN"
        self.expected_slot = 1

    def write(self, data):
        self.tx_buffer.extend(data)
        self._process_command()

    def read(self, count):
        out = self.rx_buffer[:count]
        self.rx_buffer = self.rx_buffer[count:]
        return bytes(out)

    def any(self):
        return len(self.rx_buffer)

    def _send_ack(self, confirmation_code, payload=b""):
        # Header (0xEF01) + Address (4 bytes) + PID (0x07) + Length (2 bytes) + Code + Payload + Chk (2 bytes)
        length = len(payload) + 3
        pid = 0x07
        content = bytes([confirmation_code]) + payload
        checksum = pid + ((length >> 8) & 0xff) + (length & 0xff) + sum(content)
        chk_bytes = bytes([(checksum >> 8) & 0xff, checksum & 0xff])
        pkt = b"\xef\x01\xff\xff\xff\xff" + bytes([pid, (length >> 8) & 0xff, length & 0xff]) + content + chk_bytes
        self.rx_buffer.extend(pkt)

    def _process_command(self):
        if len(self.tx_buffer) < 9:
            return
        if self.tx_buffer[:2] != b"\xef\x01":
            return

        pid = self.tx_buffer[6]
        length = (self.tx_buffer[7] << 8) | self.tx_buffer[8]
        if len(self.tx_buffer) < 9 + length:
            return

        cmd_pkt = self.tx_buffer[:9 + length]
        self.tx_buffer = self.tx_buffer[9 + length:]

        content = cmd_pkt[9:-2]
        cmd = content[0]
        params = content[1:]

        # CMD_VFY_PWD (0x13)
        if cmd == fingerprint.CMD_VFY_PWD:
            self._send_ack(fingerprint.CONFIRM_OK)

        # CMD_GEN_IMG (0x01)
        elif cmd == fingerprint.CMD_GEN_IMG:
            if self.simulated_finger_state is not None:
                self._send_ack(fingerprint.CONFIRM_OK)
            else:
                self._send_ack(fingerprint.CONFIRM_NO_FINGER)

        # CMD_IMG_2_TZ (0x02)
        elif cmd == fingerprint.CMD_IMG_2_TZ:
            self._send_ack(fingerprint.CONFIRM_OK)

        # CMD_REG_MODEL (0x05)
        elif cmd == fingerprint.CMD_REG_MODEL:
            self._send_ack(fingerprint.CONFIRM_OK)

        # CMD_STORE (0x06)
        elif cmd == fingerprint.CMD_STORE:
            slot = (params[1] << 8) | params[2]
            self.enrolled_slots[slot] = True
            self._send_ack(fingerprint.CONFIRM_OK)

        # CMD_SEARCH (0x04)
        elif cmd == fingerprint.CMD_SEARCH:
            if self.simulated_finger_state == "CORRECT":
                # Return expected slot with high confidence score 120
                slot_bytes = bytes([(self.expected_slot >> 8) & 0xff, self.expected_slot & 0xff])
                score_bytes = b"\x00\x78"
                self._send_ack(fingerprint.CONFIRM_OK, slot_bytes + score_bytes)
            elif self.simulated_finger_state == "WRONG":
                # Return wrong slot 99
                slot_bytes = b"\x00\x63"
                score_bytes = b"\x00\x50"
                self._send_ack(fingerprint.CONFIRM_OK, slot_bytes + score_bytes)
            else:
                # No match found
                self._send_ack(fingerprint.CONFIRM_NO_MATCH)

        # CMD_DELET_CHAR (0x0C)
        elif cmd == fingerprint.CMD_DELET_CHAR:
            slot = (params[0] << 8) | params[1]
            self.enrolled_slots.pop(slot, None)
            self._send_ack(fingerprint.CONFIRM_OK)

        # CMD_TEMPLATE_NUM (0x1D)
        elif cmd == fingerprint.CMD_TEMPLATE_NUM:
            count = len(self.enrolled_slots)
            count_bytes = bytes([(count >> 8) & 0xff, count & 0xff])
            self._send_ack(fingerprint.CONFIRM_OK, count_bytes)

        # CMD_EMPTY (0x0D)
        elif cmd == fingerprint.CMD_EMPTY:
            self.enrolled_slots.clear()
            self._send_ack(fingerprint.CONFIRM_OK)

        else:
            self._send_ack(fingerprint.CONFIRM_OK)

# ==============================================================================
# 2. TEST SUITE
# ==============================================================================
class BioLockFirmwareTests(unittest.TestCase):

    def setUp(self):
        self.fake_uart = FakeR307SUART()
        fingerprint.set_uart(self.fake_uart)
        led.led_init()

    # --------------------------------------------------------------------------
    # A. CRYPTOGRAPHIC SIGNING & PROOFS
    # --------------------------------------------------------------------------
    def test_01_hmac_sha256_rfc2202_compliance(self):
        """Validates pure-Python HMAC-SHA256 against RFC 2202 test vectors."""
        # Test Case 1: Key = 20 bytes 0x0b, Data = "Hi There"
        key1 = b"\x0b" * 20
        data1 = b"Hi There"
        expected1 = "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"
        digest1 = device_client.hmac_sha256(key1, data1)
        hex1 = "".join("%02x" % b for b in digest1)
        self.assertEqual(hex1, expected1)

        # Test Case 2: Key = "Jefe", Data = "what do ya want for nothing?"
        key2 = b"Jefe"
        data2 = b"what do ya want for nothing?"
        expected2 = "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        digest2 = device_client.hmac_sha256(key2, data2)
        hex2 = "".join("%02x" % b for b in digest2)
        self.assertEqual(hex2, expected2)

        # Test Case 3: Key > 64 bytes (tests hash-down logic, RFC 4231 Test Case 6)
        key3 = b"\xaa" * 131
        data3 = b"Test Using Larger Than Block-Size Key - Hash Key First"
        expected3 = "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"
        digest3 = device_client.hmac_sha256(key3, data3)
        hex3 = "".join("%02x" % b for b in digest3)
        self.assertEqual(hex3, expected3)

    def test_02_sign_request_contract_structure(self):
        """Verifies sign_request headers and canonical payload format."""
        device_id = "test-device-uuid-1234"
        device_key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        method = "GET"
        path = "/api/device/biolock/jobs/next"
        body = ""

        headers = device_client.sign_request(method, path, body, device_id, device_key)

        self.assertEqual(headers["X-Device-Id"], device_id)
        self.assertTrue(headers["X-Timestamp"].isdigit())
        self.assertEqual(len(headers["X-Nonce"]), 32)  # 16 bytes hex
        self.assertEqual(len(headers["X-Signature"]), 64)  # SHA-256 hex length

        # Verify signature matches independent HMAC calculation
        timestamp = headers["X-Timestamp"]
        nonce = headers["X-Nonce"]
        body_hash = hashlib.sha256(b"").hexdigest()
        canonical = f"{method}\n{path}\n{timestamp}\n{nonce}\n{body_hash}"
        expected_sig = hmac.new(bytes.fromhex(device_key), canonical.encode('utf-8'), hashlib.sha256).hexdigest()
        self.assertEqual(headers["X-Signature"], expected_sig)

    def test_03_generate_proof_contract_structure(self):
        """Verifies generate_proof format with and without slot."""
        device_key = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"
        job_id = "job-uuid-777"
        challenge = "random_challenge_xyz"
        outcome = "MATCH"
        slot = 3

        proof_with_slot = device_client.generate_proof(device_key, job_id, challenge, outcome, slot)
        expected_payload1 = f"{job_id}|{challenge}|{outcome}|{slot}"
        expected_proof1 = hmac.new(bytes.fromhex(device_key), expected_payload1.encode('utf-8'), hashlib.sha256).hexdigest()
        self.assertEqual(proof_with_slot, expected_proof1)

        # Without slot (e.g. NO_MATCH or TIMEOUT)
        proof_no_slot = device_client.generate_proof(device_key, job_id, challenge, "NO_MATCH", None)
        expected_payload2 = f"{job_id}|{challenge}|NO_MATCH|"
        expected_proof2 = hmac.new(bytes.fromhex(device_key), expected_payload2.encode('utf-8'), hashlib.sha256).hexdigest()
        self.assertEqual(proof_no_slot, expected_proof2)

    # --------------------------------------------------------------------------
    # B. FINGERPRINT SENSOR DRIVER & ACTIONS
    # --------------------------------------------------------------------------
    def test_04_fingerprint_driver_packet_framing_and_checksum(self):
        """Validates that R307S driver generates correct packets and parses response."""
        ok = fingerprint.init_sensor()
        self.assertTrue(ok)

        # Test empty database
        code = fingerprint.empty_database()
        self.assertEqual(code, fingerprint.CONFIRM_OK)
        code, count = fingerprint.template_count()
        self.assertEqual(count, 0)

    def test_05_enrollment_routine_success(self):
        """Tests the two-touch enrollment flow using the fake UART."""
        # Set new finger present on sensor (not yet enrolled)
        self.fake_uart.simulated_finger_state = "NEW_FINGER"

        outcome, slot = enroll.enroll(target_slot=1, timeout_sec=2)
        self.assertEqual(outcome, "ENROLLED")
        self.assertEqual(slot, 1)
        self.assertIn(1, self.fake_uart.enrolled_slots)

    def test_06_verification_expected_slot_match(self):
        """Tests VERIFY_ACCESS matching expected slot."""
        self.fake_uart.simulated_finger_state = "CORRECT"
        self.fake_uart.expected_slot = 2

        outcome, matched_slot = verify.verify_expected(expected_slot=2, timeout_sec=2)
        self.assertEqual(outcome, "MATCH")
        self.assertEqual(matched_slot, 2)

    def test_07_verification_expected_slot_mismatch(self):
        """Tests VERIFY_ACCESS detecting WRONG_FINGER (different enrolled finger)."""
        self.fake_uart.simulated_finger_state = "WRONG"
        self.fake_uart.expected_slot = 2

        outcome, matched_slot = verify.verify_expected(expected_slot=2, timeout_sec=2)
        self.assertEqual(outcome, "WRONG_FINGER")
        self.assertEqual(matched_slot, 99)

    def test_08_verification_no_match(self):
        """Tests VERIFY_ACCESS with unknown fingerprint."""
        self.fake_uart.simulated_finger_state = "UNKNOWN"
        self.fake_uart.expected_slot = 2

        outcome, matched_slot = verify.verify_expected(expected_slot=2, timeout_sec=2)
        self.assertEqual(outcome, "NO_MATCH")
        self.assertIsNone(matched_slot)

    def test_09_verification_timeout(self):
        """Tests VERIFY_ACCESS timeout when no finger touches the sensor."""
        self.fake_uart.simulated_finger_state = None  # No finger

        outcome, matched_slot = verify.verify_expected(expected_slot=2, timeout_sec=1)
        self.assertEqual(outcome, "TIMEOUT")
        self.assertIsNone(matched_slot)

    # --------------------------------------------------------------------------
    # C. JOB STATE MACHINE & DUPLICATE PROTECTION
    # --------------------------------------------------------------------------
    def test_10_duplicate_job_protection_ring_buffer(self):
        """Verifies ring buffer retains 10 jobs and ignores duplicate executions."""
        cache = device_client.RecentJobsCache(capacity=10)

        for i in range(15):
            cache.add(f"job-{i}")

        # Oldest jobs 0-4 should have been evicted
        for i in range(5):
            self.assertFalse(cache.contains(f"job-{i}"))

        # Jobs 5-14 must be present
        for i in range(5, 15):
            self.assertTrue(cache.contains(f"job-{i}"))

    def test_11_device_client_handle_job_dispatches_properly(self):
        """Tests that client correctly handles and signs ENROLL, VERIFY, and DELETE jobs."""
        client = device_client.BioLockClient(
            base_url="http://mock-backend:8080",
            device_id="dev-test-1",
            device_key="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        )

        submitted_results = []
        def mock_submit(job_id, outcome, slot, challenge):
            submitted_results.append({
                "job_id": job_id,
                "outcome": outcome,
                "slot": slot,
                "challenge": challenge
            })
            return True

        client.submit_job_result = mock_submit
        self.fake_uart.simulated_finger_state = "CORRECT"
        self.fake_uart.expected_slot = 5

        # 1. VERIFY_ACCESS job
        job_verify = {
            "jobId": "job-verify-1",
            "type": "VERIFY_ACCESS",
            "expectedSlot": 5,
            "challenge": "chal-123"
        }
        client.handle_job(job_verify)
        self.assertEqual(len(submitted_results), 1)
        self.assertEqual(submitted_results[0]["outcome"], "MATCH")
        self.assertEqual(submitted_results[0]["slot"], 5)

        # 2. Duplicate VERIFY_ACCESS job -> should be ignored!
        client.handle_job(job_verify)
        self.assertEqual(len(submitted_results), 1)  # No new submission!

        # 3. DELETE_TEMPLATE job
        job_delete = {
            "jobId": "job-del-1",
            "type": "DELETE_TEMPLATE",
            "slot": 5,
            "challenge": "chal-del"
        }
        client.handle_job(job_delete)
        self.assertEqual(len(submitted_results), 2)
        self.assertEqual(submitted_results[1]["outcome"], "DELETED")

    # --------------------------------------------------------------------------
    # D. FAILURE PATHS & CONFIDENTIALITY
    # --------------------------------------------------------------------------
    def test_12_mid_job_network_drop_sends_nothing_and_lets_lease_expire(self):
        """Verifies that if network drops mid-job, client does not guess or submit fake results."""
        client = device_client.BioLockClient(
            base_url="http://mock-backend:8080",
            device_id="dev-test-1",
            device_key="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        )

        submit_called = []
        def mock_submit(job_id, outcome, slot, challenge):
            submit_called.append(job_id)
            return True

        client.submit_job_result = mock_submit
        self.fake_uart.simulated_finger_state = "CORRECT"
        self.fake_uart.expected_slot = 1

        # Simulate Wi-Fi drop mid-job
        client._network_offline_flag = True

        job = {
            "jobId": "job-drop-1",
            "type": "VERIFY_ACCESS",
            "expectedSlot": 1,
            "challenge": "chal-drop"
        }

        # Handling must detect offline state and send nothing
        client.handle_job(job)

        # Result was NOT submitted (server lease will expire safely)
        self.assertEqual(len(submit_called), 0)
        # Job is marked in recent_jobs so it is not retried locally
        self.assertTrue(client.recent_jobs.contains("job-drop-1"))

    def test_13_device_key_confidentiality(self):
        """Verifies that DEVICE_KEY is never logged or exposed in stdout/stderr."""
        secret_key = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"

        import io
        from contextlib import redirect_stdout, redirect_stderr

        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()

        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            headers = device_client.sign_request("GET", "/api/test", "", "dev-1", secret_key)
            proof = device_client.generate_proof(secret_key, "job-1", "chal", "MATCH", 1)

        output = stdout_buf.getvalue() + stderr_buf.getvalue()
        self.assertNotIn(secret_key, output)

if __name__ == "__main__":
    unittest.main()
