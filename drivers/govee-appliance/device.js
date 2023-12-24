'use strict';

const GoveeDevice = require('../../api/govee-device')

class goveeAppliance extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capaciltities of this device
    this.goveedevicetype='appliance';
    await this.setupDevice();
  }

}

module.exports = goveeAppliance;