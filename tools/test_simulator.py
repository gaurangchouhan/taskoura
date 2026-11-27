#!/usr/bin/env python3
"""
Test Suite for Taskoura BioLock Device Simulator against Canonical Test Vector.
Asserts that signature generation and proof calculation match docs/biolock/test-vector.json exactly.
"""

import os
import sys
import json
import unittest

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS_DIR)

import biolock_device_simulator as sim

class TestBioLockSimulator(unittest.TestCase):
    def setUp(self):
        tv_path = os.path.join(TOOLS_DIR, "..", "docs", "biolock", "test-vector.json")
        self.assertTrue(os.path.exists(tv_path), f"Test vector not found at {tv_path}")
        with open(tv_path, "r", encoding="utf-8") as f:
            self.tv = json.load(f)

    def test_canonical_request_signature(self):
        """Verifies request signing against docs/biolock/test-vector.json."""
        headers = sim.sign_request(
            method=self.tv["method"],
            path=self.tv["path"],
            body_bytes=self.tv["body"].encode("utf-8"),
            device_id=self.tv["deviceId"],
            device_key_hex=self.tv["deviceKey"],
            timestamp_str=self.tv["timestamp"],
            nonce_hex=self.tv["nonce"]
        )

        self.assertEqual(headers["X-Device-Id"], self.tv["deviceId"])
        self.assertEqual(headers["X-Timestamp"], self.tv["timestamp"])
        self.assertEqual(headers["X-Nonce"], self.tv["nonce"])
        self.assertEqual(headers["X-Signature"], self.tv["expectedSignature"])

    def test_canonical_proof_with_slot(self):
        """Verifies proof calculation with slot against docs/biolock/test-vector.json."""
        proof = sim.generate_proof(
            device_key_hex=self.tv["deviceKey"],
            job_id=self.tv["jobId"],
            challenge=self.tv["challenge"],
            outcome=self.tv["outcome"],
            slot=self.tv["slot"]
        )
        self.assertEqual(proof, self.tv["expectedProof"])

    def test_canonical_proof_without_slot(self):
        """Verifies proof calculation without slot against docs/biolock/test-vector.json."""
        proof = sim.generate_proof(
            device_key_hex=self.tv["deviceKey"],
            job_id=self.tv["jobId"],
            challenge=self.tv["challenge"],
            outcome=self.tv["outcomeNoSlot"],
            slot=None
        )
        self.assertEqual(proof, self.tv["expectedProofNoSlot"])

    def test_state_persistence(self):
        """Verifies state file loading and slot persistence."""
        test_state = {"enrolled_slots": [1, 2, 5]}
        sim.save_sim_state(test_state)
        loaded = sim.load_sim_state()
        self.assertEqual(loaded["enrolled_slots"], [1, 2, 5])
        # Clean up
        if os.path.exists(sim.STATE_FILE):
            os.remove(sim.STATE_FILE)

if __name__ == "__main__":
    unittest.main()
