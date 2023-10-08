'use strict';

const { Driver } = require('homey');
const tinycolor = require('tinycolor2');
const gv = require('./govee-api');


class GoveeDriver extends Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    //console.log(this.homey.settings.get('api_key'));
    this.api = new gv.GoveeClient({
      api_key: this.homey.settings.get('api_key')
    });
    this.log('govee.driver has been initialized');
  }

  async reInit() {
    //console.log(this.homey.settings.get('api_key'));
    this.api = new gv.GoveeClient({
      api_key: this.homey.settings.get('api_key')
    });
    this.log('govee.driver has been re-initialized');
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async ListDevices() {
    console.log('Lets restart the API client to ensure we use the latest API key from the settings');
    await this.reInit();
    console.log('List available devices');

    var devicelist = await this.api.deviceList();
    console.log(devicelist);

    //Convert to our Homey device info object
    var devices = await devicelist.data.devices.map((device) => {
      let goveedevice = {
        id: device.device,
        icon: 'add_list_type_device_'+device.model.substring(1)+'.svg',
        name: device.deviceName,
        data: {
          mac: device.device,
          name: device.deviceName,
          model: device.model,
          controllable: device.controllable,
          retrievable: device.retrievable,
          capabilitieslist: device.supportCmds,
          properties: device.properties
        }
      }
      console.log('device located: '+JSON.stringify(goveedevice));
      return goveedevice;
    });
    console.log ('listed: '+devices.length+' govee devices');
    return devices;
  }

  async deviceState(model, device) {
    return this.api.state(model, device).then( device => {
      let deviceState = {
        id: device.data.device,
        model: device.data.model,
        properties:device.data.properties
      }
      return deviceState;
    });
  }

  async turn(mode, model, device) {
		console.log('device state change requested ['+mode+']');
    return this.api.turn(mode, model, device);
  }

  async brightness(dim, model, device) {
    //Correct dim level from percentage to the range 0-100
    var correctDimLevel = (dim*100);
		console.log('device brightness change requested ['+correctDimLevel+']');
    return this.api.brightness(correctDimLevel, model, device);
  }

  async colorTemp(colortemp, model, device) {
    //We need to correct the Homey color temp to what Govee expects
    var correctColorTemp = colortemp;
    console.log('device saturation change requested ['+correctColorTemp+']');
    return this.api.colorTemp(correctColorTemp, model, device);
  }

  async color(hue, sat, light, model, device) {
    //We need to correct the Homey color number to RGB values
    let rgb = this.colorCommandSetParser(hue*360,sat*100,light*100);
    let color = {
      'r': rgb.r,
      'b': rgb.b,
      'g': rgb.g
    }
		console.log('device color change requested ['+hue+','+sat+','+light+'] converted to color ['+JSON.stringify(color)+']');
    return this.api.color(color, model, device);
  }

  colorCommandSetParser( hue, sat, light ) {
    var rgb = tinycolor({
      h: hue,
      s: sat,
      v: light
    }).toRgb();
    return rgb;
  }

  colorCommandGetParser(rgb)
  {
    var hsv = tinycolor({
      r: rgb.r || 0,
      g: rgb.g || 0,
      b: rgb.b || 0
    }).toHsv();
    return hsv;
  }
}


/**
 * Example responses
 *{ data: { devices: [ [Object] ] }, message: 'Success', code: 200 }
 *{"id":"40:18:A4:C1:38:D1:02:0C","name":"Basement Ambilight","model":"H6054","retrievable":true,"capabilitieslist":["turn","brightness","color","colorTem"],"properties":{"colorTem":{"range":{"min":2000,"max":9000}}}}
 */
module.exports = GoveeDriver;