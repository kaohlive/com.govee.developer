'use strict';

const GoveeDevice = require('../../api/govee-device-v2')

class goveeIceMaker extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capabilities of this device
    this.goveedevicetype='ice_maker';
    await this.setupDevice();
  }

}

module.exports = goveeIceMaker;