'use strict';

const GoveeDevice = require('../../api/govee-device-v2')

class goveeSensor extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capaciltities of this device
    this.goveedevicetype='sensor';
    await this.setupDevice();
  }

}

module.exports = goveeSensor;