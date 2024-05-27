'use strict';

const { Device } = require('homey');

class GoveeDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
  async setupDevice() {
    this.data = await this.getDeviceData();
    //Lets create any missing capability based on the capabilitiesList
    await this.createDynamicCapabilities();
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
    //Lets retrive the v2 capabilities of this device from the API
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
    this.log('govee.device.'+this.data.model+': '+this.data.name+' device state to be retrieved');
    this.driver.deviceState(this.data.model, this.data.mac, this.data.type).then(currentState => {
      //console.log(JSON.stringify(currentState.capabilitieslist));
      //Now update the capabilities with the actual state
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

    //Now we need to link our capbilities with the ones we left or added
    await this.setupCapabilities();
  }

  async createDynamicCapabilities()
  {
    this.log('Start adding dynamic capabilities');
    //Add new feauters
    // if(this.data.capabilitieslist.find(function(e) { return e.instance == "gradientToggle" })) {
		//   if(!this.hasCapability('gradientToggle'))
		// 	  await this.addCapability('gradientToggle');
    // } else if(this.hasCapability('gradientToggle'))
    //   await this.removeCapability('gradientToggle');
    //Setup the segment color control capability, flow only
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "segmentedColorRgb" })) {
      if(!this.hasCapability('segmentControlColor'))
        await this.addCapability('segmentControlColor');
      this.segmentRGBParameters = this.data.capabilitieslist.find(function(e) {return e.instance == "segmentedColorRgb" }).parameters.fields;
      await this.setupFlowSegmentControlColor();
    } else if(this.hasCapability('segmentControlColor'))
      await this.removeCapability('segmentControlColor'); 
    //Setup the segment brightness control capability, flow only
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "segmentedBrightness" })) {
      if(!this.hasCapability('segmentControlBrightness'))
        await this.addCapability('segmentControlBrightness');
      this.segmentBrightnessParameters = this.data.capabilitieslist.find(function(e) {return e.instance == "segmentedBrightness" }).parameters.fields;
      await this.setupFlowSegmentControlBrightness();
    } else if(this.hasCapability('segmentControlBrightness'))
      await this.removeCapability('segmentControlBrightness'); 
    //Now setup the dreamview button
    if(this.data.capabilitieslist.find(function(e) { return e.instance == "dreamViewToggle" })) {
      if(!this.hasCapability('dreamViewToggle'))
        await this.addCapability('dreamViewToggle');
      await this.setupFlowDreamView();
    } else if(this.hasCapability('dreamViewToggle'))
      await this.removeCapability('dreamViewToggle'); 
    //Use the mode capability for Dynamic LightScenes
    if(this.data.capabilitieslist.find(function(e) {return e.instance == "lightScene" }))
    {
      if(!this.hasCapability('lightScenes')) {
        await this.addCapability('lightScenes');
      }
      if(this.hasCapability('lightScenes')) {
        this.log('Adding dynamic options to the light scenes capability');
        //Check if we use the dynamic version or the static ones
        this.lightScenes = null;
        let modeValues = this.data.capabilitieslist.find(function(e) {return e.instance == "lightScene" }).parameters;
        if(modeValues.options.length==0)
        {
          this.lightScenes=await this.driver.deviceLightModes(this.data.model, this.data.mac, this.data.type).then(device => {
            return device.capabilitieslist.find(function(e) {return e.instance == "lightScene" }).parameters;
          });
        } else {
          this.lightScenes=modeValues;
        }
        const modeOptions = {
          "type": "number",
          "title": {
            "en": "Light Scenes"
          },
          "getable": true,
          "setable": true,
          "uiComponent": "slider",
          "decimals": 0,
          "min": 0,
          "max": (this.lightScenes.options.length-1),
          "step": 1
        }
        //console.log(JSON.stringify(this.lightScenes))
        //console.log('Light scenes: '+JSON.stringify(modeOptions));
        if(this.lightScenes.options.length>0){
          //What if there are no lightscenes? then the control is going to give errors
          await this.setCapabilityOptions('lightScenes', modeOptions);
          //Register the flow actions
          this.log('Setup the flow for Light scene capability');
          await this.setupFlowSwitchLightScene(); 
        } else {
          await this.removeCapability('lightScenes'); 
        }
      }
    } else if(this.hasCapability('lightScenes'))
      await this.removeCapability('lightScenes');  
    //DIY scenes are the ones you can create yourself for the device
    if(this.data.capabilitieslist.find(function(e) {return e.instance == "diyScene" }))
    {
      if(!this.hasCapability('lightDiyScenes')) {
        await this.addCapability('lightDiyScenes');
      }
      if(this.hasCapability('lightDiyScenes')) {
        this.log('Adding dynamic options to the light scenes capability');
        //Check if we use the dynamic version or the static ones
        this.diyScenes = null;
        let modeValues = this.data.capabilitieslist.find(function(e) {return e.instance == "diyScene" }).parameters;
        if(modeValues.options.length==0)
        {
          this.diyScenes=await this.driver.deviceDiyLightModes(this.data.model, this.data.mac, this.data.type).then(device => {
            return device.capabilitieslist.find(function(e) {return e.instance == "diyScene" }).parameters;
          });
        } else {
          this.diyScenes=modeValues;
        }

        const modeOptions = {
          "type": "number",
          "title": {
            "en": "DIY Scenes"
          },
          "getable": true,
          "setable": true,
          "uiComponent": "slider",
          "decimals": 0,
          "min": 0,
          "max": (this.diyScenes.options.length-1),
          "step": 1
        }
        //console.log(JSON.stringify(this.diyScenes))
        //Now setup the slider
        //console.log('DIY Light scenes: '+JSON.stringify(modeOptions));
        if(this.diyScenes.options.length>0){
          await this.setCapabilityOptions('lightDiyScenes', modeOptions);
          //Register the flow actions
          this.log('Setup the flow for DIY scene capability');
          await this.setupFlowSwitchDiyScene();
        } else {
          await this.removeCapability('lightDiyScenes'); 
        }
      }
    } else if(this.hasCapability('lightDiyScenes'))
      await this.removeCapability('lightDiyScenes');
    //snapshots
    if(this.data.capabilitieslist.find(function(e) {return e.instance == "snapshot" }))
    {
      if(!this.hasCapability('snapshots')) {
        await this.addCapability('snapshots');
      }
      if(this.hasCapability('snapshots')) {
        this.log('Setting up snapshot capability');
        await this.setupFlowSnapshots();
      }
    } else if(this.hasCapability('snapshots'))
      await this.removeCapability('snapshots');
    //MusicMode
    if(this.data.capabilitieslist.find(function(e) {return e.instance == "musicMode" }))
      {
        if(!this.hasCapability('musicMode')) {
          await this.addCapability('musicMode');
        }
        if(this.hasCapability('musicMode')) {
          this.log('Setting up music mode capability');
          await this.setupFlowMusicMode();
        }
      } else if(this.hasCapability('musicMode'))
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
    if (this.hasCapability('dreamViewToggle'))
      this.registerCapabilityListener('dreamViewToggle', this.onCapabilityDreamview.bind(this));
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
    if (this.hasCapability('lightScenes'))
      this.registerCapabilityListener('lightScenes', this.onCapabilityLightScenes.bind(this));
    if (this.hasCapability('lightDiyScenes'))
      this.registerCapabilityListener('lightDiyScenes', this.onCapabilityDIYLightScenes.bind(this));
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

  //FLOWS SECTION
  async setupFlowDreamView() {
    this.log('Create the flow for the dream view capability');
    //Now setup the flow cards
    this._activateDreamview = await this.homey.flow.getActionCard('activate-dreamview'); 
    this._activateDreamview
      .registerRunListener(async (args, state) => {
        this.log('attempt to toggle dreamview: '+args.activate);
        this.setIfHasCapability('dreamViewToggle', args.activate);
        if(args.activate){
          return new Promise((resolve, reject) => {
            this.driver.toggle(1, 'dreamViewToggle', args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
          });
        } else {
          return new Promise((resolve, reject) => {
            this.driver.toggle(0, 'dreamViewToggle', args.device.data.model,args.device.data.mac, args.device.goveedevicetype).then(() => {
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
          });
        }
      });
  }

  createSegmentCollection(segmentField)
  {
    //Convert the segment max into a real array collection with objects.
    let segmentArray = Array.from(
      { length: segmentField.elementRange.max }, 
        (_, i) => i.toString() );
    //Clone this as base array
    let segmentRange = segmentArray.map((i) => ({
      value: i,
      name: "Segment "+i.toString()
    })) //Cloned
    //Add a joined element to easely select them all
    segmentRange.push({
      value: segmentArray.join(','),
      name: `All segments`
    });
    //Add the firt halve of the segments
    segmentRange.push({
      value: segmentArray.slice(0,Math.floor((segmentField.elementRange.max/2))).join(','),
      name: `First halve of segments`
    });
    //Add the last halve of the segments
    segmentRange.push({
      value: segmentArray.slice(Math.floor((segmentField.elementRange.max/2)),segmentField.elementRange.max).join(','),
      name: `Second halve of segments`
    });
    console.log(JSON.stringify(segmentRange));
    return segmentRange;
  }

  async setupFlowSegmentControlColor() {
    this.log('Create the flow for the Segment Color Control capability');
    //Now setup the flow cards
    this._setSegmentColor = await this.homey.flow.getActionCard('set-segment-color'); 
    this._setSegmentColor
      .registerRunListener(async (args, state) => {
        return new Promise((resolve, reject) => {
            let segmentArray=null;
            if(!args.segmentArray && !args.segmentNr)
              reject("Select either segment or enter a comma seperated segment nr list");
            if(args.segmentArray && args.segmentArray!==''  )
              segmentArray = args.segmentArray.split(',').map(Number);
            else
              segmentArray = args.segmentNr.value.split(',').map(Number);
            this.log('attempt to set a device segment ['+segmentArray+']: color '+args.segmentColor);
            this.driver.setSegmentColor(segmentArray, args.segmentColor, args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
        });
      });
      this._setSegmentColor
      .registerArgumentAutocompleteListener('segmentNr', async (query, args) => {
        this.log('attempt to list available segments with ['+query+']');
        //console.log('segmentParameters: '+JSON.stringify(args.device.segmentRGBParameters));
        let segmentRange = this.createSegmentCollection(args.device.segmentRGBParameters.find(function(e) {return e.fieldName == "segment" }));
        let filteredSegments = segmentRange.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        this.log(JSON.stringify(filteredSegments));
        return filteredSegments.map((segment) => {
          segment.formattedName = segment.name;
          return segment;
        });
      });
  }

  async setupFlowSegmentControlBrightness() {
    this.log('Create the flow for the Segment Brightness Control capability');
    //Now setup the flow cards
    this._setSegmentBrightness = await this.homey.flow.getActionCard('set-segment-brightness'); 
    this._setSegmentBrightness
      .registerRunListener(async (args, state) => {
        return new Promise((resolve, reject) => {
          let segmentArray=null;
          if(!args.segmentArray && !args.segmentNr)
            reject("Select either segment or enter a comma seperated segment nr list");
          if(args.segmentArray && args.segmentArray!==''  )
            segmentArray = args.segmentArray.split(',').map(Number);
          else
            segmentArray = args.segmentNr.value.split(',').map(Number);
          this.log('attempt to set a device segment ['+segmentArray+']: brightness '+args.segmentBrightness);
          this.driver.setSegmentBrightness(segmentArray, args.segmentBrightness, args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
      this._setSegmentBrightness
      .registerArgumentAutocompleteListener('segmentNr', async (query, args) => {
        this.log('attempt to list available segments with ['+query+']');
        console.log('segmentParameters: '+JSON.stringify(args.device.segmentBrightnessParameters));
        let segmentRange = this.createSegmentCollection(args.device.segmentBrightnessParameters.find(function(e) {return e.fieldName == "segment" }));
        let filteredSegments = segmentRange.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        this.log(JSON.stringify(filteredSegments));
        return filteredSegments.map((segment) => {
          segment.formattedName = segment.name;
          return segment;
        });
      });
  }

  async setupFlowSwitchLightScene() {
    this.log('Create the flow for the Light scene capability');
    //Now setup the flow cards
    this._switchLightScene = await this.homey.flow.getActionCard('switch-to-light-scene'); 
    this._switchLightScene
      .registerRunListener(async (args, state) => {
        this.log('attempt to switch to a Light Scene: '+args.lightScene);
        return new Promise((resolve, reject) => {
          this.log('now send the light scene capability command');
            this.driver.setLightScene(args.lightScene.value, "lightScene", args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
        });
      });
    this._switchLightScene
      .registerArgumentAutocompleteListener('lightScene', async (query, args) => {
        this.log('attempt to list available light scenes matching filter ['+query+']');
        let filteredScenes = args.device.lightScenes.options.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        this.log(JSON.stringify(filteredScenes));
        return filteredScenes.map((scene) => {
          scene.formattedName = scene.name;
          return scene;
        });
      });
  }

  async setupFlowSwitchDiyScene() {
    //console.log('Create the flow for the DIY Light scene capability');
    //Now setup the flow cards
    this._switchDiyLightScene = await this.homey.flow.getActionCard('switch-to-diy-light-scene'); 
    this._switchDiyLightScene
      .registerRunListener(async (args, state) => {
        this.log('attempt to switch to a DIY Light Scene: '+args.diyScene);
        return new Promise((resolve, reject) => {
          this.log('now send the DIY light scene capability command');
          this.driver.setLightScene(args.diyScene.value, "diyScene", args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
    this._switchDiyLightScene
      .registerArgumentAutocompleteListener('diyScene', async (query, args) => {
        this.log('attempt to list available DIY light scenes matching filter ['+query+']');
        let filteredScenes = args.device.diyScenes.options.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        this.log(JSON.stringify(filteredScenes));
        return filteredScenes.map((scene) => {
          scene.formattedName = scene.name;
          return scene;
        });
      });
  }

  async setupFlowSnapshots() {
    //console.log('Create the flow for the Snapshots capability');
    //Now setup the flow cards
    this._activateSnapshot = await this.homey.flow.getActionCard('activate-snapshot'); 
    this._activateSnapshot
      .registerRunListener(async (args, state) => {
        this.log('attempt to activate snapshot: '+args.snapshot);
        return new Promise((resolve, reject) => {
          this.log('now send the DIY light scene capability command');
          this.driver.setLightScene(args.snapshot.value, "snapshot", args.device.data.model, args.device.data.mac, this.goveedevicetype).then(() => {
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
    this._activateSnapshot
      .registerArgumentAutocompleteListener('snapshot', async (query, args) => {
        this.log('attempt to list available snapshots matching filter ['+query+']');
        var devicelist = await this.driver.api.deviceList();
        var thisdevice = devicelist.data.find(function(e) { return e.device === args.device.data.mac })
        console.log("device "+args.device.data.mac+"|"+JSON.stringify(thisdevice));
        let snaphotList = thisdevice.capabilities.find(function(e) { return e.instance === "snapshot" })
        let filteredSnapshots = snaphotList.parameters.options.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        this.log(JSON.stringify(filteredSnapshots));
        return filteredSnapshots.map((snapshot) => {
          snapshot.formattedName = snapshot.name;
          return snapshot;
        });
      });
  }

  async setupFlowMusicMode() {
    //console.log('Create the flow for the MusicMode capability');
    //Now setup the flow cards
    this._activateMusicMode = await this.homey.flow.getActionCard('activate-music-mode'); 
    this._activateMusicMode
      .registerRunListener(async (args, state) => {
        this.log('attempt to activate music mode: '+args.musicMode);
        return new Promise((resolve, reject) => {
          this.log('now send the music mode capability command');
          this.driver.setMusicMode(args.musicMode.value, args.sensitivity, args.device.data.model, args.device.data.mac).then(() => {
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
    this._activateMusicMode
      .registerArgumentAutocompleteListener('musicMode', async (query, args) => {
        this.log('attempt to list available musicModes matching filter ['+query+']');
        let musicModeCapa = args.device.data.capabilitieslist.find(function(e) { return e.instance == "musicMode" });
        let musicModes = musicModeCapa.parameters.fields.find(function(e) { return e.fieldName == "musicMode" });
        let filteredModes = musicModes.options.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        this.log(JSON.stringify(filteredModes));
        return filteredModes.map((musicModes) => {
          musicModes.formattedName = musicModes.name;
          return musicModes;
        });
      });
  }

}

module.exports = GoveeDevice;
