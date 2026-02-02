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
    if (this.homey.app.localApiClient === null) {
      this.log('Initializing Local API client...');
      try {
        this.homey.app.localApiClient = new gv.GoveeClient();

        // Register event listeners to propagate device connectivity events
        if (this.homey.app.localApiClient.GoveeClient) {
          this.homey.app.localApiClient.GoveeClient.on('deviceAdded', (device) => {
            this.log(`Local device connected: ${device.deviceID} (${device.model})`);
            this.homey.app.eventBus.emit(`local_device_online_${device.deviceID}`, true);
          });

          this.homey.app.localApiClient.GoveeClient.on('deviceOffline', (device) => {
            this.log(`Local device offline: ${device.deviceID} (${device.model})`);
            this.homey.app.eventBus.emit(`local_device_online_${device.deviceID}`, false);
          });

          this.homey.app.localApiClient.GoveeClient.on('deviceOnline', (device) => {
            this.log(`Local device back online: ${device.deviceID} (${device.model})`);
            this.homey.app.eventBus.emit(`local_device_online_${device.deviceID}`, true);
          });
        }

        // Log initialization status after a short delay
        setTimeout(() => {
          if (this.homey.app.localApiClient) {
            const error = this.homey.app.localApiClient.getInitError();
            if (error) {
              this.error('Local API client initialization failed:', error.message);
            } else if (this.homey.app.localApiClient.isClientReady()) {
              this.log('Local API client initialized successfully');
            } else {
              this.log('Local API client still initializing...');
            }
          }
        }, 5000);
      } catch (err) {
        this.error('Failed to create Local API client:', err.message);
        this.homey.app.localApiClient = null;
      }
    }
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

    // Check if local API client is available and ready
    if (!this.homey.app.localApiClient) {
      this.error('Local API client is not initialized');
      return [];
    }

    const initError = this.homey.app.localApiClient.getInitError();
    if (initError) {
      this.error('Local API client has initialization error:', initError.message);
      return [];
    }

    // Wait for client to be ready with retries
    // Socket creation can take up to 5s, plus devices need time to respond to scan
    const MAX_WAIT_MS = 12000; // 12 seconds total max wait
    const CHECK_INTERVAL_MS = 1000; // Check every second
    let waitedMs = 0;

    while (!this.homey.app.localApiClient.isClientReady() && waitedMs < MAX_WAIT_MS) {
      if (waitedMs === 0) {
        this.log('Local API client not ready yet, waiting for initialization...');
      }
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
      waitedMs += CHECK_INTERVAL_MS;
    }

    if (!this.homey.app.localApiClient.isClientReady()) {
      this.error('Local API client failed to initialize within timeout');
      return [];
    }

    // Client is ready - trigger discovery and wait for devices to respond
    this.log('Local API client ready, triggering discovery scan...');
    this.homey.app.localApiClient.triggerDiscovery();

    // Wait for devices to respond with progressive checks
    // First check after 3s, then keep checking until we have devices or timeout
    const DISCOVERY_WAIT_MS = 8000; // 8 seconds for device discovery
    const DISCOVERY_CHECK_MS = 1000;
    let discoveryWaited = 0;
    let deviceCount = 0;

    while (discoveryWaited < DISCOVERY_WAIT_MS) {
      await new Promise(resolve => setTimeout(resolve, DISCOVERY_CHECK_MS));
      discoveryWaited += DISCOVERY_CHECK_MS;

      const currentCount = this.homey.app.localApiClient.localDevices.length;
      if (currentCount > deviceCount) {
        this.log(`Discovery found ${currentCount} device(s) after ${discoveryWaited}ms`);
        deviceCount = currentCount;
      }

      // If we found devices and no new ones in last 2 seconds, we can stop early
      if (deviceCount > 0 && discoveryWaited >= 3000) {
        // Give a bit more time for additional devices
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }
    }

    var devicelist = this.homey.app.localApiClient.deviceList();
    this.log('Received ' + devicelist.length + ' from local discovery (waited ' + (waitedMs + discoveryWaited) + 'ms total)');

    //Convert to our Homey device info object
    var devices = devicelist.map((device) => {
      let goveedevice = {
        id: device.deviceID,
        icon: '../../../assets/add_list_type_device_'+device.model.substring(1)+'.svg',
        name: device.model,
        data: {
          id: device.deviceID,
          name: device.deviceID,
          model: device.model,
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