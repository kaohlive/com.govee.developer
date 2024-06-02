'use strict';

const GoveeDevice = require('../../api/govee-device-v2')

class goveeDeumidifier extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capaciltities of this device
    this.goveedevicetype='dehumidifier';
    await this.setupDevice();
  }

}

module.exports = goveeDeumidifier;