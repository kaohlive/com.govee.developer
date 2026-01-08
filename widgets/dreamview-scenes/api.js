'use strict';

module.exports = {
  /**
   * Get list of DreamViewScenic scenes for autocomplete
   */
  async getScenes({ homey, query }) {
    const apiKey = homey.settings.get('api_key');
    if (!apiKey) {
      throw new Error('Cloud API key not configured');
    }

    if (!homey.app.cloudApi) {
      homey.app.initCloudApi();
    }

    try {
      const response = await homey.app.cloudApi.deviceList();
      const dreamviewScenes = response.data.filter(device => device.sku === 'DreamViewScenic');

      return dreamviewScenes.map(device => ({
        name: device.deviceName,
        id: device.device,
        sku: device.sku
      }));
    } catch (error) {
      throw new Error('Failed to fetch Dreamview scenes');
    }
  },

  /**
   * Get status of a specific Dreamview scene
   */
  async getSceneStatus({ homey, query }) {
    const { sceneId } = query;

    if (!sceneId) {
      throw new Error('Scene ID is required');
    }

    const apiKey = homey.settings.get('api_key');
    if (!apiKey) {
      throw new Error('Cloud API key not configured');
    }

    if (!homey.app.cloudApi) {
      homey.app.initCloudApi();
    }

    try {
      // Get device state from cloud API
      const response = await homey.app.cloudApi.deviceState('DreamViewScenic', sceneId);

      // Find the powerSwitch capability state
      let isOn = false;
      if (response.payload && response.payload.capabilities) {
        const powerSwitch = response.payload.capabilities.find(cap => cap.instance === 'powerSwitch');
        if (powerSwitch) {
          isOn = powerSwitch.state.value === 1;
        }
      }

      return {
        id: sceneId,
        isOn: isOn
      };
    } catch (error) {
      // If we can't get status, return unknown state
      return {
        id: sceneId,
        isOn: false,
        error: error.message
      };
    }
  },

  /**
   * Toggle a Dreamview scene on/off
   */
  async toggleScene({ homey, body }) {
    const { sceneId, state } = body;

    if (!sceneId) {
      throw new Error('Scene ID is required');
    }

    const apiKey = homey.settings.get('api_key');
    if (!apiKey) {
      throw new Error('Cloud API key not configured');
    }

    if (!homey.app.cloudApi) {
      homey.app.initCloudApi();
    }

    const mode = state ? 1 : 0;

    try {
      await homey.app.cloudApi.devicesTurn(mode, 'DreamViewScenic', sceneId);
      return {
        success: true,
        id: sceneId,
        isOn: state
      };
    } catch (error) {
      throw new Error(`Failed to toggle scene: ${error.message}`);
    }
  }
};
