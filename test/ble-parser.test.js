'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  hasGoveeManufacturerPrefix,
  parseTempHumidBattery,
  parseH5179Format,
  parseByModel,
} = require('../lib/ble-parser');

const buf = (hex) => Buffer.from(hex, 'hex');

test('parseTempHumidBattery: H5074 with manufacturer-id prefix — sensor 1 from user log 2026-05-10', () => {
  // Real advert from user device A4:C1:38:8C:7A:64 (log a11bfc8c).
  // Pre-fix this returned 2.36°C / 22.09% / 16% (~20°C off — the reported bug).
  const result = parseTempHumidBattery(buf('88ec00a108900d5302'));
  assert.deepEqual(result, {
    temperature: 22.09,
    humidity: 34.72,
    battery: 83,
    hasError: false,
  });
});

test('parseTempHumidBattery: H5074 with manufacturer-id prefix — sensor 2 from user log 2026-05-10', () => {
  // Real advert from user device A4:C1:38:60:38:46.
  // Pre-fix this returned 2.36°C / 24.32% / 3% (battery also misread).
  const result = parseTempHumidBattery(buf('88ec008009830b5602'));
  assert.deepEqual(result, {
    temperature: 24.32,
    humidity: 29.47,
    battery: 86,
    hasError: false,
  });
});

test('parseTempHumidBattery: stripped 7-byte form yields the same values as the prefixed form', () => {
  // Same payload as sensor 1 but without the 88ec00 manufacturer-id prefix.
  // Guards the "Homey strips the company id" code path.
  const result = parseTempHumidBattery(buf('00a108900d5302'));
  assert.deepEqual(result, {
    temperature: 22.09,
    humidity: 34.72,
    battery: 83,
    hasError: false,
  });
});

test('parseTempHumidBattery: rejects Apple iBeacon advert (humidity out of range)', () => {
  // The H5074 at A4:C1:38:26:08:F4 also broadcasts an iBeacon "INTELLI_ROCKS_HW…".
  // The parser must not accidentally accept it.
  const result = parseTempHumidBattery(
    buf('4c000215494e54454c4c495f524f434b535f48575075f2ffc2'),
  );
  assert.equal(result, null);
});

test('parseTempHumidBattery: rejects buffer that is too short', () => {
  assert.equal(parseTempHumidBattery(buf('88ec0001')), null);
});

test('parseTempHumidBattery: rejects non-buffer input', () => {
  assert.equal(parseTempHumidBattery(null), null);
  assert.equal(parseTempHumidBattery('88ec00a108900d5302'), null);
});

test('hasGoveeManufacturerPrefix: detects 88 ec only on >=9 byte buffers', () => {
  assert.equal(hasGoveeManufacturerPrefix(buf('88ec00a108900d5302')), true);
  assert.equal(hasGoveeManufacturerPrefix(buf('00a108900d5302')), false); // 7 bytes
  assert.equal(hasGoveeManufacturerPrefix(buf('4c000215494e54454c4c495f524f434b535f48575075f2ffc2')), false);
});

test('parseH5179Format: real 11-byte advert (from a11bfc8c log)', () => {
  // Real device: parsed as 21.4°C / 37.7% / battery 79% in the live log.
  const result = parseH5179Format(buf('0188ec0001015c08ba0e4f'));
  assert.deepEqual(result, {
    temperature: 21.4,
    humidity: 37.7,
    battery: 79,
    hasError: false,
  });
});

test('parseH5179Format: rejects short buffers', () => {
  assert.equal(parseH5179Format(buf('0188ec000101')), null);
});

test('parseByModel: dispatches H5074 to parseTempHumidBattery', () => {
  const result = parseByModel('H5074', buf('88ec00a108900d5302'));
  assert.equal(result.temperature, 22.09);
  assert.equal(result.battery, 83);
});

test('parseByModel: dispatches H5179 to parseH5179Format', () => {
  const result = parseByModel('H5179', buf('0188ec0001015c08ba0e4f'));
  assert.equal(result.temperature, 21.4);
  assert.equal(result.battery, 79);
});

test('parseByModel: unknown model returns null for buffers shorter than the minimum standard length', () => {
  // Standard fallback needs >= 6 bytes; anything shorter must be dropped.
  assert.equal(parseByModel('H99XX', buf('88')), null);
  assert.equal(parseByModel('H99XX', buf('88ec')), null);
  assert.equal(parseByModel('H99XX', buf('88ec0001')), null);
});

test('parseByModel: rejects too-short buffer for meat-thermometer families', () => {
  assert.equal(parseByModel('H5181', buf('deadbeef')), null); // needs 14 bytes
  assert.equal(parseByModel('H5182', buf('deadbeef')), null); // needs 17 bytes
  assert.equal(parseByModel('H5185', buf('deadbeef')), null); // needs 20 bytes
});
