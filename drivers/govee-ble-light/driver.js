'use strict';

const { Driver } = require('homey');
const { isKnownLightModel } = require('../../lib/govee-ble-light-protocol');

// Govee model code from a BLE local name like "Govee_H617A_54F6".
const MODEL_PATTERN = /^Govee_(H[0-9A-Z]{4})/i;

// homey.ble.discover() reliably takes ~10s (its timeout parameter is
// ignored - a known SDK quirk, see discoverBLELights() below). This is a
// hang safety net set comfortably above that, not the expected wait.
const DISCOVERY_SAFETY_TIMEOUT_MS = 15000;

// A non-empty scan result is reused for this long, so reopening the pair
// dialog right after a pairing doesn't pay for another ~10s scan.
const DISCOVERY_CACHE_MS = 60000;

class GoveeBLELightDriver extends Driver {

  async onInit() {
    this.log('Govee BLE Light driver initialized');
    this._discoveryPromise = null;
    this._cachedDevices = null;
    this._cacheTime = 0;
  }

  /**
   * Scan only when pairing: a scan at app start would occupy the radio for
   * every user, including those without BLE lights, and compete with the
   * BLE sensor polling. Starting the scan in onPair (not in list_devices)
   * lets it run while the pair dialog opens.
   */
  _startDiscovery() {
    if (this._discoveryPromise) return; // a scan is already running
    if (this._cachedDevices && this._cachedDevices.length > 0
      && Date.now() - this._cacheTime < DISCOVERY_CACHE_MS) return;

    this._discoveryPromise = this.discoverBLELights()
      .then((devices) => {
        this._cachedDevices = devices;
        this._cacheTime = Date.now();
        return devices;
      })
      .catch((err) => {
        this.error('BLE discovery failed:', err.message);
        this._cachedDevices = [];
        return [];
      })
      .finally(() => {
        this._discoveryPromise = null;
      });
  }

  async onPair(session) {
    this._startDiscovery();

    session.setHandler('list_devices', async () => {
      if (!this._discoveryPromise) {
        return this._cachedDevices || [];
      }

      // The underlying scan reliably takes ~10s (see discoverBLELights()).
      // This timeout is a hang safety net, not the expected wait.
      this.log('Waiting for BLE discovery to complete...');
      let timer;
      const timeoutPromise = new Promise((resolve) => {
        timer = this.homey.setTimeout(() => {
          this.error('BLE discovery did not complete in time');
          resolve([]);
        }, DISCOVERY_SAFETY_TIMEOUT_MS);
      });
      try {
        return await Promise.race([this._discoveryPromise, timeoutPromise]);
      } finally {
        this.homey.clearTimeout(timer);
      }
    });
  }

  async discoverBLELights() {
    this.log('Starting BLE discovery for Govee lights...');

    // Note: Homey BLE discover timeout parameter is ignored (known SDK bug)
    // The scan always takes ~10 seconds
    const advertisements = await this.homey.ble.discover();

    this.log(`Found ${advertisements.length} BLE devices, filtering for Govee lights...`);

    const devices = [];
    const seenAddresses = new Set();

    for (const advertisement of advertisements) {
      const model = this.extractModel(advertisement.localName || '');
      if (!isKnownLightModel(model)) continue;

      const address = advertisement.address;
      if (seenAddresses.has(address)) continue;
      seenAddresses.add(address);

      this.log(`Found Govee BLE light: ${advertisement.localName} (${model}) - ${address}`);

      devices.push({
        name: `Govee ${model}`,
        data: {
          id: advertisement.uuid
        },
        store: {
          peripheralUuid: advertisement.uuid,
          localName: advertisement.localName,
          model,
          address
        }
      });
    }

    this.log(`Found ${devices.length} Govee BLE lights`);
    return devices;
  }

  /**
   * @param {string} localName
   * @returns {string|null}
   */
  extractModel(localName) {
    const match = MODEL_PATTERN.exec(localName);
    return match ? match[1].toUpperCase() : null;
  }

}

module.exports = GoveeBLELightDriver;
