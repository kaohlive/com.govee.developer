'use strict';

const GoveeDriver = require('../../api/govee-driver-v2')

class goveeThermometerDriver extends GoveeDriver {
  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    console.log('List available govee thermometers');
    //Lets get our base driver all devices call (thats a single API call and therefor the best option)
    var devicelist = await this.ListDevices('thermometer');
    console.log(devicelist);
    return devicelist;
    //We do NOT apply our device type filter now to ensure we list all devices

  }
}
module.exports = goveeThermometerDriver;