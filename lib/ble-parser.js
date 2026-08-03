'use strict';

const TEMP_MIN = -40;
const TEMP_MAX = 100;
// Meat thermometers can read much higher than a room sensor.
const TEMP_MAX_MEAT = 300;

// Model families that share a parser. Kept as sets so parseByModel stays a
// straight dispatch table without falling into a giant if/else chain.
const MODELS_STANDARD = ['H5072', 'H5075', 'H5100', 'H5101', 'H5102', 'H5103', 'H5104', 'H5105', 'H5108', 'H5110', 'H5174', 'H5177'];
const MODELS_9BYTE_TEMPHUMID = ['H5051', 'H5052', 'H5071'];
const MODELS_H5178 = ['H5178', 'B5178'];
const MODELS_H5181 = ['H5181', 'H5183'];
const MODELS_H5182 = ['H5182', 'H5184'];
const MODELS_H5185 = ['H5185', 'H5191', 'H5198'];

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

// Standard Govee 6-byte format used by H5072/H5075 and the H5100-family.
// Temperature+humidity are packed into a 24-bit big-endian value:
//   sign in top bit, magnitude / 1000 = tenths of °C, magnitude % 1000 = tenths of %RH.
// The library historically probes offsets 2/1/0 because Homey's BLE layer is
// inconsistent about whether the buffer includes header bytes.
function parseStandardFormat(data) {
  if (!Buffer.isBuffer(data)) return null;
  for (const offset of [2, 1, 0]) {
    if (offset + 4 > data.length) continue;

    const tempHumidValue = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
    if (tempHumidValue === 0 || tempHumidValue === 0xFFFFFF) continue;

    const isNegative = !!(tempHumidValue & 0x800000);
    const magnitude = tempHumidValue & 0x7FFFFF;

    const temperature = (isNegative ? -1 : 1) * Math.floor(magnitude / 1000) / 10;
    const humidity = (magnitude % 1000) / 10;

    const batteryByte = data[offset + 3];
    const battery = Math.min(batteryByte & 0x7F, 100);
    const hasError = !!(batteryByte & 0x80);

    if (temperature < TEMP_MIN || temperature > TEMP_MAX) continue;
    if (humidity < 0 || humidity > 100) continue;

    return { temperature, humidity, battery, hasError };
  }
  return null;
}

// H5178/B5178 dual-sensor: byte 2 upper nibble is the sensor id (0 = primary
// unit, 1 = remote). We only surface the primary reading.
function parseH5178Format(data) {
  if (!Buffer.isBuffer(data) || data.length < 9) return null;

  const sensorId = (data[2] >> 4) & 0x0F;
  if (sensorId !== 0) return null;

  const temperature = data.readInt16LE(3) / 100;
  const humidity = data.readUInt16LE(5) / 100;
  const battery = Math.min(data[7] & 0x7F, 100);
  const hasError = !!(data[7] & 0x80);

  if (temperature < TEMP_MIN || temperature > TEMP_MAX) return null;
  if (humidity < 0 || humidity > 100) return null;

  return { temperature, humidity, battery, hasError };
}

// H5179 (11-byte, confirmed from a real device broadcast).
// Bytes 6-7: temperature int16 LE / 100
// Bytes 8-9: humidity uint16 LE / 100
// Byte 10:   battery percentage
function parseH5179Format(data) {
  if (!Buffer.isBuffer(data) || data.length < 11) return null;

  const temperature = data.readInt16LE(6) / 100;
  const humidity = data.readUInt16LE(8) / 100;
  const battery = Math.min(data[10], 100);

  if (temperature < TEMP_MIN || temperature > TEMP_MAX) return null;
  if (humidity < 0 || humidity > 100) return null;

  return { temperature, humidity, battery, hasError: false };
}

// H5106 (temp/humidity/PM2.5). Packs a 4-byte value; top bit is a flag,
// remainder / 10000 gives temperature tenths and % 1000 the humidity tenths.
function parseH5106Format(data) {
  if (!Buffer.isBuffer(data) || data.length < 6) return null;

  const combined = (data[2] << 24) | (data[3] << 16) | (data[4] << 8) | data[5];
  const magnitude = combined & 0x7FFFFFFF;

  const temperature = Math.floor(magnitude / 10000) / 10;
  const humidity = (Math.floor(magnitude / 10) % 1000) / 10;
  const battery = Math.min(data[1] & 0x7F, 100);

  if (temperature < TEMP_MIN || temperature > TEMP_MAX) return null;
  if (humidity < 0 || humidity > 100) return null;

  return { temperature, humidity, battery, hasError: false };
}

// H5181/H5183 single-probe meat thermometer.
// Big-endian temperature at offset 8, battery lives at offset 2.
function parseH5181Format(data) {
  if (!Buffer.isBuffer(data) || data.length < 14) return null;

  const temperature = data.readInt16BE(8) / 100;
  const battery = Math.min(data[2] & 0x7F, 100);

  if (temperature < TEMP_MIN || temperature > TEMP_MAX_MEAT) return null;

  return { temperature, battery, hasError: false };
}

// H5182/H5184 dual-probe meat thermometer. Returns the primary probe unless it
// has the 0x7FFF sentinel, in which case we fall back to the secondary probe.
function parseH5182Format(data) {
  if (!Buffer.isBuffer(data) || data.length < 17) return null;

  const temperature1 = data.readInt16BE(8) / 100;
  const temperature2 = data.readInt16BE(12) / 100;
  const battery = Math.min(data[2] & 0x7F, 100);
  const temperature = temperature1 !== 0x7FFF / 100 ? temperature1 : temperature2;

  if (temperature < TEMP_MIN || temperature > TEMP_MAX_MEAT) return null;

  return { temperature, battery, hasError: false };
}

// H5185/H5191/H5198 multi-probe (up to 4) meat thermometer. Big-endian,
// starting at offset 6. Reports the first valid probe reading.
function parseH5185Format(data) {
  if (!Buffer.isBuffer(data) || data.length < 20) return null;

  const probes = [];
  for (let i = 0; i < 4 && (6 + i * 2 + 1) < data.length; i++) {
    const temp = data.readInt16BE(6 + i * 2) / 100;
    if (temp !== 0x7FFF / 100 && temp > TEMP_MIN && temp < TEMP_MAX_MEAT) {
      probes.push(temp);
    }
  }
  if (probes.length === 0) return null;

  const battery = Math.min(data[2] & 0x7F, 100);
  return { temperature: probes[0], battery, hasError: false };
}

// H5055 6-probe meat thermometer, little-endian starting at offset 4.
function parseH5055Format(data) {
  if (!Buffer.isBuffer(data) || data.length < 20) return null;

  const probes = [];
  for (let i = 0; i < 6 && (4 + i * 2 + 1) < data.length; i++) {
    const temp = data.readInt16LE(4 + i * 2) / 100;
    if (temp !== 0x7FFF / 100 && temp > TEMP_MIN && temp < TEMP_MAX_MEAT) {
      probes.push(temp);
    }
  }
  if (probes.length === 0) return null;

  const battery = Math.min(data[2] & 0x7F, 100);
  return { temperature: probes[0], battery, hasError: false };
}

// Top-level dispatcher used by the driver AND the settings diagnostic tool.
// Returns null when the model/length combination is unsupported so callers
// can decide whether to fall back or ignore.
function parseByModel(model, data) {
  if (!Buffer.isBuffer(data)) return null;
  const len = data.length;

  if (MODELS_STANDARD.includes(model) && len >= 6) return parseStandardFormat(data);
  if (model === 'H5074' && len >= 7) return parseTempHumidBattery(data);
  if (MODELS_9BYTE_TEMPHUMID.includes(model) && len >= 9) return parseTempHumidBattery(data);
  if (MODELS_H5178.includes(model) && len >= 9) return parseH5178Format(data);
  if (model === 'H5179' && len >= 9) return parseH5179Format(data);
  if (model === 'H5106' && len >= 6) return parseH5106Format(data);
  if (MODELS_H5181.includes(model) && len >= 14) return parseH5181Format(data);
  if (MODELS_H5182.includes(model) && len >= 17) return parseH5182Format(data);
  if (MODELS_H5185.includes(model) && len >= 20) return parseH5185Format(data);
  if (model === 'H5055' && len >= 20) return parseH5055Format(data);

  // Unknown model — try the standard format as a last resort so a new sensor
  // model at least has a chance of working.
  if (len >= 6) return parseStandardFormat(data);

  return null;
}

// Set of every model this parser has explicit support for. The BLE scanner
// diagnostic uses this to avoid running an unknown Govee device's advertisement
// bytes through the fallback path — for a random LED strip that just happens
// to broadcast, parseStandardFormat readily produces plausible-looking
// temp/humid values from arbitrary bytes, which is a UI landmine.
const KNOWN_SENSOR_MODELS = new Set([
  ...MODELS_STANDARD,
  'H5074',
  ...MODELS_9BYTE_TEMPHUMID,
  ...MODELS_H5178,
  'H5179',
  'H5106',
  ...MODELS_H5181,
  ...MODELS_H5182,
  ...MODELS_H5185,
  'H5055',
]);

function isKnownSensorModel(model) {
  return typeof model === 'string' && KNOWN_SENSOR_MODELS.has(model.toUpperCase());
}

module.exports = {
  hasGoveeManufacturerPrefix,
  parseTempHumidBattery,
  parseStandardFormat,
  parseH5178Format,
  parseH5179Format,
  parseH5106Format,
  parseH5181Format,
  parseH5182Format,
  parseH5185Format,
  parseH5055Format,
  parseByModel,
  isKnownSensorModel,
  KNOWN_SENSOR_MODELS,
  MODELS_STANDARD,
  MODELS_9BYTE_TEMPHUMID,
  MODELS_H5178,
  MODELS_H5181,
  MODELS_H5182,
  MODELS_H5185,
};
