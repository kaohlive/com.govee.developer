'use strict';

const { Device } = require('homey');
const GoveeSharedDevice = require('./govee-shared-device');

class GoveeDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
  async setupDevice() {
    this.sharedDevice = new GoveeSharedDevice.SharedDevice();
    this.data = await this.getDeviceData();
    //Lets create any missing capability based on the capabilitiesList
    await this.sharedDevice.createDynamicCapabilities(this.data.model,this.data.mac,this.data.capabilitieslist,this);
    //await this.createDynamicCapabilities();
    await this.cleanOldCapabilities();
    //Now lets hook those capabilities to events
    await this.setupCapabilities();
    this.log('govee.device.'+this.data.model+': '+this.data.name+' of type '+this.goveedevicetype+' has been setup');
    //Give the device its correct state
    this.refreshState();
    //Lets connect the update sequence to keep track of the state
    this.start_update_loop();
  }

  async getDeviceData()
  {
    //Lets get the device data object
    let deviceData = this.getData();
    //Lets check what version of the device we are working with
    let deviceVersion = await this.getStoreValue('deviceVersion');
    if(deviceVersion==='v2'){
      deviceData.capabilitieslist=await this.getStoreValue('capabilityList');
      return deviceData;
    }
    //Then its the old device, we need to map the capabilities
    //Lets retreve the v2 capabilities of this device from the API
    var devicelist = await this.driver.api.deviceList();
    var thisdevice = devicelist.data.find(function(e) { return e.device === deviceData.mac })
    if(thisdevice!=null){
      this.log('Device '+deviceData.mac+' needs to be upgraded, retrieved its capabilities');
      console.log(JSON.stringify(thisdevice.capabilities));
      //Now make sure we store these, so we can consider the device upgraded
      this.setStoreValue('capabilityList',thisdevice.capabilities);
      this.setStoreValue('deviceVersion','v2');
      deviceData.capabilitieslist=thisdevice.capabilities;
      return deviceData;
    }
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
    this.log('govee.'+this.goveedevicetype+'.'+this.data.model+': '+this.data.name+' device state to be retrieved');
    this.driver.deviceState(this.data.model, this.data.mac, this.data.type).then(currentState => {
      console.log(JSON.stringify(currentState.capabilitieslist));

      //Lets refresh our dynamic capabilities
      this.sharedDevice.refreshDynamicCapabilities(currentState, this);

      //Now update the capabilities with the actual state
      if(this.hasCapability('alarm_online.'+this.goveedevicetype))
        {
          this.log('Processing the online state');
          var online = currentState.capabilitieslist.find(function(e) {return e.instance == "online" })
          this.setCapabilityValue('alarm_online.'+this.goveedevicetype,!online.state.value);
        }
      if (this.hasCapability('onoff'))
      {
        this.log('Processing the on off toggle state');
        var powerstate = currentState.capabilitieslist.find(function(e) { return e.instance == "powerSwitch" })
        if(powerstate.state.value) //should be a boolean value
          this.setCapabilityValue('onoff', true);
        else
          this.setCapabilityValue('onoff', false);
      }
      if (this.hasCapability('dim'))
      {
        this.log('Processing the dim level state');
        var brightness = currentState.capabilitieslist.find(function(e) { return e.instance == "brightness" })
        if (brightness.state.value > 100)
          this.setCapabilityValue('dim', (brightness.state.value/255)); //Seems to be a mismatch in documentation. It should be a range between 0 and 100
        else
          this.setCapabilityValue('dim', (brightness.state.value/100));
      }
      if (this.hasCapability('light_temperature'))
      {
        this.log('Processing the colorTemp state');
        var colorTempState = currentState.capabilitieslist.find(function(e) {return e.instance == "colorTemperatureK" })

        if(colorTempState.state.value!=0)
        {
          var colorTempOptions = this.data.capabilitieslist.find(function(e) {return e.instance == "colorTemperatureK" });
          let rangeMin = colorTempOptions.parameters.range.min;
          let rangeMax = colorTempOptions.parameters.range.max;
          let rangeTotal = rangeMax-rangeMin;
          this.log('colorTem: '+colorTempState.state.value+' - range[max:'+rangeMax+', min: '+rangeMin+', range: '+rangeTotal+']');
          var rangePerc = 1 - ((colorTempState.state.value-rangeMin)/rangeTotal);
          this.log('colorTem: '+colorTempState.state.value+' - range[max:'+rangeMax+', min: '+rangeMin+', range: '+rangeTotal+'] so perc is: '+rangePerc);
          if (rangePerc>1) rangePerc = 1; //Seems that sometimes this math ends up in a higher than 1 result, strange but without more data hard to locate.
          if(this.hasCapability('light_mode'))
            this.setCapabilityValue('light_mode', 'temperature'); //Tell homey we are in colorTemp mode
          this.setCapabilityValue('light_temperature', rangePerc);
        } else {
          this.log('no color temp known');
          if(this.hasCapability('light_mode'))
            this.setCapabilityValue('light_mode', 'color'); //Tell homey we are not in colorTemp mode
          this.setCapabilityValue('light_temperature', null);
        }
      }
      if(this.hasCapability('light_hue'))
      {
        this.log('Processing the colorRGB state');
        var colorRGB = currentState.capabilitieslist.find(function(e) { return e.instance == "colorRgb" })
        var colorTempOptions = currentState.capabilitieslist.find(function(e) {return e.instance == "colorTemperatureK" })
        if(colorTempOptions.state.value==0)
        {
          var colorHSV=this.driver.colorCommandGetParser(colorRGB.state.value);
          this.log(JSON.stringify(colorHSV))
          if(this.hasCapability('light_mode'))
            this.setCapabilityValue('light_mode', 'color'); //Tell homey we are in color mode
          this.setCapabilityValue('light_saturation', colorHSV.s);
          this.setCapabilityValue('light_hue', (colorHSV.h/360));
        }
        else {
          this.log('no color rgb known');
          if(this.hasCapability('light_mode'))
            this.setCapabilityValue('light_mode', 'temperature'); //Tell homey we are not in color mode
          this.setCapabilityValue('light_hue', null);
          this.setCapabilityValue('light_saturation', null);
        }
      }

      //The following are more appliance like capabilities
      if(this.hasCapability('mode'))
      {
        this.log('Processing the light mode state');
        var mode = currentState.capabilitieslist.find(function(e) {return e.instance == "lightScene" })
        if(mode!=null && mode!=undefined)
        {
          //How to read modes?
          //this.setCapabilityValue('mode', this.data.properties.mode);
        }
        else {
          //How to read modes?
          this.setCapabilityValue('mode', null);
        }
      }
      if(this.hasCapability('measure_temperature'))
      {
        this.log('Processing the temp sensor state');
        var temp = currentState.capabilitieslist.find(function(e) {return e.instance == "sensorTemperature" })
        var celc = (temp.state.value - 32) / 1.8;
        this.setCapabilityValue('measure_temperature',celc);
      }
      if(this.hasCapability('measure_humidity'))
        {
          this.log('Processing the humidity sensor state');
          var hum = currentState.capabilitieslist.find(function(e) {return e.instance == "sensorHumidity" })
          if (hum.state.value.currentHumidity === undefined) {
            console.log("currentHumidity was not received in the state: "+JSON.stringify(hum.state));
          } else {
            this.setCapabilityValue('measure_humidity',hum.state.value.currentHumidity);
          }
        }
    }).catch((err) => this.log('Error calling the state endpoint ['+JSON.stringify(err)+']'));
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   * That is a good moment to map the static device capabilties of Govee with the Homey capabilities
   */
  async onAdded() {
    this.log('govee.device.'+this.data.model+': '+this.data.name+' has been added');
    this.log('Lets connect capabilities:'+JSON.stringify(this.data.capabilitieslist));
    //Lets make the capabilities list more flexible, lets store it in the storevalues
    this.setStoreValue('capabilityList',this.data.capabilitieslist);
    this.setStoreValue('deviceVersion','v2');
    //Now create the capabilties based on the device
    if(!this.hasCapability('alarm_online.'+this.goveedevicetype))
      await this.addCapability('alarm_online.'+this.goveedevicetype);
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "powerSwitch" })) {
		  if(!this.hasCapability('onoff'))
			  await this.addCapability('onoff');
    } else if(this.hasCapability('onoff'))
      await this.removeCapability('onoff');  
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "brightness" })) {
      if(!this.hasCapability('dim'))
        await this.addCapability('dim'); 
    } else if(this.hasCapability('dim'))
      await this.removeCapability('dim');    
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "colorRgb" })) {
      if(!this.hasCapability('light_saturation'))
        await this.addCapability('light_saturation');    
      if(!this.hasCapability('light_hue'))
        await this.addCapability('light_hue');    
    } else {
      if(this.hasCapability('light_saturation'))
        await this.removeCapability('light_saturation');
      if(this.hasCapability('light_hue'))
        await this.removeCapability('light_hue'); 
    }

    if(this.data.capabilitieslist.find(function(e) {return e.instance == "colorTemperatureK" })) {
      if(!this.hasCapability('light_temperature'))
        await this.addCapability('light_temperature');
    } else if(this.hasCapability('light_temperature'))
      await this.removeCapability('light_temperature');  
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "colorRgb" }) && this.data.capabilitieslist.find(function(e) {return e.instance == "colorTemperatureK" })) {
      if(!this.hasCapability('light_mode'))
        await this.addCapability('light_mode');
    } else if(this.hasCapability('light_mode'))
      await this.removeCapability('light_mode');
      
    //These are more likely to be appliance capabilities
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "sensorTemperature" })) {
      if(!this.hasCapability('measure_temperature'))
        await this.addCapability('measure_temperature'); 
    } else if(this.hasCapability('measure_temperature'))
      await this.removeCapability('measure_temperature');
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "sensorHumidity" })) {
      if(!this.hasCapability('measure_humidity'))
        await this.addCapability('measure_humidity'); 
    } else if(this.hasCapability('measure_humidity'))
      await this.removeCapability('measure_humidity');    

    //Now we need to link our capbilities with the ones we left or added
    await this.setupCapabilities();
  }

  async cleanOldCapabilities()
  {
    if(this.hasCapability('segmentControlColor'))
      await this.removeCapability('segmentControlColor');
    if(this.hasCapability('segmentControlBrightness'))
      await this.removeCapability('segmentControlBrightness');
    if(this.hasCapability('dreamViewToggle'))
      await this.removeCapability('dreamViewToggle');
    if(this.hasCapability('lightScenes'))
      await this.removeCapability('lightScenes');
    if(this.hasCapability('lightDiyScenes'))
      await this.removeCapability('lightDiyScenes');
    if(this.hasCapability('snapshots'))
      await this.removeCapability('snapshots');
    if(this.hasCapability('musicMode'))
      await this.removeCapability('musicMode');
  }

  /**
   * Ensure we setup the listeners of the registered capabities.
   * Since we add capbilities based on the govee API this should create a full dynamic device
   */
  async setupCapabilities()
  {
    this.log('Now link capabilities with listeners');
    if (this.hasCapability('onoff'))
      this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    if (this.hasCapability('dreamViewToggle.'+this.goveedevicetype))
      this.registerCapabilityListener('dreamViewToggle.'+this.goveedevicetype, this.onCapabilityDreamview.bind(this));
    if (this.hasCapability('nightlightToggle.'+this.goveedevicetype))
      this.registerCapabilityListener('nightlightToggle.'+this.goveedevicetype, this.onCapabilityNightlight.bind(this));
    if (this.hasCapability('gradientToggle'))
      this.registerCapabilityListener('gradientToggle', this.onCapabilityGradient.bind(this));
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
    if (this.hasCapability('lightScenes.'+this.goveedevicetype))
      this.registerCapabilityListener('lightScenes.'+this.goveedevicetype, this.onCapabilityLightScenes.bind(this));
    if (this.hasCapability('lightDiyScenes.'+this.goveedevicetype))
      this.registerCapabilityListener('lightDiyScenes.'+this.goveedevicetype, this.onCapabilityDIYLightScenes.bind(this));
    if (this.hasCapability('nightlightScenes.'+this.goveedevicetype))
      this.registerCapabilityListener('nightlightScenes.'+this.goveedevicetype, this.onCapabilityNightlightScenes.bind(this));
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
      await this.driver.turn(1,this.data.model, this.data.mac, this.goveedevicetype);
    } else {
      await this.driver.turn(0,this.data.model, this.data.mac, this.goveedevicetype);
    }
    this.setIfHasCapability('onoff', value);
  }

  async onCapabilityDreamview( value, opts ) {
    if(value){
      await this.driver.toggle(1, 'dreamViewToggle', this.data.model, this.data.mac, this.goveedevicetype);
    } else {
      await this.driver.toggle(0, 'dreamViewToggle', this.data.model,this.data.mac, this.goveedevicetype);
    }
    this.setIfHasCapability('dreamViewToggle', value);
  }

  async onCapabilityNightlight( value, opts ) {
    if(value){
      await this.driver.toggle(1, 'nightlightToggle', this.data.model, this.data.mac, this.goveedevicetype);
    } else {
      await this.driver.toggle(0, 'nightlightToggle', this.data.model,this.data.mac, this.goveedevicetype);
    }
    this.setIfHasCapability('nightlightToggle', value);
  }

  async onCapabilityGradient( value, opts ) {
    if(value){
      await this.driver.toggle(1, 'gradientToggle', this.data.model, this.data.mac, this.goveedevicetype);
    } else {
      await this.driver.toggle(0, 'gradientToggle', this.data.model, this.data.mac, this.goveedevicetype);
    }
    this.setIfHasCapability('gradientToggle', value);
  }

  /**
   * Switches the device to a different light scene
   * @param {string} value the scene value of the device
   * @param {*} opts 
   */
    async onCapabilityLightScenes( value, opts ) {
      //We need to check if this device uses dynamic light scenes
      this.setWarning('Will switch to scene '+this.lightScenes.options[value].name);
      this.log('Mode switched to item '+value+' that results in scene '+JSON.stringify(this.lightScenes.options[value]));
      await this.driver.setLightScene(this.lightScenes.options[value].value, "lightScene", this.data.model, this.data.mac, this.goveedevicetype);
      this.unsetWarning();
    }
  
  /**
   * Switches the device to a different DIY light scene
   * @param {string} value the scene value of the device
   * @param {*} opts 
   */
      async onCapabilityDIYLightScenes( value, opts ) {
        this.setWarning('Will switch to diy scene '+this.diyScenes.options[value].name);
        this.log('Mode switched to item '+value+' that results in diy scene '+JSON.stringify(this.diyScenes.options[value]));
        await this.driver.setLightScene(this.diyScenes.options[value].value, "diyScene", this.data.model, this.data.mac, this.goveedevicetype);
        this.unsetWarning();
      }

  /**
   * Switches the device to a different nightlight scene
   * @param {string} value the scene value of the device
   * @param {*} opts 
   */
        async onCapabilityNightlightScenes( value, opts ) {
          this.setWarning('Will switch to nightlight scene '+this.nightlightScenes.options[value].name);
          this.log('Mode switched to item '+value+' that results in diy scene '+JSON.stringify(this.nightlightScenes.options[value]));
          await this.driver.setMode(this.nightlightScenes.options[value].value, "nightlightScene", this.data.model, this.data.mac, this.goveedevicetype);
          this.unsetWarning();
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
    this.log("Capability trigger: Hue & Saturation [hue:"+newValues.light_hue+" - saturation: "+newValues.light_saturation);
    let sat = newValues.light_saturation;
    let hue = newValues.light_hue;
    //Sometimes we do not get both values, in case of a set random color for example.
    if (sat==undefined) 
      return this.onCapabilityHue(hue);
    if(hue==undefined)
      return this.onCapabilitySaturation(sat);
    //Else we got both
    await this.driver.color(hue,sat,light,this.data.model, this.data.mac);
    this.setIfHasCapability('light_hue', hue);
    this.setIfHasCapability('light_saturation', sat);
  }

  /**
   * Sets the color temperature of the device
   * @param {number} value The color temperature in percentage of the range of the device
   * @param {*} opts 
   */
  async onCapabilityLightTemperature( value, opts ) {
    //If the capability colorTem is available, these properties should be also
    this.log("Capability trigger: Temperature: "+value);
    var colorTempOptions = this.data.capabilitieslist.find(function(e) {return e.instance == "colorTemperatureK" });
    let rangeMin = colorTempOptions.parameters.range.min;
    let rangeMax = colorTempOptions.parameters.range.max;
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
    // if(value=='temperature'){
    //   var colorTemp = this.getCapabilityValue('light_temperature');
    //   await this.onCapabilityLightTemperature(colorTemp);
    // } else if (value=='color'){
    //   var hue = this.getState().light_hue;  
    //   await this.onCapabilityHue(hue);
    // }
  }

  setIfHasCapability(cap, value) {
    if (this.hasCapability(cap)) {
      return this.setCapabilityValue(cap, value).catch(this.error)
    } 
    // else {
    //   this.log('Attempt to set cap ['+cap+'] on device '+this.data.model+':'+this.data.name+' but it is not available');
    // }
  }

}

module.exports = GoveeDevice;
