'use strict';

const { Driver } = require('homey');
const tinycolor = require('tinycolor2');
const gv = require('./govee-localapi');
const gvCloud = require('./govee-api-v2');


class GoveeDriver extends Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    if(this.homey.app.localApiClient===null)
      this.homey.app.localApiClient = new gv.GoveeClient();
    this.log('govee.localdriver has been initialized');
  }

  async cloudInit()
  {
    this.coudapi = new gvCloud.GoveeClient({
      api_key: this.homey.settings.get('api_key')
    });
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async ListDevices() {
    this.log('List available devices');
    var devicelist = null;
    devicelist = await this.homey.app.localApiClient.deviceList();
    this.log('Received '+devicelist.length+' from local discovery');
    //Convert to our Homey device info object
    var devices = await devicelist.map((device) => {
      let goveedevice = {
        id: device.deviceID,
        icon: '../../../assets/add_list_type_device_'+device.model.substring(1)+'.svg',
        name: device.model,
        data: {
          id: device.deviceID,
          name: device.deviceID,
          model: device.model,
          capabilitieslist: device.state
        }
      }
      this.log('device located: '+JSON.stringify(goveedevice));
      return goveedevice;
    });
    this.log ('listed: '+devices.length+' govee devices');
    return devices;
  }

  async turn(mode, deviceid) {
      this.log('device ('+deviceid+') state change requested ['+mode+']');
      return this.homey.app.localApiClient.devicesTurn(mode,deviceid);
  }

  async brightness(dim, deviceid) {
    //Correct dim level from percentage to the range 0-100
    var correctDimLevel = (dim*100);
		this.log('device ('+deviceid+') brightness change requested ['+correctDimLevel+']');
    return this.homey.app.localApiClient.brightness(correctDimLevel, deviceid);
  }

  async colorTemp(colortemp, deviceid) {
    //We need to correct the Homey color temp to what Govee expects
    //let rgb = this.colorCommandSetParser(hue*360,sat*100,light*100);
    let color = {
      kelvin: colortemp
    }
		this.log('device ('+deviceid+') color temp change requested ['+colortemp+'] converted to color ['+JSON.stringify(color)+']');
    return this.homey.app.localApiClient.color(color, deviceid);
  }

  async color(hue, sat, light, deviceid) {
    //We need to correct the Homey color number to RGB values
    let rgb = this.colorCommandSetParser(hue*360,sat*100,light*100);
    let color = {
      rgb: [rgb.r, rgb.g, rgb.b]
    }
		this.log('device ('+deviceid+') color change requested ['+hue+','+sat+','+light+'] converted to color ['+JSON.stringify(color)+']');
    return this.homey.app.localApiClient.color(color, deviceid);
  }

  colorHexCommandSetParser( colorStr ) {
    var colorhex = tinycolor(colorStr);
    //this.log("attempt to convert "+colorStr+" mapped to "+colorhex.toHex());
    return colorhex.toHex();
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

  /**
   * The follwing methods are for cloud enhanced devices
   * Should be a copy of the driver-v2 methods
   */

  async toggle(mode, instance, model, device, type) {
		this.log('device toggle requested ['+mode+'] for intance '+instance);
    return this.coudapi.devicesToggle(mode, instance, model, device);
  }

  async deviceLightModes(model, device) {
    return this.coudapi.lightModes(model, device).then( device => {
      let deviceState = {
        id: device.device,
        model: device.sku,
        capabilitieslist:device.capabilities
      }
      return deviceState;
    });
  }

  async deviceDiyLightModes(model, device) {
    return this.coudapi.diyLightModes(model, device).then( device => {
      let deviceState = {
        id: device.device,
        model: device.sku,
        capabilitieslist:device.capabilities
      }
      return deviceState;
    });
  }

  async setLightScene(scene, instance, model, device, type) {
		this.log('device light scene requested ['+scene+'] for intance '+instance);
    return this.coudapi.setLightScene(scene, instance, model, device);
  }

  async setMusicMode(musicMode, sensitivity, model, device) {
		this.log('device music mode requested ['+musicMode+'|'+sensitivity+']');
    return this.coudapi.setMusicMode(musicMode, sensitivity, model, device);
  }

  async setSegmentColor(segment, colorHex, mode, model, device, type) {
    let colorParsed = this.colorHexCommandSetParser(colorHex);
    this.log('device segment change requested ['+segment+'] to color '+colorParsed);
    return this.coudapi.setSegmentColor(segment, parseInt(colorParsed, 16), mode, model, device);
  }
  async setSegmentBrightness(segment, brightness, mode, model, device, type) {
    this.log('device segment change requested ['+segment+'] to brightness '+brightness);
    return this.coudapi.setSegmentBrightness(segment, brightness, mode, model, device);
  }

  async setSegmentBrightness(segment ,brightness, mode, model, device, type) {
    this.log('device segment change requested ['+segment+'] to brightness '+brightness);
    return this.coudapi.setSegmentBrightness(segment ,brightness, mode, model, device);
  }
}


module.exports = GoveeDriver;