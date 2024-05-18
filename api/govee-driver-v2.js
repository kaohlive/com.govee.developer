'use strict';

const { Driver } = require('homey');
const tinycolor = require('tinycolor2');
const gv = require('./govee-api-v2');

class GoveeDriver extends Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.api = new gv.GoveeClient({
      api_key: this.homey.settings.get('api_key')
    });
    if(this.getDevices().length>0)
      await this.homey.app.setupMqttReceiver();
  }

  async reInit() {
    this.api = new gv.GoveeClient({
      api_key: this.homey.settings.get('api_key')
    });

    this.log('govee.driver has been re-initialized');
  }



  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async ListDevices(type) {
    this.log('Lets restart the API client to ensure we use the latest API key from the settings');
    await this.reInit();
    this.log('List available '+type);
    var devicelist = await this.api.deviceList();
    this.log(devicelist);

    //Convert to our Homey device info object
    var devices = await devicelist.data.map((device) => {
      let goveedevice = {
        id: device.device,
        icon: '../../../assets/add_list_type_device_'+device.sku.substring(1)+'.svg',
        name: device.deviceName,
        data: {
          id: device.device,
          mac: device.device,
          name: device.deviceName,
          model: device.sku,
          type: device.type,
          goveeApi: 'v2',
          capabilitieslist: device.capabilities,
        }
      }
      this.log(type+' located: '+JSON.stringify(goveedevice));
      return goveedevice;
    });
    //Now we filter on types
    var filteredDevices=null;
    if (type=='device')
      filteredDevices = devices.filter(n => n.data.type === 'devices.types.light');
    else         
      filteredDevices = devices.filter(n => n.data.type !== 'devices.types.light');

      this.log ('listed: '+filteredDevices.length+' govee '+type);
    return filteredDevices;
  }

  async deviceState(model, device) {
    return this.api.state(model, device).then( device => {
      let deviceState = {
        id: device.device,
        model: device.sku,
        capabilitieslist:device.capabilities
      }
      return deviceState;
    });
  }

  async deviceLightModes(model, device) {
    return this.api.lightModes(model, device).then( device => {
      let deviceState = {
        id: device.device,
        model: device.sku,
        capabilitieslist:device.capabilities
      }
      return deviceState;
    });
  }

  async deviceDiyLightModes(model, device) {
    return this.api.diyLightModes(model, device).then( device => {
      let deviceState = {
        id: device.device,
        model: device.sku,
        capabilitieslist:device.capabilities
      }
      return deviceState;
    });
  }

  async setLightScene(scene, instance, model, device, type) {
		this.log('device state change requested ['+scene+'] for intance '+instance);
    return this.api.setLightScene(scene, instance, model, device);
  }

  async turn(mode, model, device, type) {
		this.log('device state change requested ['+mode+']');
    return this.api.devicesTurn(mode, model, device);
  }

  async mode(mode, model, device, type) {
		this.log('device mode change requested ['+mode+']');
    return this.api.devicesMode(mode, model, device);
  }

  async brightness(dim, model, device) {
    //Correct dim level from percentage to the range 0-100
    var correctDimLevel = (dim*100);
		this.log('device brightness change requested ['+correctDimLevel+']');
    return this.api.brightness(correctDimLevel, model, device);
  }

  async colorTemp(colortemp, model, device) {
    //We need to correct the Homey color temp to what Govee expects
    var correctColorTemp = colortemp;
    this.log('device saturation change requested ['+correctColorTemp+']');
    return this.api.colorTemp(correctColorTemp, model, device);
  }

  async color(hue, sat, light, model, device) {
    //We need to correct the Homey color number to RGB values
    let colorHex = this.colorCommandSetParser(hue*360,sat*100,light*100);
		this.log('device color change requested ['+hue+','+sat+','+light+'] converted to color ['+JSON.stringify(colorHex)+']');
    return this.api.color(parseInt(colorHex, 16), model, device);
  }

  colorCommandSetParser( hue, sat, light ) {
    var colorhex = tinycolor({
      h: hue,
      s: sat,
      v: light
    });
    return colorhex.toHex();
  }

  //API v2 uses a int value that we assume is the hex
  colorCommandGetParser(rgb)
  {
    var hsv = tinycolor(tinycolor(rgb.toString(16).padStart(6, '0'))).toHsv();
    return hsv;
  }
}

module.exports = GoveeDriver;