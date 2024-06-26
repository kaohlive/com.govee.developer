'use strict';

const { Device } = require('homey');

class GoveeDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
  async setupDevice() {
    this.data = this.getData();

    //Todo: remove after a while
    //Note: Fix due to late arrival of this capability in my devices
    if(this.data.capabilitieslist.includes('color') && this.data.capabilitieslist.includes('colorTem'))
    {
      if(!this.hasCapability('light_mode'))
        await this.addCapability('light_mode');
    }

    this.setupCapabilities();
    this.log('govee.device.'+this.data.model+': '+this.data.name+' of type '+this.goveedevicetype+' has been setup');
    this.log(this.icon);
    this.refreshState();
    this.start_update_loop();
  }

  start_update_loop() {
    let interval = this.homey.settings.get('poll_interval');
    if(interval < 60000)
    {
      this.log('Interval is not set or set to low, force 1 min');
      interval = 60000;
    }
    this._timer = setInterval(() => {
        this.refreshState();
    }, interval); //Do not set this to low, 4 devices per halve minute already surpases the 10K global call count per day
  }

  async refreshState()
  {
    this.log('govee.device.'+this.data.model+': '+this.data.name+' device state to be retrieved');
    this.driver.deviceState(this.data.model, this.data.mac, this.goveedevicetype).then(currentState => {
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
        if (brightness['brightness'] > 100)
          this.setCapabilityValue('dim', (brightness['brightness']/255)); //Seems to be a mismatch in documentation. It should be a range between 0 and 100
        else
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
          console.log('colorTem: '+colorTem['colorTem']+' - range[max:'+rangeMax+', min: '+rangeMin+', range: '+rangeTotal+']');
          var rangePerc = (colorTem['colorTem']-rangeMin)/rangeTotal;
          if (rangePerc>1) rangePerc = 1; //Seems that sometimes this math ends up in a higher than 1 result, strange but without more data hard to locate.
          this.setCapabilityValue('light_temperature', rangePerc);
          if(this.hasCapability('light_mode'))
            this.setCapabilityValue('light_mode', 'temperature'); //Tell homey we are in colorTemp mode
        } else {
          console.log('no color temp known');
          if(this.hasCapability('light_mode'))
            this.setCapabilityValue('light_mode', 'color'); //Tell homey we are not in colorTemp mode
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
          if(this.hasCapability('light_mode'))
            this.setCapabilityValue('light_mode', 'color'); //Tell homey we are in color mode
          this.setCapabilityValue('light_saturation', colorHSV.s);
          this.setCapabilityValue('light_hue', (colorHSV.h/360));
        }
        else {
          console.log('no color rgb known');
          if(this.hasCapability('light_mode'))
            this.setCapabilityValue('light_mode', 'temperature'); //Tell homey we are not in color mode
          this.setCapabilityValue('light_hue', null);
          this.setCapabilityValue('light_saturation', null);
        }
      }
      if(this.hasCapability('mode'))
      {
        var mode = currentState.properties.find(property => { return property['mode'] != undefined })
        if(mode!=null && mode!=undefined)
        {
          //How to read modes?
          this.setCapabilityValue('mode', this.data.properties.mode);
        }
        else {
          //How to read modes?
          this.setCapabilityValue('mode', null);
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
    if(this.data.capabilitieslist.includes('color') && this.data.capabilitieslist.includes('colorTem'))
    {
      if(!this.hasCapability('light_mode'))
        await this.addCapability('light_mode');
    }
    if(this.data.capabilitieslist.includes('mode'))
		  if(!this.hasCapability('mode'))
      {
        let modeValues = this.data.properties.mode.options;
        //TODO: Configure the mode capability with the possible modes
			  await this.addCapability('mode');

        let optvalues = modeValues.map((modevalueoption) => {
            let value = {
              id: modevalueoption.value,
              title: {
                en: modevalueoption.name
              } 
          }
          return value;
        });
        let options = {
          values: optvalues
        }
        setCapabilityOptions('mode', options)
      }
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
    if(this.hasCapability('light_hue') && this.hasCapability('light_saturation'))
    {
      this.registerMultipleCapabilityListener(['light_saturation', 'light_hue'], this.onCapabilityHueSaturation.bind(this))
    } else {
      if (this.hasCapability('light_saturation'))
        this.registerCapabilityListener('light_saturation', this.onCapabilitySaturation.bind(this));
      if (this.hasCapability('light_hue'))
        this.registerCapabilityListener('light_hue', this.onCapabilityHue.bind(this));
    }
    if (this.hasCapability('light_mode'))
      this.registerCapabilityListener('light_mode', this.onCapabilityLightMode.bind(this));
    if (this.hasCapability('mode'))
      this.registerCapabilityListener('mode', this.onCapabilityMode.bind(this));
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
      await this.driver.turn('on',this.data.model, this.data.mac, this.goveedevicetype);
    } else {
      await this.driver.turn('off',this.data.model, this.data.mac, this.goveedevicetype);
    }
    this.setIfHasCapability('onoff', value);
  }

  /**
   * Switches the device to a different mode
   * @param {string} value the mode value of the device
   * @param {*} opts 
   */
    async onCapabilityMode( value, opts ) {
      if(value){
        await this.driver.mode('on',this.data.model, this.data.mac, this.goveedevicetype);
      } else {
        await this.driver.mode('off',this.data.model, this.data.mac, this.goveedevicetype);
      }
      this.setIfHasCapability('mode', value);
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
    this.log("Capability trigger: Saturation");
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
    this.log("Capability trigger: Hue");
    await this.driver.color(value,saturation,light,this.data.model, this.data.mac);
    this.setIfHasCapability('light_hue', value);
  }

  /**
   * Sets the Hue and Saturation of the color
   * @param {number} value The color in gradient value based on the color wheel of Homey
   * @param {*} opts 
   */
  async onCapabilityHueSaturation( newValues, opts ) {
    var light = 1;
    this.log("Capability trigger: Hue & Saturation");
    await this.driver.color(newValues.light_hue,newValues.light_saturation,light,this.data.model, this.data.mac);
    this.setIfHasCapability('light_hue', newValues.light_hue);
    this.setIfHasCapability('light_saturation', newValues.light_saturation);
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
    var relativeColorTemp = rangeMax-((rangeMax-rangeMin)*value);
    if(value>=0)
    {
      await this.driver.colorTemp(relativeColorTemp,this.data.model, this.data.mac);
      this.setIfHasCapability('light_temperature', value);
    }
  }

    /**
   * Sets the Light mode for color or tempurature
   * @param {string} value The light mode from the enum color,temperature
   * @param {*} opts 
   */
    async onCapabilityLightMode( value, opts ) {
      this.log("Capability trigger: Switch light modes");
      this.setIfHasCapability('light_mode', value);
      if(value=='temperature'){
        var colorTemp = this.getCapabilityValue('light_temperature');
        await this.onCapabilityLightTemperature(colorTemp);
      } else if (value=='color'){
        var hue = this.getState().light_hue;  
        await this.onCapabilityHue(hue);
      }
    }

  setIfHasCapability(cap, value) {
    if (this.hasCapability(cap)) {
      return this.setCapabilityValue(cap, value).catch(this.error)
    } else {
      this.log('Attempt to set cap ['+cap+'] on device '+this.data.model+':'+this.data.name+' but it is not available');
    }
  }
}

module.exports = GoveeDevice;
