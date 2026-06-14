'use strict';

// Wire-format builders for the Govee LAN-control protocol.
// Mirrors govee-lan-control's Device.actions, but as pure functions so the
// caller can target a device by IP without an existing library Device object.
// Used by the cross-VLAN fallback path in govee-localapi.js.

function buildTurn(on) {
  return JSON.stringify({ msg: { cmd: 'turn', data: { value: on ? 1 : 0 } } });
}

// brightness is a 0–100 integer (Govee's range). Caller is responsible
// for converting from the Homey 0–1 dim scale.
function buildBrightness(brightness) {
  const rounded = Math.round(Number(brightness) * 100) / 100;
  return JSON.stringify({ msg: { cmd: 'brightness', data: { value: rounded } } });
}

// Accepts either { kelvin: <int> } or { rgb: [r, g, b] }. Mirrors the
// library's setColor branching (we don't replicate hex/hsl since the
// localdriver only calls us with kelvin or rgb).
function buildColor(options) {
  if (options && options.kelvin != null) {
    const kelvin = parseFloat(String(options.kelvin).replace(/[^0-9]/g, ''));
    return JSON.stringify({ msg: { cmd: 'colorwc', data: { colorTemInKelvin: kelvin } } });
  }
  if (options && Array.isArray(options.rgb) && options.rgb.length === 3) {
    const [r, g, b] = options.rgb;
    return JSON.stringify({ msg: { cmd: 'colorwc', data: { color: { r, g, b } } } });
  }
  throw new Error('buildColor: options must have { kelvin } or { rgb: [r, g, b] }');
}

module.exports = { buildTurn, buildBrightness, buildColor };
