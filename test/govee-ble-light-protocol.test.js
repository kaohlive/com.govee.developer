'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPowerCommand,
  buildBrightnessCommand,
  buildColorCommand,
  isKnownLightModel,
  checksum,
} = require('../lib/govee-ble-light-protocol');

test('isKnownLightModel: recognizes H617A case-insensitively', () => {
  assert.equal(isKnownLightModel('H617A'), true);
  assert.equal(isKnownLightModel('h617a'), true);
});

test('isKnownLightModel: rejects unsupported/missing models', () => {
  assert.equal(isKnownLightModel('H6072'), false);
  assert.equal(isKnownLightModel(null), false);
  assert.equal(isKnownLightModel(undefined), false);
});

test('buildPowerCommand: on', () => {
  assert.equal(buildPowerCommand(true).toString('hex'), '3301010000000000000000000000000000000033');
});

test('buildPowerCommand: off', () => {
  assert.equal(buildPowerCommand(false).toString('hex'), '3301000000000000000000000000000000000032');
});

test('buildBrightnessCommand: H617A scales 0-255 down to a 0-100 percentage', () => {
  assert.equal(buildBrightnessCommand(255, 'H617A')[2], 100);
  assert.equal(buildBrightnessCommand(0, 'H617A')[2], 0);
  assert.equal(buildBrightnessCommand(128, 'H617A')[2], 50);
});

test('buildBrightnessCommand: non-percent models send the raw 0-255 byte', () => {
  assert.equal(buildBrightnessCommand(200, 'H6072')[2], 200);
});

test('buildColorCommand: H617A uses the segmented format with the 0xFF 0x7F trailer', () => {
  const frame = buildColorCommand(0x11, 0x22, 0x33, 'H617A');
  // 33 05 [mode=15] [segment=01] R G B 00 00 00 00 00 FF 7F 00 [checksum]
  assert.equal(frame.toString('hex'), '330515011122330000000000ff7f0000000000a2');
});

test('every generated frame is 20 bytes and checksums correctly', () => {
  const frames = [
    buildPowerCommand(true),
    buildPowerCommand(false),
    buildBrightnessCommand(128, 'H617A'),
    buildColorCommand(1, 2, 3, 'H617A'),
  ];
  for (const frame of frames) {
    assert.equal(frame.length, 20);
    assert.equal(frame[19], checksum(frame.subarray(0, 19)));
  }
});
