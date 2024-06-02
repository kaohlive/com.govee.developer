'use strict';

const GoveeDevice = require('../../api/govee-device-v2')

class goveeAromaDiffuser extends GoveeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    //Setup the matching capaciltities of this device
    this.goveedevicetype='aroma_diffuser';
    await this.setupDevice();
  }

}

module.exports = goveeAromaDiffuser;