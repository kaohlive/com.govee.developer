'use strict';

const { Device } = require('homey');

// Polling interval for BLE advertisements (30 seconds)
const POLL_INTERVAL_MS = 30000;

class GoveeBLESensorDevice extends Device {

  async onInit() {
    this.log('Govee BLE Sensor device initialized');

    this._address = this.getStoreValue('address');
    this._model = this.getStoreValue('model') || this.getData().model;
    this._uuid = this.getData().id;

    this.log(`Device: ${this._model} (${this._address})`);

    // Start polling for BLE advertisements
    this._startPolling();
  }

  /**
   * Start periodic BLE scanning to receive sensor data
   */
  _startPolling() {
    // Initial scan
    this._pollBleData();

    // Set up interval
    this._pollInterval = this.homey.setInterval(() => {
      this._pollBleData();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Scan for BLE advertisements and update sensor values
   */
  async _pollBleData() {
    try {
      const advertisements = await this.homey.ble.discover();

      for (const advertisement of advertisements) {
        if (advertisement.uuid === this._uuid || advertisement.address === this._address) {
          this._processAdvertisement(advertisement);
          return;
        }
      }

      this.log('Device not found in BLE scan');

    } catch (error) {
      this.error('BLE scan error:', error.message);
    }
  }

  /**
   * Process a BLE advertisement and extract sensor data
   * @param {BleAdvertisement} advertisement
   */
  _processAdvertisement(advertisement) {
    // Collect all available data sources
    const serviceData = advertisement.serviceData;
    const manufacturerData = advertisement.manufacturerData;

    if (!serviceData && !manufacturerData) {
      this.log('No service data or manufacturer data in advertisement');
      return;
    }

    // Build array of buffers to try parsing
    const buffers = [];
    if (serviceData) {
      for (const value of Object.values(serviceData)) {
        if (Buffer.isBuffer(value)) {
          buffers.push(value);
        }
      }
    }
    if (manufacturerData && Buffer.isBuffer(manufacturerData)) {
      buffers.push(manufacturerData);
    }

    // Try to parse based on model
    let parsed = null;
    for (const data of buffers) {
      parsed = this._parseByModel(data);
      if (parsed) break;
    }

    if (parsed) {
      this._updateCapabilities(parsed);
    } else {
      this.log(`Could not parse data for model ${this._model}`);
    }
  }

  /**
   * Parse data based on device model
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseByModel(data) {
    const model = this._model;
    const len = data.length;

    this.log(`Parsing ${len} bytes for model ${model}: ${data.toString('hex')}`);

    // Standard temp/humidity sensors (6-byte format)
    if (['H5072', 'H5075'].includes(model) && len >= 6) {
      return this._parseStandardFormat(data);
    }

    // 6-8 byte little-endian sensors
    if (['H5100', 'H5101', 'H5102', 'H5103', 'H5104', 'H5105', 'H5108', 'H5110', 'H5174', 'H5177'].includes(model) && len >= 6) {
      return this._parseStandardFormat(data);
    }

    // H5074 (7-byte little-endian)
    if (model === 'H5074' && len >= 7) {
      return this._parseH5074Format(data);
    }

    // H5051, H5052, H5071 (9-byte)
    if (['H5051', 'H5052', 'H5071'].includes(model) && len >= 9) {
      return this._parse9ByteFormat(data);
    }

    // H5178 dual-sensor (9-byte)
    if (['H5178', 'B5178'].includes(model) && len >= 9) {
      return this._parseH5178Format(data);
    }

    // H5179 (9-byte little-endian at offset 4)
    if (model === 'H5179' && len >= 9) {
      return this._parseH5179Format(data);
    }

    // H5106 (temp/humidity/PM2.5)
    if (model === 'H5106' && len >= 6) {
      return this._parseH5106Format(data);
    }

    // Multi-probe meat thermometers
    if (['H5181', 'H5183'].includes(model) && len >= 14) {
      return this._parseH5181Format(data);
    }
    if (['H5182', 'H5184'].includes(model) && len >= 17) {
      return this._parseH5182Format(data);
    }
    if (['H5185', 'H5191', 'H5198'].includes(model) && len >= 20) {
      return this._parseH5185Format(data);
    }
    if (model === 'H5055' && len >= 20) {
      return this._parseH5055Format(data);
    }

    // Try standard format as fallback for unknown models
    if (len >= 6) {
      return this._parseStandardFormat(data);
    }

    return null;
  }

  /**
   * Parse standard 6-byte Govee format (H5072, H5075, etc.)
   * Temperature and humidity encoded in 3 bytes as 24-bit value
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseStandardFormat(data) {
    try {
      // Find the right offset - try common positions
      for (const offset of [2, 1, 0]) {
        if (offset + 4 > data.length) continue;

        const tempHumidValue = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
        if (tempHumidValue === 0 || tempHumidValue === 0xFFFFFF) continue;

        const isNegative = !!(tempHumidValue & 0x800000);
        const magnitude = tempHumidValue & 0x7FFFFF;

        const temperature = (isNegative ? -1 : 1) * Math.floor(magnitude / 1000) / 10;
        const humidity = (magnitude % 1000) / 10;

        // Battery is typically in the next byte
        const batteryByte = data[offset + 3];
        const battery = Math.min(batteryByte & 0x7F, 100);
        const hasError = !!(batteryByte & 0x80);

        if (temperature < -40 || temperature > 100) continue;
        if (humidity < 0 || humidity > 100) continue;

        this.log(`Parsed standard: ${temperature}°C, ${humidity}%, battery ${battery}%`);
        return { temperature, humidity, battery, hasError };
      }
    } catch (err) {
      this.error('Error parsing standard format:', err.message);
    }
    return null;
  }

  /**
   * Parse H5074 format (7-byte little-endian)
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseH5074Format(data) {
    try {
      const temperature = data.readInt16LE(1) / 100;
      const humidity = data.readUInt16LE(3) / 100;
      const battery = Math.min(data[5] & 0x7F, 100);

      if (temperature < -40 || temperature > 100) return null;
      if (humidity < 0 || humidity > 100) return null;

      this.log(`Parsed H5074: ${temperature}°C, ${humidity}%, battery ${battery}%`);
      return { temperature, humidity, battery, hasError: false };
    } catch (err) {
      this.error('Error parsing H5074:', err.message);
      return null;
    }
  }

  /**
   * Parse 9-byte format (H5051, H5052, H5071)
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parse9ByteFormat(data) {
    try {
      const temperature = data.readInt16LE(1) / 100;
      const humidity = data.readUInt16LE(3) / 100;
      const battery = Math.min(data[5] & 0x7F, 100);

      if (temperature < -40 || temperature > 100) return null;
      if (humidity < 0 || humidity > 100) return null;

      this.log(`Parsed 9-byte: ${temperature}°C, ${humidity}%, battery ${battery}%`);
      return { temperature, humidity, battery, hasError: false };
    } catch (err) {
      this.error('Error parsing 9-byte format:', err.message);
      return null;
    }
  }

  /**
   * Parse H5178/B5178 dual-sensor format
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseH5178Format(data) {
    try {
      // Sensor ID in byte 2 upper nibble (0 = primary, 1 = remote)
      const sensorId = (data[2] >> 4) & 0x0F;

      // Only parse primary sensor (id 0)
      if (sensorId !== 0) {
        this.log(`Skipping remote sensor (id: ${sensorId})`);
        return null;
      }

      const temperature = data.readInt16LE(3) / 100;
      const humidity = data.readUInt16LE(5) / 100;
      const battery = Math.min(data[7] & 0x7F, 100);
      const hasError = !!(data[7] & 0x80);

      if (temperature < -40 || temperature > 100) return null;
      if (humidity < 0 || humidity > 100) return null;

      this.log(`Parsed H5178: ${temperature}°C, ${humidity}%, battery ${battery}%`);
      return { temperature, humidity, battery, hasError };
    } catch (err) {
      this.error('Error parsing H5178:', err.message);
      return null;
    }
  }

  /**
   * Parse H5179 format (11-byte, little-endian)
   * Based on actual device data: 0188ec0001019605f8113b
   * Byte 6-7: temperature (int16 LE / 100)
   * Byte 8-9: humidity (uint16 LE / 100)
   * Byte 10: battery percentage
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseH5179Format(data) {
    try {
      this.log(`H5179 raw (${data.length} bytes): ${data.toString('hex')}`);

      if (data.length < 11) {
        this.log('H5179: Data too short, need 11 bytes');
        return null;
      }

      // H5179 format (confirmed from actual device):
      // Byte 0-5: header/identifier
      // Byte 6-7: temperature (int16 LE, divide by 100)
      // Byte 8-9: humidity (uint16 LE, divide by 100)
      // Byte 10: battery percentage
      const temperature = data.readInt16LE(6) / 100;
      const humidity = data.readUInt16LE(8) / 100;
      const battery = Math.min(data[10], 100);

      if (temperature < -40 || temperature > 100) return null;
      if (humidity < 0 || humidity > 100) return null;

      this.log(`Parsed H5179: ${temperature}°C, ${humidity}%, battery ${battery}%`);
      return { temperature, humidity, battery, hasError: false };
    } catch (err) {
      this.error('Error parsing H5179:', err.message);
      return null;
    }
  }

  /**
   * Parse H5106 format (temp/humidity/PM2.5)
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseH5106Format(data) {
    try {
      // H5106 has a 4-byte combined value
      const combined = (data[2] << 24) | (data[3] << 16) | (data[4] << 8) | data[5];

      // Extract values (similar to standard but with PM2.5)
      const pm25Flag = !!(combined & 0x80000000);
      const magnitude = combined & 0x7FFFFFFF;

      const temperature = Math.floor(magnitude / 10000) / 10;
      const humidity = (Math.floor(magnitude / 10) % 1000) / 10;
      const pm25 = magnitude % 10; // Simplified - actual PM2.5 calculation may differ

      const battery = Math.min(data[1] & 0x7F, 100);

      if (temperature < -40 || temperature > 100) return null;
      if (humidity < 0 || humidity > 100) return null;

      this.log(`Parsed H5106: ${temperature}°C, ${humidity}%, battery ${battery}%`);
      return { temperature, humidity, battery, hasError: false };
    } catch (err) {
      this.error('Error parsing H5106:', err.message);
      return null;
    }
  }

  /**
   * Parse H5181/H5183 meat thermometer format (single probe)
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseH5181Format(data) {
    try {
      // Big-endian temperature at offset 8
      const temperature = data.readInt16BE(8) / 100;
      const battery = Math.min(data[2] & 0x7F, 100);

      if (temperature < -40 || temperature > 300) return null; // Meat thermometers go higher

      this.log(`Parsed H5181: ${temperature}°C, battery ${battery}%`);
      return { temperature, battery, hasError: false };
    } catch (err) {
      this.error('Error parsing H5181:', err.message);
      return null;
    }
  }

  /**
   * Parse H5182/H5184 meat thermometer format (dual probe)
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseH5182Format(data) {
    try {
      // Big-endian temperatures at offsets 8 and 12
      const temperature1 = data.readInt16BE(8) / 100;
      const temperature2 = data.readInt16BE(12) / 100;
      const battery = Math.min(data[2] & 0x7F, 100);

      // Return primary probe temperature
      const temperature = temperature1 !== 0x7FFF / 100 ? temperature1 : temperature2;

      if (temperature < -40 || temperature > 300) return null;

      this.log(`Parsed H5182: ${temperature}°C (probe1: ${temperature1}, probe2: ${temperature2}), battery ${battery}%`);
      return { temperature, battery, hasError: false };
    } catch (err) {
      this.error('Error parsing H5182:', err.message);
      return null;
    }
  }

  /**
   * Parse H5185/H5191/H5198 meat thermometer format (multi-probe)
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseH5185Format(data) {
    try {
      // Big-endian temperatures starting at offset 6
      const probes = [];
      for (let i = 0; i < 4 && (6 + i * 2 + 1) < data.length; i++) {
        const temp = data.readInt16BE(6 + i * 2) / 100;
        if (temp !== 0x7FFF / 100 && temp > -40 && temp < 300) {
          probes.push(temp);
        }
      }

      const battery = Math.min(data[2] & 0x7F, 100);
      const temperature = probes.length > 0 ? probes[0] : null;

      if (temperature === null) return null;

      this.log(`Parsed H5185: ${temperature}°C (${probes.length} probes), battery ${battery}%`);
      return { temperature, battery, hasError: false };
    } catch (err) {
      this.error('Error parsing H5185:', err.message);
      return null;
    }
  }

  /**
   * Parse H5055 meat thermometer format (6-probe, little-endian)
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseH5055Format(data) {
    try {
      // Little-endian temperatures starting at offset 4
      const probes = [];
      for (let i = 0; i < 6 && (4 + i * 2 + 1) < data.length; i++) {
        const temp = data.readInt16LE(4 + i * 2) / 100;
        if (temp !== 0x7FFF / 100 && temp > -40 && temp < 300) {
          probes.push(temp);
        }
      }

      const battery = Math.min(data[2] & 0x7F, 100);
      const temperature = probes.length > 0 ? probes[0] : null;

      if (temperature === null) return null;

      this.log(`Parsed H5055: ${temperature}°C (${probes.length} probes), battery ${battery}%`);
      return { temperature, battery, hasError: false };
    } catch (err) {
      this.error('Error parsing H5055:', err.message);
      return null;
    }
  }

  /**
   * Update Homey capabilities with parsed sensor data
   * @param {Object} data
   */
  async _updateCapabilities(data) {
    try {
      if (data.temperature !== undefined) {
        await this.setCapabilityValue('measure_temperature', data.temperature);
      }

      if (data.humidity !== undefined && this.hasCapability('measure_humidity')) {
        await this.setCapabilityValue('measure_humidity', data.humidity);
      }

      if (data.battery !== undefined) {
        await this.setCapabilityValue('measure_battery', data.battery);
      }
    } catch (error) {
      this.error('Error updating capabilities:', error.message);
    }
  }

  /**
   * Called when the device is deleted
   */
  async onDeleted() {
    this.log('Govee BLE Sensor device deleted');

    if (this._pollInterval) {
      this.homey.clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  async onSettings({ changedKeys }) {
    this.log('Settings changed:', changedKeys);
  }
}

module.exports = GoveeBLESensorDevice;
