#!/usr/bin/env bash
# BioLock Device Request Signature & curl Test Helper
# Usage:
#   ./test-signature-helper.sh <DEVICE_ID> <DEVICE_KEY_HEX> <METHOD> <PATH> [BODY_JSON] [BASE_URL]
#
# Examples:
#   ./test-signature-helper.sh c45469d4-ca76-4168-941e-e0f761d7a278 1a2b3c... GET /api/device/biolock/jobs/next
#   ./test-signature-helper.sh c45469d4-ca76-4168-941e-e0f761d7a278 1a2b3c... POST /api/device/biolock/jobs/JOB_UUID/result '{"outcome":"ENROLLED","slot":1,"proof":"..."}'

set -euo pipefail

DEVICE_ID="${1:-}"
DEVICE_KEY_HEX="${2:-}"
METHOD="${3:-GET}"
REQ_PATH="${4:-/api/device/biolock/jobs/next}"
BODY="${5:-}"
BASE_URL="${6:-http://localhost:8080}"

if [[ -z "$DEVICE_ID" || -z "$DEVICE_KEY_HEX" ]]; then
    echo "Usage: $0 <DEVICE_ID> <DEVICE_KEY_HEX> [METHOD] [PATH] [BODY_JSON] [BASE_URL]"
    exit 1
fi

METHOD=$(echo "$METHOD" | tr '[:lower:]' '[:upper:]')
TIMESTAMP=$(date +%s)
NONCE=$(python3 -c "import secrets; print(secrets.token_hex(16))")

# Compute SHA256 of request body
BODY_SHA256=$(python3 -c "
import hashlib, sys
body = sys.argv[1].encode('utf-8')
print(hashlib.sha256(body).hexdigest())
" "$BODY")

# Calculate HMAC-SHA256 signature
SIGNATURE=$(python3 -c "
import hmac, hashlib, sys
key_hex = sys.argv[1]
method = sys.argv[2]
path = sys.argv[3]
timestamp = sys.argv[4]
nonce = sys.argv[5]
body_hash = sys.argv[6]

payload = f'{method}\n{path}\n{timestamp}\n{nonce}\n{body_hash}'
key_bytes = bytes.fromhex(key_hex)
sig = hmac.new(key_bytes, payload.encode('utf-8'), hashlib.sha256).hexdigest()
print(sig)
" "$DEVICE_KEY_HEX" "$METHOD" "$REQ_PATH" "$TIMESTAMP" "$NONCE" "$BODY_SHA256")

echo "Generated Signature Headers:"
echo "  X-Device-Id: $DEVICE_ID"
echo "  X-Timestamp: $TIMESTAMP"
echo "  X-Nonce:     $NONCE"
echo "  X-Signature: $SIGNATURE"
echo ""
echo "Example curl command:"
if [[ -n "$BODY" ]]; then
    echo "curl -X $METHOD \"${BASE_URL}${REQ_PATH}\" \\"
    echo "  -H \"Content-Type: application/json\" \\"
    echo "  -H \"X-Device-Id: $DEVICE_ID\" \\"
    echo "  -H \"X-Timestamp: $TIMESTAMP\" \\"
    echo "  -H \"X-Nonce: $NONCE\" \\"
    echo "  -H \"X-Signature: $SIGNATURE\" \\"
    echo "  -d '$BODY'"
else
    echo "curl -X $METHOD \"${BASE_URL}${REQ_PATH}\" \\"
    echo "  -H \"X-Device-Id: $DEVICE_ID\" \\"
    echo "  -H \"X-Timestamp: $TIMESTAMP\" \\"
    echo "  -H \"X-Nonce: $NONCE\" \\"
    echo "  -H \"X-Signature: $SIGNATURE\""
fi
