'use strict';

const GoveeDevice = require('../../api/govee-device-v2')

class goveeTimer extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capabilities of this device
    this.goveedevicetype='timer';
    await this.setupDevice();
  }

}

module.exports = goveeTimer;
