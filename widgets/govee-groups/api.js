'use strict';

const GROUP_SKUS = ['BaseGroup', 'SameModeGroup'];

module.exports = {
  /**
   * Get list of Govee groups for autocomplete
   */
  async getGroups({ homey, query }) {
    const apiKey = homey.settings.get('api_key');
    if (!apiKey) {
      throw new Error('Cloud API key not configured');
    }

    if (!homey.app.cloudApi) {
      homey.app.initCloudApi();
    }

    try {
      const response = await homey.app.cloudApi.deviceList();
      return response.data
        .filter(device => GROUP_SKUS.includes(device.sku))
        .map(device => ({
          name: device.deviceName,
          id: device.device,
          sku: device.sku
        }));
    } catch (error) {
      throw new Error('Failed to fetch Govee groups');
    }
  },

  /**
   * Toggle a group on/off
   */
  async toggleGroup({ homey, body }) {
    const { groupId, sku, state } = body;

    if (!groupId) {
      throw new Error('Group ID is required');
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
      await homey.app.cloudApi.devicesTurn(mode, sku, groupId);
      return { success: true, id: groupId, isOn: state };
    } catch (error) {
      throw new Error(`Failed to toggle group: ${error.message}`);
    }
  }
};
