'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildTurn, buildBrightness, buildColor } = require('../lib/lan-control-messages');

test('buildTurn: on produces value=1', () => {
  assert.equal(buildTurn(true), '{"msg":{"cmd":"turn","data":{"value":1}}}');
  assert.equal(buildTurn(1), '{"msg":{"cmd":"turn","data":{"value":1}}}');
});

test('buildTurn: off produces value=0', () => {
  assert.equal(buildTurn(false), '{"msg":{"cmd":"turn","data":{"value":0}}}');
  assert.equal(buildTurn(0), '{"msg":{"cmd":"turn","data":{"value":0}}}');
});

test('buildBrightness: integer value passes through', () => {
  assert.equal(buildBrightness(50), '{"msg":{"cmd":"brightness","data":{"value":50}}}');
});

test('buildBrightness: float value rounded to 2 decimals (matches library behaviour)', () => {
  assert.equal(buildBrightness(75.456), '{"msg":{"cmd":"brightness","data":{"value":75.46}}}');
});

test('buildColor: kelvin path produces colorwc with colorTemInKelvin', () => {
  assert.equal(
    buildColor({ kelvin: 4000 }),
    '{"msg":{"cmd":"colorwc","data":{"colorTemInKelvin":4000}}}',
  );
});

test('buildColor: kelvin tolerates string inputs with units', () => {
  assert.equal(
    buildColor({ kelvin: '4000K' }),
    '{"msg":{"cmd":"colorwc","data":{"colorTemInKelvin":4000}}}',
  );
});

test('buildColor: rgb path produces colorwc with color object', () => {
  assert.equal(
    buildColor({ rgb: [255, 128, 64] }),
    '{"msg":{"cmd":"colorwc","data":{"color":{"r":255,"g":128,"b":64}}}}',
  );
});

test('buildColor: throws on invalid options', () => {
  assert.throws(() => buildColor({}), /must have/);
  assert.throws(() => buildColor({ rgb: [1, 2] }), /must have/);
  assert.throws(() => buildColor(null), /must have/);
});
