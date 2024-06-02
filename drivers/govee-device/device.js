'use strict';

const GoveeDevice = require('../../api/govee-device-v2')

class goveeDevice extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capaciltities of this device
    this.goveedevicetype='light';
    await this.setupDevice();
  }

}

module.exports = goveeDevice;