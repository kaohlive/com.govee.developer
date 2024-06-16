'use strict';

const GoveeDriver = require('../../api/govee-driver-v2')

class goveeSensorDriver extends GoveeDriver {

  async onInit() {
    //Setup the matching filter during pairing
    await super.onInit();
    this.goveedrivertype='sensor';
  }

}
module.exports = goveeSensorDriver;