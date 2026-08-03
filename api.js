'use strict';

const GoveeCloudClient = require('./api/govee-api-v2');
const { parseByModel } = require('./lib/ble-parser');

// Extract the Govee model code (e.g. "H5075") from a BLE local name like
// "Govee_H5075_54F6". Returns null when the name doesn't match.
function extractGoveeModel(localName) {
  if (!localName) return null;
  const match = /^Govee_(H\d{4}[A-Z]?)/i.exec(localName);
  return match ? match[1].toUpperCase() : null;
}

module.exports = {
  /**
   * Get the local API client status
   * Called from settings page to display UDP client status
   */
  async getLocalApiStatus({ homey }) {
    const client = homey.app.localApiClient;

    if (!client) {
      return {
        initialized: false,
        ready: false,
        error: 'Local API client not initialized',
        devices: [],
        deviceCount: 0
      };
    }

    const initError = client.getInitError();
    const isReady = client.isClientReady();
    const devices = client.localDevices || [];

    // Map devices to a safe format for the settings page
    const deviceList = devices.map(device => ({
      id: device.deviceID,
      model: device.model,
      ip: device.ip,
      isOn: device.state?.isOn === 1,
      brightness: device.state?.brightness || 0,
      hasReceivedUpdates: device.state?.hasReceivedUpdates || false
    }));

    return {
      initialized: true,
      ready: isReady,
      error: initError ? initError.message : null,
      devices: deviceList,
      deviceCount: deviceList.length,
      udpPort: 4002,
      multicastAddress: '239.255.255.250',
      discoveryInterval: 30000
    };
  },

  /**
   * Trigger a manual discovery scan
   */
  async triggerDiscovery({ homey }) {
    const client = homey.app.localApiClient;

    if (!client) {
      return { success: false, error: 'Local API client not initialized' };
    }

    if (!client.isClientReady()) {
      return { success: false, error: 'Local API client not ready - ' + (client.getInitError()?.message || 'still initializing') };
    }

    client.triggerDiscovery();

    // Wait a moment and return updated device count
    await new Promise(resolve => setTimeout(resolve, 3000));

    return {
      success: true,
      deviceCount: client.localDevices.length,
      message: `Discovery triggered. Found ${client.localDevices.length} device(s).`
    };
  },

  /**
   * Reinitialize the local API client
   * Useful when the UDP socket needs to be recreated after an error
   */
  async reinitializeLocalApi({ homey }) {
    const client = homey.app.localApiClient;

    if (!client) {
      // Try to create a new client
      const gv = require('./api/govee-localapi');
      try {
        homey.app.localApiClient = new gv.GoveeClient();

        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 5000));

        const newClient = homey.app.localApiClient;
        if (newClient.isClientReady()) {
          return { success: true, message: 'Local API client initialized successfully' };
        } else {
          return {
            success: false,
            error: newClient.getInitError()?.message || 'Initialization timeout'
          };
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    // Reinitialize existing client
    const success = await client.reinitialize();

    if (success) {
      // Trigger discovery after successful reinit
      client.triggerDiscovery();
      await new Promise(resolve => setTimeout(resolve, 3000));

      return {
        success: true,
        message: `Reinitialized successfully. Found ${client.localDevices.length} device(s).`,
        deviceCount: client.localDevices.length
      };
    } else {
      return {
        success: false,
        error: client.getInitError()?.message || 'Reinitialization failed'
      };
    }
  },

  /**
   * Get detailed diagnostics for the local API client
   */
  async getLocalApiDiagnostics({ homey }) {
    const client = homey.app.localApiClient;

    if (!client) {
      return {
        initialized: false,
        diagnostics: null
      };
    }

    return {
      initialized: true,
      diagnostics: client.getDiagnostics()
    };
  },

  /**
   * Test Cloud API connection and retrieve device list
   * Returns full API response for debugging/support purposes
   */
  async testCloudApi({ homey }) {
    const apiKey = homey.settings.get('api_key');

    if (!apiKey) {
      return {
        success: false,
        error: 'No API key configured. Please enter your Govee API key in the Cloud API tab.',
        rawResponse: null,
        devices: [],
        deviceCount: 0,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const client = new GoveeCloudClient.GoveeClient({ api_key: apiKey });
      const response = await client.deviceList();

      // Extract device list from response
      const devices = response.data || [];

      // Map devices to a simplified format for display
      const deviceList = devices.map(device => ({
        id: device.device,
        model: device.sku,
        name: device.deviceName || device.device,
        type: device.type || 'Unknown'
      }));

      return {
        success: true,
        error: null,
        rawResponse: JSON.stringify(response, null, 2),
        devices: deviceList,
        deviceCount: deviceList.length,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Unknown error occurred',
        rawResponse: JSON.stringify({ error: err.message, stack: err.stack }, null, 2),
        devices: [],
        deviceCount: 0,
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Test Cloud API ping endpoint
   */
  async pingCloudApi({ homey }) {
    const apiKey = homey.settings.get('api_key');

    if (!apiKey) {
      return {
        success: false,
        error: 'No API key configured',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const client = new GoveeCloudClient.GoveeClient({ api_key: apiKey });
      const response = await client.ping();

      return {
        success: true,
        error: null,
        rawResponse: JSON.stringify(response, null, 2),
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Unknown error occurred',
        rawResponse: JSON.stringify({ error: err.message }, null, 2),
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Poll the raw cloud state for a single device.
   * Useful for support diagnostics: reporters can hit one button per device
   * in the settings page and share the exact response Govee returned,
   * instead of hoping the right poll ends up in a log window.
   */
  async testDeviceState({ homey, query }) {
    const apiKey = homey.settings.get('api_key');

    if (!apiKey) {
      return {
        success: false,
        error: 'No API key configured. Add your Govee API key in the Cloud API tab first.',
        rawResponse: null,
        timestamp: new Date().toISOString()
      };
    }

    const sku = query && query.sku;
    const device = query && query.device;

    if (!sku || !device) {
      return {
        success: false,
        error: 'sku and device query parameters are required',
        rawResponse: null,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const client = new GoveeCloudClient.GoveeClient({ api_key: apiKey });
      const payload = await client.state(sku, device);

      return {
        success: true,
        error: null,
        sku,
        device,
        payload,
        rawResponse: JSON.stringify(payload, null, 2),
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Unknown error occurred',
        sku,
        device,
        rawResponse: JSON.stringify({ error: err.message, stack: err.stack }, null, 2),
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Scan for Govee BLE sensors in range and dump their raw advertisement
   * bytes + the current parser output. Used from the settings page so
   * reporters can share exact hex bytes with support in one click,
   * instead of trying to time an app log capture around a 30-second poll
   * interval. Handles all sensor models supported by lib/ble-parser.js.
   */
  async scanBleSensors({ homey }) {
    try {
      const advertisements = await homey.ble.discover();

      const govee = (advertisements || []).filter(adv => {
        const name = adv.localName || '';
        return name.indexOf('Govee_') === 0;
      });

      const sensors = govee.map(adv => {
        const model = extractGoveeModel(adv.localName);

        // Collect every candidate buffer the driver would try to parse:
        // one entry per serviceData UUID plus the manufacturerData blob.
        const buffers = [];
        if (adv.serviceData) {
          for (const [uuid, value] of Object.entries(adv.serviceData)) {
            if (Buffer.isBuffer(value)) {
              buffers.push({
                source: 'serviceData:' + uuid,
                hex: value.toString('hex'),
                length: value.length,
              });
            }
          }
        }
        if (adv.manufacturerData && Buffer.isBuffer(adv.manufacturerData)) {
          buffers.push({
            source: 'manufacturerData',
            hex: adv.manufacturerData.toString('hex'),
            length: adv.manufacturerData.length,
          });
        }

        // Try each buffer through parseByModel; keep the first that yields a result.
        let parsed = null;
        let parsedFrom = null;
        let parseError = null;
        if (model) {
          for (const b of buffers) {
            try {
              const r = parseByModel(model, Buffer.from(b.hex, 'hex'));
              if (r) {
                parsed = r;
                parsedFrom = b.source;
                break;
              }
            } catch (err) {
              parseError = err.message;
            }
          }
        }

        return {
          address: adv.address || null,
          localName: adv.localName || null,
          model,
          rssi: typeof adv.rssi === 'number' ? adv.rssi : null,
          buffers,
          parsed,
          parsedFrom,
          parseError,
        };
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
        totalAdvertisements: advertisements ? advertisements.length : 0,
        count: sensors.length,
        sensors,
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'BLE scan failed',
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Check if a device IP would be reachable from Homey's network interfaces
   * Useful for debugging why local discovery might not find certain devices
   */
  async checkDeviceReachability({ homey, query }) {
    const client = homey.app.localApiClient;

    if (!client) {
      return {
        success: false,
        error: 'Local API client not initialized'
      };
    }

    const deviceIp = query?.ip;
    if (!deviceIp) {
      // Return general network info
      const diagnostics = client.getDiagnostics();
      return {
        success: true,
        network: diagnostics.network
      };
    }

    return {
      success: true,
      reachability: client.checkDeviceReachability(deviceIp)
    };
  }
};
