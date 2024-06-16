'use strict';

const GoveeDriver = require('../../api/govee-driver-v2');
const GoveeDeviceV2 = require("./device");

class goveeDeviceDriver extends GoveeDriver {

  async onInit() {
    //Setup the matching filter during pairing
    await super.onInit();
    this.goveedrivertype='light';
  }

}
module.exports = goveeDeviceDriver;