'use strict';

const GoveeDevice = require('../../api/govee-device')

class H6144Device extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capaciltities of this device
    await this.setupDevice();
  }

}

module.exports = H6144Device;