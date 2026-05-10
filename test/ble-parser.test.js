'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  hasGoveeManufacturerPrefix,
  parseTempHumidBattery,
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
