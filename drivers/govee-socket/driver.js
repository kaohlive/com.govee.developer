'use strict';

const GoveeDriver = require('../../api/govee-driver-v2')

class goveeSocketDriver extends GoveeDriver {

  async onInit() {
    //Setup the matching filter during pairing
    await super.onInit();
    this.goveedrivertype='socket';
  }

}
module.exports = goveeSocketDriver;