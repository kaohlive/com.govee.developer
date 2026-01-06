'use strict';

const { Driver } = require('homey');

// Govee BLE sensor model patterns (matching Home Assistant govee-ble)
// These sensors broadcast temperature/humidity via BLE advertisements
const GOVEE_SENSOR_MODELS = [
  // Standard temperature/humidity sensors (6-byte format)
  'H5072', 'H5075',
  // 6-8 byte little-endian sensors
  'H5100', 'H5101', 'H5102', 'H5103', 'H5104', 'H5105', 'H5108', 'H5110',
  'H5174', 'H5177',
  // 7-byte little-endian
  'H5074',
  // 9-byte format sensors
  'H5051', 'H5052', 'H5071',
  // Dual-sensor models
  'H5178', 'B5178',
  // H5179 (9-byte at offset 4)
  'H5179',
  // PM2.5 + temp/humidity
  'H5106',
  // Meat thermometers (multi-probe)
  'H5055', 'H5181', 'H5182', 'H5183', 'H5184', 'H5185', 'H5191', 'H5198'
];

// Local name prefixes that indicate Govee sensors
const GOVEE_NAME_PREFIXES = ['GVH', 'Govee_H5', 'Govee_B', 'ihoment'];

// Model number regex patterns to extract from local name
const MODEL_PATTERNS = [
  /H5\d{3}/i,   // H5xxx
  /B5\d{3}/i,   // B5xxx
  /GVH(5\d{3})/i // GVH5xxx -> H5xxx
];

class GoveeBLESensorDriver extends Driver {

  async onInit() {
    this.log('Govee BLE Sensor driver initialized');
    // Start background discovery on driver init so devices are ready when pairing starts
    this._startBackgroundDiscovery();
  }

  /**
   * Start background BLE discovery to have devices ready for pairing
   */
  _startBackgroundDiscovery() {
    this.log('Starting background BLE discovery...');
    this._discoveryPromise = this.discoverBLESensors();
  }

  /**
   * onPair is called when pairing starts - use session handler pattern
   */
  async onPair(session) {
    // If no discovery in progress or cache is old (>60s), start new discovery
    if (!this._discoveryPromise || (this._cacheTime && Date.now() - this._cacheTime > 60000)) {
      this._cachedDevices = null;
      this._startBackgroundDiscovery();
    }

    session.setHandler('list_devices', async (data) => {
      this.log('Returning discovered Govee BLE sensors...');

      // If discovery already completed, use cached results
      if (this._cachedDevices && this._cachedDevices.length > 0) {
        this.log(`Returning ${this._cachedDevices.length} cached devices`);
        return this._cachedDevices;
      }

      // Wait for discovery with a timeout that won't block the pairing wizard
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        );

        this._cachedDevices = await Promise.race([
          this._discoveryPromise,
          timeoutPromise
        ]);

        this._cacheTime = Date.now();
        return this._cachedDevices;
      } catch (err) {
        this.log('Discovery timeout, waiting for background scan to complete...');
        // Don't return empty - wait a bit more for the background scan
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (this._cachedDevices && this._cachedDevices.length > 0) {
          this.log(`Background scan completed, returning ${this._cachedDevices.length} devices`);
          return this._cachedDevices;
        }

        this.log('No devices found yet, returning empty list');
        return [];
      }
    });
  }

  /**
   * Discover BLE sensors and return device list
   */
  async discoverBLESensors() {
    this.log('Starting BLE discovery for Govee sensors...');

    // Note: Homey BLE discover timeout parameter is ignored (known SDK bug)
    // The scan always takes ~10 seconds
    const advertisements = await this.homey.ble.discover();

    this.log(`Found ${advertisements.length} BLE devices, filtering for Govee sensors...`);

    const devices = [];
    const seenAddresses = new Set();

    for (const advertisement of advertisements) {
      if (this.isGoveeSensor(advertisement)) {
        const localName = advertisement.localName || 'Unknown Sensor';
        const model = this.extractModel(localName);
        const uuid = advertisement.uuid;
        const address = advertisement.address;

        // Skip duplicates
        if (seenAddresses.has(address)) {
          continue;
        }
        seenAddresses.add(address);

        this.log(`Found Govee sensor: ${localName} (${model}) - ${address}`);

        devices.push({
          name: `Govee ${model}`,
          data: {
            id: uuid
          },
          store: {
            peripheralUuid: uuid,
            localName: localName,
            model: model,
            address: address
          }
        });
      }
    }

    this.log(`Found ${devices.length} Govee BLE sensors`);
    this._cachedDevices = devices;
    return devices;
  }

  /**
   * Check if an advertisement is from a Govee temperature/humidity sensor
   * @param {BleAdvertisement} advertisement
   * @returns {boolean}
   */
  isGoveeSensor(advertisement) {
    const localName = advertisement.localName || '';

    // Extract model and check if it's a supported model
    const model = this.extractModel(localName);
    if (model !== 'Unknown' && GOVEE_SENSOR_MODELS.includes(model)) {
      return true;
    }

    // Check name prefixes as fallback
    for (const prefix of GOVEE_NAME_PREFIXES) {
      if (localName.startsWith(prefix)) {
        // Additional check: name should contain H50, H51, H517, or H518 for sensors
        if (/H50|H51|H517|H518/.test(localName)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract model number from advertisement local name
   * @param {string} localName
   * @returns {string}
   */
  extractModel(localName) {
    // Try each pattern
    for (const pattern of MODEL_PATTERNS) {
      const match = localName.match(pattern);
      if (match) {
        // Handle GVH5xxx -> H5xxx conversion
        if (match[1]) {
          return `H${match[1]}`.toUpperCase();
        }
        return match[0].toUpperCase();
      }
    }

    return 'Unknown';
  }

}

module.exports = GoveeBLESensorDriver;
