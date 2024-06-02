'use strict';

const GoveeDriver = require('../../api/govee-driver-v2');
const GoveeDeviceV2 = require("./device");

class goveeDeviceDriver extends GoveeDriver {
  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    this.log('List available govee lights');
    //Lets get our base driver all devices call (thats a single API call and therefor the best option)
    var devicelist = await this.ListDevices('light');
    this.log(devicelist);
    return devicelist;
    //We do NOT apply our device type filter now to ensure we list all devices
  }

}
module.exports = goveeDeviceDriver;