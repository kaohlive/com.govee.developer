//Based on the govee-lan-control npm package

const localapi = require("govee-lan-control");

// Discovery interval reduced from 60s to 30s for better device detection
const DISCOVERY_INTERVAL_MS = 30000;
// Timeout for initial socket creation to prevent infinite blocking
const INIT_TIMEOUT_MS = 15000;

class GoveeLocalClient {
  constructor() {
    this.localDevices = [];
    this.isReady = false;
    this.initError = null;
    this.GoveeClient = null;

    this._initializeClient();
  }

  _initializeClient() {
    try {
      // Create client with reduced discovery interval (30s instead of 60s)
      this.GoveeClient = new localapi.default({
        discoverInterval: DISCOVERY_INTERVAL_MS
      });

      // Set up timeout to prevent infinite blocking if UDP port is unavailable
      this._initTimeout = setTimeout(() => {
        if (!this.isReady) {
          this.initError = new Error('Local API initialization timed out - UDP port 4002 may be in use by another application');
          console.error('[GoveeLocalClient] ' + this.initError.message);
          console.error('[GoveeLocalClient] Local device discovery will be unavailable. Check if another instance is running.');
        }
      }, INIT_TIMEOUT_MS);

      this.GoveeClient.on("ready", () => {
        this.isReady = true;
        if (this._initTimeout) {
          clearTimeout(this._initTimeout);
          this._initTimeout = null;
        }
        console.log("[GoveeLocalClient] Local Govee Server/client is ready!");
      });

      this.GoveeClient.on("deviceAdded", (device) => {
        const isInCollection = this.localDevices.some(element => element.deviceID === device.deviceID);
        if (isInCollection) {
          console.log('[GoveeLocalClient] Ignore located device, it was already found [', device.model, ']');
        } else {
          this.localDevices.push(device);
          console.log('[GoveeLocalClient] New Device! [', device.model, ']. Total devices: ' + this.localDevices.length);
        }
      });

      this.GoveeClient.on("deviceRemoved", (device) => {
        console.log('[GoveeLocalClient] Device removed: [', device.model, ']');
        this.localDevices = this.localDevices.filter(d => d.deviceID !== device.deviceID);
      });

    } catch (err) {
      this.initError = err;
      console.error('[GoveeLocalClient] Failed to initialize local API client:', err.message);
    }
  }

  /**
   * Check if the client is ready for use
   * @returns {boolean}
   */
  isClientReady() {
    return this.isReady && this.GoveeClient !== null && this.initError === null;
  }

  /**
   * Get initialization error if any
   * @returns {Error|null}
   */
  getInitError() {
    return this.initError;
  }

  deviceList() {
    if (!this.isClientReady()) {
      console.warn('[GoveeLocalClient] Client not ready, returning empty device list');
      return [];
    }
    console.log('[GoveeLocalClient] Returning: ' + this.localDevices.length + ' devices');
    return this.localDevices;
  }

  getDeviceById(deviceId) {
    if (!this.isClientReady()) {
      console.warn('[GoveeLocalClient] Client not ready, cannot get device by ID');
      return null;
    }
    var filteredDevices = this.localDevices.filter(device => {
      return device.deviceID === deviceId;
    });
    if (filteredDevices.length == 0)
      return null;
    else
      return filteredDevices[0];
  }

  devicesTurn(mode, deviceid) {
    return new Promise((resolve, reject) => {
      if (!this.isClientReady()) {
        reject(new Error("Local API client not ready - " + (this.initError?.message || "initialization pending")));
        return;
      }
      var device = this.getDeviceById(deviceid);
      if (device == null) {
        reject(new Error("Could not locate device with id [" + deviceid + "]"));
      } else {
        console.log('[GoveeLocalClient] Attempt to switch device [' + device.deviceID + ':' + device.model + '] to new mode: ' + mode);
        if (mode)
          resolve(device.actions.setOn());
        else
          resolve(device.actions.setOff());
      }
    });
  }

  brightness(dim, deviceid) {
    return new Promise((resolve, reject) => {
      if (!this.isClientReady()) {
        reject(new Error("Local API client not ready - " + (this.initError?.message || "initialization pending")));
        return;
      }
      var device = this.getDeviceById(deviceid);
      if (dim < 0 || dim > 100) {
        reject(new Error("Incorrect dim level"));
      } else if (device == null) {
        reject(new Error("Could not locate device with id [" + deviceid + "]"));
      } else {
        console.log('[GoveeLocalClient] Attempt dim device [' + device.deviceID + ':' + device.model + '] to new level: ' + dim);
        resolve(device.actions.setBrightness(dim));
      }
    });
  }

  //Color object needs to be { 'r': 255, 'g': 255, 'b': 244 }
  color(color, deviceid) {
    return new Promise((resolve, reject) => {
      if (!this.isClientReady()) {
        reject(new Error("Local API client not ready - " + (this.initError?.message || "initialization pending")));
        return;
      }
      var device = this.getDeviceById(deviceid);
      if (device == null) {
        reject(new Error("Could not locate device with id [" + deviceid + "]"));
      } else {
        console.log('[GoveeLocalClient] Attempt set color of device [' + device.deviceID + ':' + device.model + '] to new color: ' + JSON.stringify(color));
        resolve(device.actions.setColor(color));
      }
    });
  }

  /**
   * Trigger a manual discovery scan
   */
  triggerDiscovery() {
    if (this.GoveeClient && typeof this.GoveeClient.discover === 'function') {
      console.log('[GoveeLocalClient] Triggering manual discovery scan');
      this.GoveeClient.discover();
    }
  }

  /**
   * Destroy the client and clean up resources
   */
  destroy() {
    if (this._initTimeout) {
      clearTimeout(this._initTimeout);
      this._initTimeout = null;
    }
    if (this.GoveeClient) {
      try {
        this.GoveeClient.destroy();
      } catch (err) {
        console.error('[GoveeLocalClient] Error destroying client:', err.message);
      }
    }
    this.localDevices = [];
    this.isReady = false;
    console.log('[GoveeLocalClient] Client destroyed');
  }
}

exports.GoveeClient = GoveeLocalClient;