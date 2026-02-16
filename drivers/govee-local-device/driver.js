const GoveeDriver = require('../../api/govee-localdriver');

class goveeDeviceDriver extends GoveeDriver {

  async onPair(session) {
    // Handle discovery mode selection from the custom view
    session.setHandler('set_discovery_mode', async (data) => {
      this.log('Discovery mode selected: ' + data.mode);
      // For auto mode, trigger a multicast discovery so devices are found before list_devices loads
      if (data.mode === 'auto' && this.homey.app.localApiClient) {
        this.homey.app.localApiClient.triggerDiscovery();
      }
      return true;
    });

    // Handle manual IP scan from the custom view
    session.setHandler('scan_ip', async (data) => {
      const ip = data.ip;
      this.log('Manual IP scan requested for: ' + ip);

      if (!this.homey.app.localApiClient) {
        return { success: false, message: 'Local API client is not initialized' };
      }

      const initError = this.homey.app.localApiClient.getInitError();
      if (initError) {
        return { success: false, message: 'Local API error: ' + initError.message };
      }

      // Wait for client to be ready
      if (!this.homey.app.localApiClient.isClientReady()) {
        const MAX_WAIT = 10000;
        const CHECK = 500;
        let waited = 0;
        while (!this.homey.app.localApiClient.isClientReady() && waited < MAX_WAIT) {
          await new Promise(resolve => setTimeout(resolve, CHECK));
          waited += CHECK;
        }
        if (!this.homey.app.localApiClient.isClientReady()) {
          return { success: false, message: 'Local API client not ready' };
        }
      }

      // Record devices before scan
      const beforeIds = new Set(this.homey.app.localApiClient.localDevices.map(d => d.deviceID));

      // Send targeted scan to the IP
      this.homey.app.localApiClient.scanByIP(ip);

      // Wait for a response (device should appear in localDevices)
      const SCAN_TIMEOUT = 5000;
      const SCAN_CHECK = 500;
      let scanWaited = 0;
      let foundDevice = null;

      while (scanWaited < SCAN_TIMEOUT) {
        await new Promise(resolve => setTimeout(resolve, SCAN_CHECK));
        scanWaited += SCAN_CHECK;

        // Check if a new device appeared, or if an existing device matches this IP
        foundDevice = this.homey.app.localApiClient.localDevices.find(d => d.ip === ip);
        if (foundDevice) break;
      }

      if (foundDevice) {
        this.log('Device found at ' + ip + ': ' + foundDevice.model + ' (' + foundDevice.deviceID + ')');
        return {
          success: true,
          model: foundDevice.model,
          deviceId: foundDevice.deviceID,
          ip: ip
        };
      } else {
        this.log('No device responded at ' + ip + ' after ' + SCAN_TIMEOUT + 'ms');
        return {
          success: false,
          message: 'No Govee device responded at ' + ip + '. Make sure the device has LAN control enabled in the Govee app.'
        };
      }
    });

    // Handle list_devices view
    session.setHandler('list_devices', async () => {
      this.log('List available local api enabled govee devices');
      var devicelist = await this.ListDevices();
      this.log(devicelist);
      return devicelist;
    });
  }
}
module.exports = goveeDeviceDriver;
