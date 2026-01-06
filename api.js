'use strict';

const GoveeCloudClient = require('./api/govee-api-v2');

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
