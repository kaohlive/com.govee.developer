'use strict';

const GoveeDriver = require('../../api/govee-driver')
const deviceModel = 'H6159';

class goveeDeviceDriver extends GoveeDriver {
  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    console.log('List available devices and apply driver type filter');
    //Lets get our base driver all devices call (thats a single API call and therefor the best option)
    var devicelist = await this.ListDevices();
    console.log(devicelist);
    //We apply our device type filter now to ensure we only list the right type
    let filteredDevices = devicelist.filter(device => device.data.model.toString().toUpperCase() == deviceModel);
    console.log ('listed: '+filteredDevices.length+' '+deviceModel+' devices');
    return filteredDevices;
  }
}
module.exports = goveeDeviceDriver;