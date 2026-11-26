"""
Taskoura BioLock - GROW / Synochip R307 / R307S Optical Fingerprint Driver
Implements serial packet protocol (57600 baud, 8N1).
Works seamlessly on ESP32-S2 (MicroPython) and host CPython (with mock UART).
"""

import time
import config

# Protocol Constants
HEADER = b'\xef\x01'
PID_COMMAND = 0x01
PID_ACK = 0x07
PID_DATA = 0x02
PID_END_DATA = 0x08

# Instructions
CMD_GEN_IMG = 0x01
CMD_IMG_2_TZ = 0x02
CMD_MATCH = 0x03
CMD_SEARCH = 0x04
CMD_REG_MODEL = 0x05
CMD_STORE = 0x06
CMD_LOAD_CHAR = 0x07
CMD_DELET_CHAR = 0x0c
CMD_EMPTY = 0x0d
CMD_VFY_PWD = 0x13
CMD_TEMPLATE_NUM = 0x1d
CMD_AURA_LED = 0x35

# Confirmation Codes
CONFIRM_OK = 0x00
CONFIRM_PACKET_ERR = 0x01
CONFIRM_NO_FINGER = 0x02
CONFIRM_FAIL_ENROLL = 0x03
CONFIRM_DISORDERLY_IMG = 0x06
CONFIRM_TOO_SMALL_IMG = 0x07
CONFIRM_NO_MATCH = 0x09
CONFIRM_FAIL_COMBINE = 0x0a
CONFIRM_BAD_SLOT = 0x0b
CONFIRM_FAIL_DELETE = 0x10
CONFIRM_FAIL_CLEAR = 0x11
CONFIRM_FLASH_ERR = 0x18
CONFIRM_TIMEOUT = 0xfe
CONFIRM_COMM_ERR = 0xff

_uart = None

def get_uart():
    """Returns the active UART instance, creating it if needed."""
    global _uart
    if _uart is None:
        try:
            import machine
            _uart = machine.UART(
                config.UART_ID,
                baudrate=config.BAUD_RATE,
                tx=config.TX_PIN,
                rx=config.RX_PIN,
                timeout=500
            )
        except (ImportError, AttributeError):
            _uart = None
    return _uart

def set_uart(mock_uart):
    """Allows test suites to inject a simulated UART."""
    global _uart
    _uart = mock_uart

def _build_packet(pid, payload):
    """Builds a framed protocol packet with header, address, length, and checksum."""
    length = len(payload) + 2
    pkt_header = HEADER + config.SENSOR_ADDRESS.to_bytes(4, 'big')
    pkt_mid = bytes([pid, (length >> 8) & 0xff, length & 0xff]) + payload
    checksum = pid + ((length >> 8) & 0xff) + (length & 0xff) + sum(payload)
    chk_bytes = bytes([(checksum >> 8) & 0xff, checksum & 0xff])
    return pkt_header + pkt_mid + chk_bytes

def _send_command(cmd, params=b''):
    """Sends a command packet to the fingerprint sensor."""
    uart = get_uart()
    if uart is None:
        return CONFIRM_COMM_ERR, b''

    packet = _build_packet(PID_COMMAND, bytes([cmd]) + params)
    uart.write(packet)
    return _read_response()

def _read_exact(uart, count, timeout_ms=500):
    """Reads exact number of bytes from UART with timeout."""
    buf = bytearray()
    start = time.time()
    while len(buf) < count:
        if hasattr(uart, 'any') and uart.any():
            chunk = uart.read(count - len(buf))
            if chunk:
                buf.extend(chunk)
        elif hasattr(uart, 'read'):
            chunk = uart.read(count - len(buf))
            if chunk:
                buf.extend(chunk)
        else:
            break
        if (time.time() - start) * 1000 > timeout_ms:
            break
        time.sleep(0.005)
    return bytes(buf)

def _read_response():
    """Reads and parses an acknowledge packet from the sensor."""
    uart = get_uart()
    if uart is None:
        return CONFIRM_COMM_ERR, b''

    # Read Header (2 bytes) + Address (4 bytes)
    head = _read_exact(uart, 6)
    if len(head) < 6 or head[:2] != HEADER:
        return CONFIRM_COMM_ERR, b''

    # Read PID (1 byte) + Length (2 bytes)
    meta = _read_exact(uart, 3)
    if len(meta) < 3:
        return CONFIRM_COMM_ERR, b''

    pid = meta[0]
    length = (meta[1] << 8) | meta[2]
    if length < 2 or length > 512:
        return CONFIRM_PACKET_ERR, b''

    # Read payload + Checksum (length bytes)
    data = _read_exact(uart, length)
    if len(data) < length:
        return CONFIRM_COMM_ERR, b''

    content = data[:-2]
    received_chk = (data[-2] << 8) | data[-1]
    expected_chk = pid + meta[1] + meta[2] + sum(content)
    if (expected_chk & 0xffff) != received_chk:
        return CONFIRM_PACKET_ERR, b''

    if len(content) < 1:
        return CONFIRM_COMM_ERR, b''

    confirmation_code = content[0]
    result_data = content[1:]
    return confirmation_code, result_data

# ==============================================================================
# SENSOR API FUNCTIONS
# ==============================================================================

def init_sensor():
    """Verifies sensor password / handshake."""
    pwd_bytes = config.SENSOR_PASSWORD.to_bytes(4, 'big')
    code, _ = _send_command(CMD_VFY_PWD, pwd_bytes)
    return code == CONFIRM_OK

def read_image():
    """Captures finger image into sensor image buffer. Returns confirmation code."""
    code, _ = _send_command(CMD_GEN_IMG)
    return code

def image_to_template(buffer_id=1):
    """Converts image to character file in CharBuffer1 or CharBuffer2."""
    code, _ = _send_command(CMD_IMG_2_TZ, bytes([buffer_id]))
    return code

def create_model():
    """Combines CharBuffer1 and CharBuffer2 to generate a composite template."""
    code, _ = _send_command(CMD_REG_MODEL)
    return code

def store_model(slot, buffer_id=1):
    """Stores template from buffer into Flash library slot (0-299)."""
    params = bytes([buffer_id, (slot >> 8) & 0xff, slot & 0xff])
    code, _ = _send_command(CMD_STORE, params)
    return code

def search_finger(buffer_id=1, start_slot=0, count=300):
    """
    Searches library for template matching buffer.
    Returns (code, matched_slot, score).
    """
    params = bytes([
        buffer_id,
        (start_slot >> 8) & 0xff, start_slot & 0xff,
        (count >> 8) & 0xff, count & 0xff
    ])
    code, data = _send_command(CMD_SEARCH, params)
    if code == CONFIRM_OK and len(data) >= 4:
        slot = (data[0] << 8) | data[1]
        score = (data[2] << 8) | data[3]
        return code, slot, score
    return code, None, 0

def match_templates():
    """Directly compares CharBuffer1 and CharBuffer2. Returns (code, score)."""
    code, data = _send_command(CMD_MATCH)
    if code == CONFIRM_OK and len(data) >= 2:
        score = (data[0] << 8) | data[1]
        return code, score
    return code, 0

def delete_template(slot, count=1):
    """Deletes `count` templates starting at slot."""
    params = bytes([
        (slot >> 8) & 0xff, slot & 0xff,
        (count >> 8) & 0xff, count & 0xff
    ])
    code, _ = _send_command(CMD_DELET_CHAR, params)
    return code

def empty_database():
    """Clears all templates from the sensor library."""
    code, _ = _send_command(CMD_EMPTY)
    return code

def template_count():
    """Reads valid template count. Returns (code, count)."""
    code, data = _send_command(CMD_TEMPLATE_NUM)
    if code == CONFIRM_OK and len(data) >= 2:
        count = (data[0] << 8) | data[1]
        return code, count
    return code, 0

def set_aura_led(mode=1, speed=100, color=1, count=0):
    """Optional: Controls R307S Aura LED if supported."""
    params = bytes([mode, speed, color, count])
    code, _ = _send_command(CMD_AURA_LED, params)
    return code
