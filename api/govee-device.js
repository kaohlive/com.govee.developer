'use strict';

const { Device } = require('homey');

class GoveeDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
  async setupDevice() {
    this.data = this.getData();
    this.setupCapabilities();
    this.log('govee.device.'+this.data.model+': '+this.data.name+' has been setup');
    this.refreshState();
    this.start_update_loop();
  }

  start_update_loop() {
    this._timer = setInterval(() => {
        this.refreshState();
    }, 30000); //0.5 min
  }

  async refreshState()
  {
    this.log('govee.device.'+this.data.model+': '+this.data.name+' ddevice state to be retrieved');
    this.driver.deviceState(this.data.model, this.data.mac).then(currentState => {
      console.log(JSON.stringify(currentState.properties));
      //Now update the capabilities with the actual state
      if (this.hasCapability('onoff'))
      {
        var powerstate = currentState.properties.find(property => { return property['powerState'] != undefined })
        if(powerstate['powerState'].toString().toUpperCase()=='ON')
          this.setCapabilityValue('onoff', true);
        if(powerstate['powerState'].toString().toUpperCase()=='OFF')
          this.setCapabilityValue('onoff', false);
      }
      if (this.hasCapability('dim'))
      {
        var brightness = currentState.properties.find(property => { return property['brightness'] != undefined })
        this.setCapabilityValue('dim', (brightness['brightness']/100));
      }
      if (this.hasCapability('light_temperature'))
      {
        var colorTem = currentState.properties.find(property => { return property['colorTem'] != undefined })
        if(colorTem!=null && colorTem!=undefined)
        {
          let rangeMin = this.data.properties.colorTem.range.min;
          let rangeMax = this.data.properties.colorTem.range.max;
          let rangeTotal = rangeMax-rangeMin;
          console.log('range[max:'+rangeMax+', min: '+rangeMin+', range: '+rangeTotal+']');
          var rangePerc = (colorTem['colorTem']-rangeMin)/rangeTotal;
          this.setCapabilityValue('light_temperature', rangePerc);
        } else {
          console.log('no color temp known');
          this.setCapabilityValue('light_temperature', null);
        }
      }
      if(this.hasCapability('light_hue'))
      {
        var colorRGB = currentState.properties.find(property => { return property['color'] != undefined })
        if(colorRGB!=null && colorRGB!=undefined)
        {
          var colorHSV=this.driver.colorCommandGetParser(colorRGB['color']);
          console.log(JSON.stringify(colorHSV))
          this.setCapabilityValue('light_saturation', colorHSV.s);
          this.setCapabilityValue('light_hue', (colorHSV.h/360));
        }
        else {
          console.log('no color rgb known');
          this.setCapabilityValue('light_hue', null);
          this.setCapabilityValue('light_saturation', null);
        }
      }
    }).catch((err) => console.log('Error calling the state endpoint ['+JSON.stringify(err)+']'));
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   * That is a good moment to map the device capabilties of Govee with the Homey capabilities
   */
  async onAdded() {
    this.log('govee.device.'+this.data.model+': '+this.data.name+' has been added');
    //Now create the capabilties based on the device
    if(this.data.capabilitieslist.includes('turn'))
		  if(!this.hasCapability('onoff'))
			  await this.addCapability('onoff');    
    if(this.data.capabilitieslist.includes('brightness'))
      if(!this.hasCapability('dim'))
        await this.addCapability('dim');    
    if(this.data.capabilitieslist.includes('color'))
    {
      if(!this.hasCapability('light_saturation'))
        await this.addCapability('light_saturation');    
      if(!this.hasCapability('light_hue'))
        await this.addCapability('light_hue');    
    }
    if(this.data.capabilitieslist.includes('colorTem'))
      if(!this.hasCapability('light_temperature'))
        await this.addCapability('light_temperature');
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
    if (this.hasCapability('light_saturation'))
      this.registerCapabilityListener('light_saturation', this.onCapabilitySaturation.bind(this));
    if (this.hasCapability('light_hue'))
      this.registerCapabilityListener('light_hue', this.onCapabilityHue.bind(this));
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
    if(value){
      await this.driver.turn('on',this.data.model, this.data.mac);
    } else {
      await this.driver.turn('off',this.data.model, this.data.mac);
    }
    this.setIfHasCapability('onoff', value);
  }

  /**
   * Sets the device to the desired brightness level
   * @param {number} value a value between 0 and 100 to indicate the desired brightness level of the device
   * @param {*} opts 
   */
  async onCapabilityDim( value, opts ) {
    await this.driver.brightness(value,this.data.model, this.data.mac);
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
    await this.driver.color(hue,value,light,this.data.model, this.data.mac);
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
    await this.driver.color(value,saturation,light,this.data.model, this.data.mac);
    this.setIfHasCapability('light_hue', value);
  }

  /**
   * Sets the color temperature of the device
   * @param {number} value The color temperature in percentage of the range of the device
   * @param {*} opts 
   */
  async onCapabilityLightTemperature( value, opts ) {
    //If the capability colorTem is available, these properties should be also
    let rangeMin = this.data.properties.colorTem.range.min;
    let rangeMax = this.data.properties.colorTem.range.max;
    var relativeColorTemp = ((rangeMax-rangeMin)*value)+rangeMin;
    await this.driver.colorTemp(relativeColorTemp,this.data.model, this.data.mac);
    this.setIfHasCapability('light_temperature', value);
  }

  setIfHasCapability(cap, value) {
    if (this.hasCapability(cap)) {
        return this.setCapabilityValue(cap, value).catch(this.error)
    } else {
        console.log('Attempt to set cap ['+cap+'] on device '+this.data.model+':'+this.data.name+' but it is not available');
    }
  }
}

module.exports = GoveeDevice;
