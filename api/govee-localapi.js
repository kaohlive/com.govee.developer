//Based on the govee-lan-control npm package

const localapi = require("govee-lan-control");

class GoveeLocalClient {
  constructor() {
    this.GoveeClient = new localapi.default();
    this.localDevices = [];
    this.GoveeClient.on("ready", () => {
      console.log("Local Govee Server/client is ready!");
    });
    this.GoveeClient.on("deviceAdded", (device) => {
      this.localDevices.push(device);
      console.log("New Device! [", device.model, ']. Total devices:'+this.localDevices.length);
    });
  }

  deviceList() {
    console.log('Local API returning: '+this.localDevices.length+' devices');
    return this.localDevices;
  }

  getDeviceById(deviceId)
  {
    var filteredDevices=this.localDevices.filter(device => {
      return device.deviceID === deviceId
    });
    if(filteredDevices.length==0)
      return null;
    else
      return filteredDevices[0];
  }

  devicesTurn(mode, deviceid) {
    return new Promise((resolve, reject) => {
      var device = this.getDeviceById(deviceid);
      if (device==null) {
        reject(new Error("Could not locate device with id ["+deviceid+"]"));
      } else {
        console.log('attempt to switch device ['+device.deviceID+':'+device.model+'] to new mode: '+mode)
        if(mode)
          resolve(device.actions.setOn());
        else
          resolve(device.actions.setOff());
      }
    });
  }

  brightness(dim, deviceid) {
    return new Promise((resolve, reject) => {
      var device = this.getDeviceById(deviceid);
      if (dim < 0 | dim > 100) {
        reject(new Error("Incorrect dim level"));
      } else if (device==null) {
        reject(new Error("Could not locate device with id ["+deviceid+"]"));
      } else {
        console.log('attempt dim device ['+device.deviceID+':'+device.model+'] to new level: '+dim)
        resolve(device.actions.setBrightness (dim));
      }
    });
  }

  //Color object needs to be { 'r': 255, 'g': 255, 'b': 244 }
  color(color, deviceid) {
    return new Promise((resolve, reject) => {
      var device = this.getDeviceById(deviceid);
      if (device==null) {
        reject(new Error("Could not locate device with id ["+deviceid+"]"));
      } else {
        console.log('attempt set color of device ['+device.deviceID+':'+device.model+'] to new color: '+JSON.stringify(color));
        resolve(device.actions.setColor(color));
      }
    });
  }

}

exports.GoveeClient = GoveeLocalClient;