'use strict';

const GoveeDriver = require('../../api/govee-driver')

class goveeApplianceDriver extends GoveeDriver {
  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    console.log('List available govee appkiances');
    //Lets get our base driver all devices call (thats a single API call and therefor the best option)
    var devicelist = await this.ListDevices();
    console.log(devicelist);
    return devicelist;
    //We do NOT apply our device type filter now to ensure we list all devices

  }
}
module.exports = goveeApplianceDriver;