'use strict';

const { Device } = require('homey');

class GoveeLocalDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
  async setupDevice() {
    this.data = this.getData();
    this.setupCapabilities();
    this.log('govee.device.'+this.data.model+': '+this.data.id+' of type '+this.goveedevicetype+' has been setup');
    this.setWarning('Discovering the device....');
    this.setUnavailable();
    //Register the update event
    //We need to wait for this device to be discovered
    this.start_update_loop();
  }

  registerUpdateEvent(apidevice) {
    apidevice.on('updatedStatus', (state, stateChanged) => {
      if(stateChanged.length>0){
        console.log("Received an update for device ["+this.data.id+"]");
        this.refreshState(state,stateChanged);
      }
    });
  }

  start_update_loop() {
    this._timer = setInterval(() => {
        var discoveredDevice = this.driver.api.getDeviceById(this.data.id);
        if(discoveredDevice!=null)
        {
          this.setWarning(null);
          this.setAvailable();
          this.registerUpdateEvent(discoveredDevice);
          this.refreshState(discoveredDevice.state,["onOff","brightness","color"]);
          clearInterval(this._timer);
        }
    }, 1000);
  }

  async refreshState(newState,stateChanged)
  {
    console.log(JSON.stringify(stateChanged));
    //console.log(JSON.stringify(newState));
    this.log('govee.device.'+this.data.model+': '+this.data.id+' device state to be retrieved');
    //Now update the capabilities with the actual state
    if (this.hasCapability('onoff') && stateChanged.includes('onOff'))
    {
      console.log('New power state is '+(newState.isOn==1));
      this.setCapabilityValue('onoff', (newState.isOn==1));
    }
    if (this.hasCapability('dim') && stateChanged.includes('brightness'))
    {
      var brightness = newState.brightness;
      console.log('New brightness is '+brightness);
      if (brightness > 100)
        this.setCapabilityValue('dim', (brightness/255)); //Seems to be a mismatch in documentation. It should be a range between 0 and 100
      else
        this.setCapabilityValue('dim', (brightness/100));
    }
    if(stateChanged.includes('color') || stateChanged.includes('colorKelvin'))
    {
      var colorRGB = newState.color;
      console.log(colorRGB)
      if((colorRGB.r==255 && colorRGB.g==255 && colorRGB.b==255) ||
      (colorRGB.r==0 && colorRGB.g==0 && colorRGB.b==0)) //Is the color black or white
      {
        console.log('its white, set in colorTemp mode');
        //Determine colorTemp based on the Kelvin value
        var colorTem = newState.colorKelvin;
        let rangeMin = 2000;
        let rangeMax = 9000;
        let rangeTotal = rangeMax-rangeMin;
        console.log('colorTem: '+colorTem+' - range[max:'+rangeMax+', min: '+rangeMin+', range: '+rangeTotal+']');
        var rangePerc = (colorTem-rangeMin)/rangeTotal;
        if (rangePerc>1) rangePerc = 1; //Seems that sometimes this math ends up in a higher than 1 result, strange but without more data hard to locate.
        this.setCapabilityValue('light_temperature', rangePerc);
        this.setCapabilityValue('light_mode', 'temperature');
      } else {
        var colorHSV=this.driver.colorCommandGetParser(colorRGB);
        console.log('Set in color mode'+JSON.stringify(colorHSV));
        this.setCapabilityValue('light_saturation', colorHSV.s);
        this.setCapabilityValue('light_hue', (colorHSV.h/360));
        this.setCapabilityValue('light_mode', 'color'); //Tell homey we are not in colorTemp mode
      }
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   * That is a good moment to map the device capabilties of Govee with the Homey capabilities
   */
  async onAdded() {
    this.log('govee.device.'+this.data.model+': '+this.data.id+' has been added');
    //Now create the capabilties based on the device
    if(!this.hasCapability('onoff'))
      await this.addCapability('onoff');    
    if(!this.hasCapability('dim'))
      await this.addCapability('dim');    
    if(!this.hasCapability('light_saturation'))
      await this.addCapability('light_saturation');    
    if(!this.hasCapability('light_hue'))
      await this.addCapability('light_hue');    
    if(!this.hasCapability('light_temperature'))
      await this.addCapability('light_temperature');
    if(!this.hasCapability('light_mode'))
      await this.addCapability('light_mode');
    this.setupCapabilities();
  }

  /**
   * Ensure we setup the listeners of the registered capabities.
   * Since we add capbilities based on the govee API this should create a full dynamic device
   */
  setupCapabilities()
  {
    if (this.hasCapability('onoff'))
      this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    if (this.hasCapability('dim'))
      this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));
    if (this.hasCapability('light_temperature'))
      this.registerCapabilityListener('light_temperature', this.onCapabilityLightTemperature.bind(this));
    if (this.hasCapability('light_mode'))
      this.registerCapabilityListener('light_mode', this.onCapabilityLightMode.bind(this));
    if(this.hasCapability('light_hue') && this.hasCapability('light_saturation'))
    {
      this.registerMultipleCapabilityListener(['light_saturation', 'light_hue'], this.onCapabilityHueSaturation.bind(this))
    } else {
      if (this.hasCapability('light_saturation'))
        this.registerCapabilityListener('light_saturation', this.onCapabilitySaturation.bind(this));
      if (this.hasCapability('light_hue'))
        this.registerCapabilityListener('light_hue', this.onCapabilityHue.bind(this));
    }
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('govee.device.'+this.data.model+': '+this.data.name+' settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('govee.device.'+this.data.model+': '+this.data.name+' was renamed to '+name);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('govee.device.'+this.data.model+': '+this.data.name+' has been deleted');
    if (this._timer) {
      clearInterval(this._timer)
    }
  }

  /**
   * Turns the device on or off based on the passed value
   * @param {string} value the 'on' or 'off' value of the device state
   * @param {*} opts 
   */
  async onCapabilityOnoff( value, opts ) {
    await this.driver.turn(value,this.data.id);
    this.setIfHasCapability('onoff', value);
  }

  /**
   * Sets the device to the desired brightness level
   * @param {number} value a value between 0 and 100 to indicate the desired brightness level of the device
   * @param {*} opts 
   */
  async onCapabilityDim( value, opts ) {
    await this.driver.brightness(value,this.data.id);
    this.setIfHasCapability('dim', value);
  }

  /**
   * Sets the saturation value of the color
   * @param {number} value The percentage of the color saturation
   * @param {*} opts 
   */
  async onCapabilitySaturation( value, opts ) {
    //Since we need full RGB values for Govee, Lets retrieve the hue value
    var hue = this.getState().light_hue;
    var light = 1;
    console.log("Capability trigger: Saturation");
    await this.driver.color(hue,value,light,this.data.id);
    this.setIfHasCapability('light_saturation', value);
  }

  /**
   * Sets the Hue of the color
   * @param {number} value The color in gradient value based on the color wheel of Homey
   * @param {*} opts 
   */
  async onCapabilityHue( value, opts ) {
    //Since we need full RGB values for Govee, lets retrieve the saturation
    var saturation = this.getState().light_saturation;
    var light = 1;
    console.log("Capability trigger: Hue");
    await this.driver.color(value,saturation,light,this.data.id);
    this.setIfHasCapability('light_hue', value);
  }

  /**
   * Sets the Hue and Saturation of the color
   * @param {number} value The color in gradient value based on the color wheel of Homey
   * @param {*} opts 
   */
  async onCapabilityHueSaturation( newValues, opts ) {
    var light = 1;
    console.log("Capability trigger: Hue & Saturation");
    await this.driver.color(newValues.light_hue,newValues.light_saturation,light,this.data.id);
    this.setIfHasCapability('light_hue', newValues.light_hue);
    this.setIfHasCapability('light_saturation', newValues.light_saturation);
  }

  /**
   * Sets the Light mode for color or tempurature
   * @param {string} value The light mode from the enum color,temperature
   * @param {*} opts 
   */
    async onCapabilityLightMode( value, opts ) {
      console.log("Capability trigger: Switch light modes");
      this.setIfHasCapability('light_mode', value);
      if(value=='temperature'){
        var colorTemp = this.getCapabilityValue('light_temperature');
        await this.onCapabilityLightTemperature(colorTemp);
      } else if (value=='color'){
        var hue = this.getState().light_hue;  
        await this.onCapabilityHue(hue);
      }
    }

  /**
   * Sets the color temperature of the device
   * @param {number} value The color temperature in percentage of the range of the device
   * @param {*} opts 
   */
  async onCapabilityLightTemperature( value, opts ) {
    //If the capability colorTem is available, these properties should be also
    let rangeMin = 2000;
    let rangeMax = 9000;
    var relativeColorTemp = rangeMax-((rangeMax-rangeMin)*value);
    if(value>=0)
    {
      await this.driver.colorTemp(relativeColorTemp,this.data.id);
      this.setIfHasCapability('light_temperature', value);
    }
  }

  setIfHasCapability(cap, value) {
    if (this.hasCapability(cap)) {
        return this.setCapabilityValue(cap, value).catch(this.error)
    } else {
        console.log('Attempt to set cap ['+cap+'] on device '+this.data.model+':'+this.data.name+' but it is not available');
    }
  }
}

module.exports = GoveeLocalDevice;
