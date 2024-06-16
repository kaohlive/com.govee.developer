'use strict';

const GoveeDriver = require('../../api/govee-driver-v2')

class goveeIceMakerDriver extends GoveeDriver {

  async onInit() {
    //Setup the matching filter during pairing
    await super.onInit();
    this.goveedrivertype='ice_maker';
  }

}
module.exports = goveeIceMakerDriver;