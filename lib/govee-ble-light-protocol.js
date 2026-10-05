'use strict';

// Govee BLE light control protocol.
//
// Reverse-engineered by the community (not published by Govee). Cross-checked
// against multiple independent sources for the H617A specifically:
//   https://github.com/Rombond/h617a_govee_ble_lights (fork of Beshelmek/govee_ble_lights)
//   https://blog.coding.kiwi/reverse-engineering-govee-smart-lights/
// Packets are 20 bytes: [commandType, commandCode, ...payload padded to 17
// bytes] followed by an XOR checksum of the first 19 bytes.

const SERVICE_UUID = '000102030405060708090a0b0c0d1910';
const CONTROL_CHARACTERISTIC_UUID = '000102030405060708090a0b0c0d2b11';

const COMMAND_TYPE = 0x33;

const LedCommand = {
  POWER: 0x01,
  BRIGHTNESS: 0x04,
  COLOR: 0x05,
};

const LedMode = {
  MANUAL: 0x02,
  SEGMENTS: 0x15,
};

// Models this driver knows how to pair with and control at all.
const KNOWN_MODELS = new Set(['H617A']);

// Models known to require the "segmented" (0x15) color command format
// instead of the plain MANUAL (0x02) one, and to take brightness as a
// 0-100 percentage rather than a raw 0-255 byte. So far this is only
// verified against the H617A. Kept separate from KNOWN_MODELS so a future
// non-segmented model doesn't need to be (mis)classified as segmented just
// to be discoverable.
const SEGMENTED_MODELS = new Set(['H617A']);
const PERCENT_BRIGHTNESS_MODELS = new Set(['H617A']);

function isKnownLightModel(model) {
  return typeof model === 'string' && KNOWN_MODELS.has(model.toUpperCase());
}

function checksum(bytes) {
  let sum = 0;
  for (const b of bytes) sum ^= b;
  return sum & 0xff;
}

/**
 * Build a single 20-byte command frame.
 * @param {number} cmd One of LedCommand
 * @param {number[]} payload Up to 17 bytes
 * @returns {Buffer}
 */
function buildFrame(cmd, payload) {
  if (payload.length > 17) throw new Error('payload too long for a single BLE frame');

  const frame = Buffer.alloc(20);
  frame[0] = COMMAND_TYPE;
  frame[1] = cmd & 0xff;
  for (let i = 0; i < payload.length; i++) {
    frame[2 + i] = payload[i] & 0xff;
  }
  frame[19] = checksum(frame.subarray(0, 19));
  return frame;
}

function buildPowerCommand(on) {
  return buildFrame(LedCommand.POWER, [on ? 0x1 : 0x0]);
}

/**
 * @param {number} brightness 0-255 (Homey's 'dim' capability scale x255)
 * @param {string} model
 */
function buildBrightnessCommand(brightness, model) {
  const clamped = Math.max(0, Math.min(255, Math.round(brightness)));
  const value = PERCENT_BRIGHTNESS_MODELS.has((model || '').toUpperCase())
    ? Math.round((clamped / 255) * 100)
    : clamped;
  return buildFrame(LedCommand.BRIGHTNESS, [value]);
}

/**
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @param {string} model
 */
function buildColorCommand(r, g, b, model) {
  if (SEGMENTED_MODELS.has((model || '').toUpperCase())) {
    // Segment bitmask 0x01 + trailing 0xFF 0x7F are required by the
    // segmented command format; omitting them causes the light to ignore
    // the packet. This applies the color to the whole strip.
    return buildFrame(LedCommand.COLOR, [
      LedMode.SEGMENTS, 0x01, r, g, b, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x7f,
    ]);
  }
  return buildFrame(LedCommand.COLOR, [LedMode.MANUAL, r, g, b]);
}

module.exports = {
  SERVICE_UUID,
  CONTROL_CHARACTERISTIC_UUID,
  isKnownLightModel,
  buildPowerCommand,
  buildBrightnessCommand,
  buildColorCommand,
  // exposed for tests
  checksum,
};
