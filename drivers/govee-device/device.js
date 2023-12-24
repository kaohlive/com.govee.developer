'use strict';

const GoveeDevice = require('../../api/govee-device')

class goveeDevice extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capaciltities of this device
    this.goveedevicetype='device';
    await this.setupDevice();
  }

}

module.exports = goveeDevice;