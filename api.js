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

    client.triggerDiscovery();
    return { success: true };
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
  }
};
