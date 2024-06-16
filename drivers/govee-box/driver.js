'use strict';

const GoveeDriver = require('../../api/govee-driver-v2')

class goveeBoxDriver extends GoveeDriver {

  async onInit() {
    //Setup the matching filter during pairing
    await super.onInit();
    this.goveedrivertype='box';
  }
  
}

module.exports = goveeBoxDriver;