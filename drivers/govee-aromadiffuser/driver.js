'use strict';

const GoveeDriver = require('../../api/govee-driver-v2')

class goveeAromaDiffuserDriver extends GoveeDriver {

  async onInit() {
    //Setup the matching filter during pairing
    await super.onInit();
    this.goveedrivertype='aroma_diffuser';
  }

}
module.exports = goveeAromaDiffuserDriver;