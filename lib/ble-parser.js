'use strict';

const TEMP_MIN = -40;
const TEMP_MAX = 100;

// Govee BLE company identifier (0xEC88, little-endian on the wire).
// Homey's BLE layer sometimes hands us the manufacturerData with the
// company-id prefix still attached, sometimes stripped. Detect to handle both.
function hasGoveeManufacturerPrefix(data) {
  return data.length >= 9 && data[0] === 0x88 && data[1] === 0xEC;
}

// Shared payload layout used by H5074 and the H5051/H5052/H5071 "9-byte" sensors.
// After any 0xEC88 + flag-byte prefix is skipped:
//   bytes 1-2: temperature, int16 LE / 100
//   bytes 3-4: humidity,    uint16 LE / 100
//   byte 5:    battery (low 7 bits, in %)
function parseTempHumidBattery(data) {
  if (!Buffer.isBuffer(data)) return null;
  const off = hasGoveeManufacturerPrefix(data) ? 2 : 0;
  if (data.length < off + 6) return null;

  const temperature = data.readInt16LE(off + 1) / 100;
  const humidity = data.readUInt16LE(off + 3) / 100;
  const battery = Math.min(data[off + 5] & 0x7F, 100);

  if (temperature < TEMP_MIN || temperature > TEMP_MAX) return null;
  if (humidity < 0 || humidity > 100) return null;

  return { temperature, humidity, battery, hasError: false };
}

module.exports = {
  hasGoveeManufacturerPrefix,
  parseTempHumidBattery,
};
