//Based on the govee-lan-control npm package

const localapi = require("govee-lan-control");
const os = require("os");

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
    this._destroyed = false;

    this._initializeClient();
  }

  _initializeClient() {
    try {
      // Log network interfaces for debugging
      const interfaces = this._getNetworkInterfaces();
      console.log('[GoveeLocalClient] Initializing with network interfaces:');
      interfaces.forEach(iface => {
        console.log(`  - ${iface.name}: ${iface.address} (netmask: ${iface.netmask})`);
      });

      if (interfaces.length === 0) {
        console.warn('[GoveeLocalClient] WARNING: No suitable network interfaces found for UDP discovery!');
      }

      // Create client with reduced discovery interval (30s instead of 60s)
      this.GoveeClient = new localapi.default({
        discoverInterval: DISCOVERY_INTERVAL_MS
      });

      // Set up timeout to prevent infinite blocking if UDP port is unavailable
      this._initTimeout = setTimeout(() => {
        if (!this.isReady && !this._destroyed) {
          this.initError = new Error('Local API initialization timed out - UDP port 4002 may be in use by another application');
          console.error('[GoveeLocalClient] ' + this.initError.message);
          console.error('[GoveeLocalClient] Local device discovery will be unavailable. Check if another instance is running.');
          console.error('[GoveeLocalClient] Network interfaces were:', JSON.stringify(interfaces));
        }
      }, INIT_TIMEOUT_MS);

      this.GoveeClient.on("ready", () => {
        if (this._destroyed) return;
        this.isReady = true;
        if (this._initTimeout) {
          clearTimeout(this._initTimeout);
          this._initTimeout = null;
        }
        console.log("[GoveeLocalClient] Local Govee Server/client is ready!");
        console.log("[GoveeLocalClient] Listening on UDP port 4002, multicast group 239.255.255.250");
      });

      this.GoveeClient.on("deviceAdded", (device) => {
        if (this._destroyed) return;
        const isInCollection = this.localDevices.some(element => element.deviceID === device.deviceID);
        if (isInCollection) {
          console.log('[GoveeLocalClient] Ignore located device, it was already found [', device.model, ']');
        } else {
          this.localDevices.push(device);
          console.log('[GoveeLocalClient] New Device! [', device.model, ']. Total devices: ' + this.localDevices.length);
        }
      });

      this.GoveeClient.on("deviceRemoved", (device) => {
        if (this._destroyed) return;
        console.log('[GoveeLocalClient] Device removed: [', device.model, ']');
        this.localDevices = this.localDevices.filter(d => d.deviceID !== device.deviceID);
      });

      // Handle errors from the underlying library (including EADDRINUSE)
      this.GoveeClient.on("error", (err) => {
        if (this._destroyed) return;
        this._handleError(err);
      });

    } catch (err) {
      this._handleError(err);
    }
  }

  /**
   * Handle initialization/runtime errors
   * @param {Error} err
   */
  _handleError(err) {
    // Don't overwrite existing error
    if (this.initError) return;

    this.initError = err;
    this.isReady = false;

    if (this._initTimeout) {
      clearTimeout(this._initTimeout);
      this._initTimeout = null;
    }

    // Provide user-friendly error messages
    if (err.code === 'EADDRINUSE') {
      console.error('[GoveeLocalClient] UDP port 4002 is already in use by another application.');
      console.error('[GoveeLocalClient] This usually happens when another Govee app, Home Assistant, or similar is running.');
      console.error('[GoveeLocalClient] Local device discovery will be unavailable.');
    } else {
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
      const interfaces = this._getNetworkInterfaces();
      console.log('[GoveeLocalClient] Triggering manual discovery scan');
      console.log('[GoveeLocalClient] Sending scan packet to 239.255.255.250:4001');
      console.log('[GoveeLocalClient] Active interfaces: ' + interfaces.map(i => i.address).join(', '));
      console.log('[GoveeLocalClient] Current device count before scan: ' + this.localDevices.length);
      this.GoveeClient.discover();
    } else {
      console.warn('[GoveeLocalClient] Cannot trigger discovery - client not available');
    }
  }

  /**
   * Reinitialize the client (destroy and recreate)
   * Useful when the UDP socket needs to be recreated after an error
   * @returns {Promise<boolean>} True if reinitialization succeeded
   */
  async reinitialize() {
    console.log('[GoveeLocalClient] Reinitializing client...');

    // Destroy existing client
    this.destroy();

    // Wait a moment for the socket to fully release
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Reset state
    this._destroyed = false;
    this.initError = null;
    this.isReady = false;
    this.localDevices = [];

    // Reinitialize
    this._initializeClient();

    // Wait for ready state or timeout
    const MAX_WAIT = 10000;
    const CHECK_INTERVAL = 500;
    let waited = 0;

    while (!this.isReady && !this.initError && waited < MAX_WAIT) {
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
      waited += CHECK_INTERVAL;
    }

    if (this.isReady) {
      console.log('[GoveeLocalClient] Reinitialization successful');
      return true;
    } else {
      console.error('[GoveeLocalClient] Reinitialization failed:', this.initError?.message || 'timeout');
      return false;
    }
  }

  /**
   * Get diagnostic information about the client state
   * @returns {Object}
   */
  getDiagnostics() {
    // Get network interface information for debugging
    const networkInterfaces = this._getNetworkInterfaces();

    return {
      isReady: this.isReady,
      isDestroyed: this._destroyed,
      hasError: this.initError !== null,
      errorMessage: this.initError?.message || null,
      errorCode: this.initError?.code || null,
      deviceCount: this.localDevices.length,
      devices: this.localDevices.map(d => ({
        id: d.deviceID,
        model: d.model,
        ip: d.ip,
        hasReceivedUpdates: d.state?.hasReceivedUpdates || false
      })),
      // Network diagnostics to help debug discovery issues
      network: {
        interfaces: networkInterfaces,
        multicastAddress: '239.255.255.250',
        scanPort: 4001,
        listenPort: 4002,
        devicePort: 4003
      }
    };
  }

  /**
   * Get network interfaces that would be used for discovery
   * The govee-lan-control library creates sockets for each non-internal IPv4 interface
   * @returns {Array}
   */
  _getNetworkInterfaces() {
    const nets = os.networkInterfaces();
    const interfaces = [];

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Match the same logic as govee-lan-control library
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
        if (net.family === familyV4Value && !net.internal) {
          interfaces.push({
            name: name,
            address: net.address,
            netmask: net.netmask,
            mac: net.mac,
            subnet: this._getSubnet(net.address, net.netmask)
          });
        }
      }
    }

    return interfaces;
  }

  /**
   * Calculate subnet from IP and netmask
   * @param {string} ip
   * @param {string} netmask
   * @returns {string}
   */
  _getSubnet(ip, netmask) {
    try {
      const ipParts = ip.split('.').map(Number);
      const maskParts = netmask.split('.').map(Number);
      const subnetParts = ipParts.map((part, i) => part & maskParts[i]);
      return subnetParts.join('.');
    } catch (err) {
      return 'unknown';
    }
  }

  /**
   * Check if a device IP is reachable from any interface
   * Useful for diagnosing why devices might not be found
   * @param {string} deviceIp
   * @returns {Object}
   */
  checkDeviceReachability(deviceIp) {
    const interfaces = this._getNetworkInterfaces();
    const deviceSubnet = this._getSubnet(deviceIp, '255.255.255.0'); // Assume /24

    const results = interfaces.map(iface => {
      const sameSubnet = iface.subnet === deviceSubnet;
      return {
        interface: iface.name,
        address: iface.address,
        subnet: iface.subnet,
        deviceSubnet: deviceSubnet,
        sameSubnet: sameSubnet
      };
    });

    return {
      deviceIp: deviceIp,
      interfaces: results,
      reachable: results.some(r => r.sameSubnet)
    };
  }

  /**
   * Destroy the client and clean up resources
   */
  destroy() {
    this._destroyed = true;

    if (this._initTimeout) {
      clearTimeout(this._initTimeout);
      this._initTimeout = null;
    }
    if (this.GoveeClient) {
      try {
        // Remove all listeners to prevent callbacks after destroy
        this.GoveeClient.removeAllListeners();
        this.GoveeClient.destroy();
      } catch (err) {
        console.error('[GoveeLocalClient] Error destroying client:', err.message);
      }
      this.GoveeClient = null;
    }
    this.localDevices = [];
    this.isReady = false;
    console.log('[GoveeLocalClient] Client destroyed');
  }
}

exports.GoveeClient = GoveeLocalClient;