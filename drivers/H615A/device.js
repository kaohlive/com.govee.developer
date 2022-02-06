'use strict';

const GoveeDevice = require('../../api/govee-device')

class H615ADevice extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capaciltities of this device
    await this.setupDevice();
  }

}

module.exports = H615ADevice;