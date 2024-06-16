'use strict';

const GoveeDriver = require('../../api/govee-driver-v2')

class goveeAirPurifierDriver extends GoveeDriver {

  async onInit() {
    //Setup the matching filter during pairing
    await super.onInit();
    this.goveedrivertype='air_purifier';
  }
  
}
module.exports = goveeAirPurifierDriver;