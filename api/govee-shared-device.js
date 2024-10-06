class GoveeSharedDeviceClient {
    constructor() {
    }

    async refreshDynamicCapabilities(currentState,device)
    {
      //nightlightToggle
      if(device.hasCapability('nightlightToggle.'+device.goveedevicetype))
        {
          device.log('Processing the nightlight state');
          var nightlight = currentState.capabilitieslist.find(function(e) {return e.instance == "nightlightToggle" })
          device.log(JSON.stringify(nightlight))
          device.setCapabilityValue('nightlightToggle.'+device.goveedevicetype, (nightlight.state.value == 1));
        }
    }

    async createDynamicCapabilities(model,mac,capabilitieslist,device)
    {
        let enhancedUI=null;
        if(await device.getSetting('ui_enhance')) enhancedUI="slider";
        device.log('Start adding dynamic cloud capabilities, scene components: '+enhancedUI);
        //Add new feauters
        //Setup the segment color control capability, flow only
        if(capabilitieslist.find(function(e) { return e.instance == "segmentedColorRgb" })) {
          if(!device.hasCapability('segmentControlColor.'+device.goveedevicetype))
            await device.addCapability('segmentControlColor.'+device.goveedevicetype);
          device.segmentRGBParameters = capabilitieslist.find(function(e) {return e.instance == "segmentedColorRgb" }).parameters.fields;
          await this.setupFlowSegmentControlColor(device);
        } else if(device.hasCapability('segmentControlColor.'+device.goveedevicetype))
          await device.removeCapability('segmentControlColor.'+device.goveedevicetype); 
        //Setup the segment brightness control capability, flow only
        if(capabilitieslist.find(function(e) { return e.instance == "segmentedBrightness" })) {
          if(!device.hasCapability('segmentControlBrightness.'+device.goveedevicetype))
            await device.addCapability('segmentControlBrightness.'+device.goveedevicetype);
          device.segmentBrightnessParameters = capabilitieslist.find(function(e) {return e.instance == "segmentedBrightness" }).parameters.fields;
          await this.setupFlowSegmentControlBrightness(device);
        } else if(device.hasCapability('segmentControlBrightness.'+device.goveedevicetype))
          await device.removeCapability('segmentControlBrightness.'+device.goveedevicetype); 
        //Now setup the NightLight button
        if(capabilitieslist.find(function(e) { return e.instance == "nightlightToggle" })) {
          if(!device.hasCapability('nightlightToggle.'+device.goveedevicetype))
            await device.addCapability('nightlightToggle.'+device.goveedevicetype);
          await this.setupFlowNightLight(device);
        } else if(device.hasCapability('nightlightToggle.'+device.goveedevicetype))
          await device.removeCapability('nightlightToggle.'+device.goveedevicetype); 
        //Now setup the dreamview button
        if(capabilitieslist.find(function(e) { return e.instance == "dreamViewToggle" })) {
          if(!device.hasCapability('dreamViewToggle.'+device.goveedevicetype))
            await device.addCapability('dreamViewToggle.'+device.goveedevicetype);
          await this.setupFlowDreamView(device);
        } else if(device.hasCapability('dreamViewToggle.'+device.goveedevicetype))
          await device.removeCapability('dreamViewToggle.'+device.goveedevicetype); 
        //Use the mode capability for Dynamic LightScenes
        if(capabilitieslist.find(function(e) {return e.instance == "lightScene" }))
        {
          if(!device.hasCapability('lightScenes.'+device.goveedevicetype)) {
            await device.addCapability('lightScenes.'+device.goveedevicetype);
          }
          if(device.hasCapability('lightScenes.'+device.goveedevicetype)) {
            device.log('Adding dynamic options to the light scenes capability');
            //Check if we use the dynamic version or the static ones
            device.lightScenes = null;
            let modeValues = capabilitieslist.find(function(e) {return e.instance == "lightScene" }).parameters;
            if(modeValues.options.length==0)
            {
              device.lightScenes=await device.driver.deviceLightModes(model, mac, device.goveedevicetype).then(device => {
              return device.capabilitieslist.find(function(e) {return e.instance == "lightScene" }).parameters;
            });
            } else {
            device.lightScenes=modeValues;
            }
            const modeOptions = {
            "type": "number",
            "title": {
                "en": "Light Scenes"
            },
            "getable": true,
            "setable": true,
            "uiComponent": enhancedUI,
            "decimals": 0,
            "min": 0,
            "max": (device.lightScenes.options.length-1),
            "step": 1
            }
            //console.log(JSON.stringify(device.lightScenes))
            //console.log('Light scenes: '+JSON.stringify(modeOptions));
            if(device.lightScenes.options.length>0){
              //What if there are no lightscenes? then the control is going to give errors
              await device.setCapabilityOptions('lightScenes.'+device.goveedevicetype, modeOptions);
              //Register the flow actions
              device.log('Setup the flow for Light scene capability');
              await this.setupFlowSwitchLightScene(device); 
            } else {
              await device.removeCapability('lightScenes.'+device.goveedevicetype); 
            }
          }
        } else if(device.hasCapability('lightScenes.'+device.goveedevicetype))
          await device.removeCapability('lightScenes.'+device.goveedevicetype);  
        //DIY scenes are the ones you can create yourself for the device
        if(capabilitieslist.find(function(e) {return e.instance == "diyScene" }))
        {
          if(!device.hasCapability('lightDiyScenes.'+device.goveedevicetype)) {
            await device.addCapability('lightDiyScenes.'+device.goveedevicetype);
          }
          if(device.hasCapability('lightDiyScenes.'+device.goveedevicetype)) {
            device.log('Adding dynamic options to the light scenes capability');
            //Check if we use the dynamic version or the static ones
            device.diyScenes = null;
            let modeValues = capabilitieslist.find(function(e) {return e.instance == "diyScene" }).parameters;
            if(modeValues.options.length==0)
            {
              device.diyScenes=await device.driver.deviceDiyLightModes(model, mac, device.goveedevicetype).then(device => {
              return device.capabilitieslist.find(function(e) {return e.instance == "diyScene" }).parameters;
            });
            } else {
              device.diyScenes=modeValues;
            }
            const modeOptions = {
            "type": "number",
            "title": {
                "en": "DIY Scenes"
            },
            "getable": true,
            "setable": true,
            "uiComponent": enhancedUI,
            "decimals": 0,
            "min": 0,
            "max": (device.diyScenes.options.length-1),
            "step": 1
            }
            //console.log(JSON.stringify(device.diyScenes))
            //Now setup the slider
            //console.log('DIY Light scenes: '+JSON.stringify(modeOptions));
            if(device.diyScenes.options.length>0){
              await device.setCapabilityOptions('lightDiyScenes.'+device.goveedevicetype, modeOptions);
              //Register the flow actions
              device.log('Setup the flow for DIY scene capability');
              await this.setupFlowSwitchDiyScene(device);
            } else {
              await device.removeCapability('lightDiyScenes.'+device.goveedevicetype); 
            }
          }
        } else if(device.hasCapability('lightDiyScenes.'+device.goveedevicetype))
          await device.removeCapability('lightDiyScenes.'+device.goveedevicetype);
        //Use the mode capability for nightLightScenes
        if(capabilitieslist.find(function(e) {return e.instance == "nightlightScene" }))
          {
            if(!device.hasCapability('nightlightScenes.'+device.goveedevicetype)) {
              await device.addCapability('nightlightScenes.'+device.goveedevicetype);
            }
            if(device.hasCapability('nightlightScenes.'+device.goveedevicetype)) {
              device.log('Adding dynamic options to the nightlight scenes capability');
              //Check if we use the dynamic version or the static ones
              device.nightlightScenes = null;
              let modeValues = capabilitieslist.find(function(e) {return e.instance == "nightlightScene" }).parameters;
              if(modeValues.options.length==0)
              {
                device.nightlightScenes=await device.driver.deviceLightModes(model, mac, device.goveedevicetype).then(device => {
                return device.capabilitieslist.find(function(e) {return e.instance == "nightlightScene" }).parameters;
              });
              } else {
                device.nightlightScenes=modeValues;
              }
              const modeOptions = {
              "type": "number",
              "title": {
                  "en": "Light Scenes"
              },
              "getable": true,
              "setable": true,
              "uiComponent": enhancedUI,
              "decimals": 0,
              "min": 0,
              "max": (device.nightlightScenes.options.length-1),
              "step": 1
              }
              //console.log(JSON.stringify(device.nightlightScenes))
              //console.log('Light scenes: '+JSON.stringify(modeOptions));
              if(device.nightlightScenes.options.length>0){
                //What if there are no lightscenes? then the control is going to give errors
                await device.setCapabilityOptions('nightlightScenes.'+device.goveedevicetype, modeOptions);
                //Register the flow actions
                device.log('Setup the flow for Light scene capability');
                await this.setupFlowSwitchNightlightScene(device); 
              } else {
                await device.removeCapability('nightlightScenes.'+device.goveedevicetype); 
              }
            }
          } else if(device.hasCapability('nightlightScenes.'+device.goveedevicetype))
            await device.removeCapability('nightlightScenes.'+device.goveedevicetype); 
        //snapshots
        if(capabilitieslist.find(function(e) {return e.instance == "snapshot" }))
        {
          if(!device.hasCapability('snapshots.'+device.goveedevicetype)) {
              await device.addCapability('snapshots.'+device.goveedevicetype);
          }
          if(device.hasCapability('snapshots.'+device.goveedevicetype)) {
              device.log('Setting up snapshot capability');
              await this.setupFlowSnapshots(device);
          }
        } else if(device.hasCapability('snapshots.'+device.goveedevicetype))
          await device.removeCapability('snapshots.'+device.goveedevicetype);
        //MusicMode
        if(capabilitieslist.find(function(e) {return e.instance == "musicMode" }))
        {
          if(!device.hasCapability('musicMode.'+device.goveedevicetype)) {
            await device.addCapability('musicMode.'+device.goveedevicetype);
          }
          if(device.hasCapability('musicMode.'+device.goveedevicetype)) {
            device.log('Setting up music mode capability');
            await this.setupFlowMusicMode(device);
          }
        } else if(device.hasCapability('musicMode.'+device.goveedevicetype))
          await device.removeCapability('musicMode.'+device.goveedevicetype);
        //workMode
        if(capabilitieslist.find(function(e) {return e.instance == "workMode" }))
        {
          if(!device.hasCapability('workMode.'+device.goveedevicetype)) {
            await device.addCapability('workMode.'+device.goveedevicetype);
          }
          if(device.hasCapability('workMode.'+device.goveedevicetype)) {
            device.log('Setting up work mode capability');
            await this.setupFlowWorkMode(device);
          }
        } else if(device.hasCapability('workMode.'+device.goveedevicetype))
          await device.removeCapability('workMode.'+device.goveedevicetype);

        //Check if the device supports events //devices.capabilities.event
        if(capabilitieslist.find(function(e) {return e.type == "devices.capabilities.event" }))
        {
          //Ensure the mqtt receiver has been setup.
          device.log('Device supports events, connect the MQTT broker.');
          await device.homey.app.setupMqttReceiver();
          //We are going to emit the recieved mqtt events, so lets subscribe to them
          device.log('Registering device ['+device.data.mac+'] to the eventHub to receive mqtt messages');
          device.homey.app.eventBus.on('device_event_'+device.data.mac, (message) => {
            // Check if the message is targetting this device
            device.log('Received an event from the mqtt, start processing it.')
            this.processReceivedDeviceEvent(device,message);
          });

          //Now hook the Flow event to the events the device supports
          if(capabilitieslist.find(function(e) {return e.instance == "lackWaterEvent" }))
          {
            if(!device.hasCapability('lackWater.'+device.goveedevicetype)) {
              await device.addCapability('lackWater.'+device.goveedevicetype);
            }
            if(device.hasCapability('lackWater.'+device.goveedevicetype)) {
              device.log('Setting up lack water event capability');
              await this.setupFlowLackWater(device);
            }
          } else if(device.hasCapability('lackWater.'+device.goveedevicetype))
            await device.removeCapability('lackWater.'+device.goveedevicetype);
          if(capabilitieslist.find(function(e) {return e.instance == "bodyAppearedEvent" }))
            {
              if(!device.hasCapability('bodyAppeared.'+device.goveedevicetype)) {
                await device.addCapability('bodyAppeared.'+device.goveedevicetype);
              }
              if(device.hasCapability('bodyAppeared.'+device.goveedevicetype)) {
                device.log('Setting up body appeared capability');
                await this.setupFlowBodyAppeared(device);
              }
            } else if(device.hasCapability('bodyAppeared.'+device.goveedevicetype))
              await device.removeCapability('bodyAppeared.'+device.goveedevicetype);
        }
    }

    async processReceivedDeviceEvent(device, message)
    {
      device.log(JSON.stringify(message));
      //Trigger the When flow cards as a result
      if(message.capabilities.find(function(e) {return e.instance == "bodyAppearedEvent" }))
      {
        let tokenStates = message.capabilities.find(function(e) {return e.instance == "bodyAppearedEvent" }).state;
        let tokens = {
          presence:tokenStates.find(function(e) {return e.name == "Presence" }).value
        }
        device._bodyAppearedTrigger.trigger(device, tokens, {})
          .then(this.log)
          .catch(this.error);
      }
      if(message.capabilities.find(function(e) {return e.instance == "lackWaterEvent" }))
        {
          let tokenStates = message.capabilities.find(function(e) {return e.instance == "lackWaterEvent" }).state;
          let tokens = {
            lack:tokenStates.find(function(e) {return e.name == "lack" }).value,
            message:tokenStates.find(function(e) {return e.name == "lack" }).message
          }
          device._lackWaterTrigger.trigger(device, tokens, {})
            .then(this.log)
            .catch(this.error);
        }
    }

    async setupFlowSwitchLightScene(device) {
        device.log('Create the flow for the Light scene capability');
        //Now setup the flow cards
        device._switchLightScene = await device.homey.flow.getActionCard('switch-to-light-scene.'+device.goveedevicetype); 
        device._switchLightScene
          .registerRunListener(async (args, state) => {
            device.log('attempt to switch to a Light Scene: '+args.lightScene);
            return new Promise((resolve, reject) => {
                device.log('now send the light scene capability command');
                device.driver.setLightScene(args.lightScene.value, "lightScene", args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
                  const sceneIndex = args.device.lightScenes.options.findIndex((obj) => obj.value.id === args.lightScene.value.id);
                  //console.log('Scene selected index: '+sceneIndex);
                  args.device.setIfHasCapability('onoff', true);
                  args.device.setCapabilityValue('lightScenes.'+device.goveedevicetype, sceneIndex);
                  args.device.setIfHasCapability('nightlightScene.'+device.goveedevicetype, null);
                  args.device.setIfHasCapability('lightDiyScenes.'+device.goveedevicetype, null);
                  resolve(true);
                }, (_error) => {
                  reject(_error);
                });
            });
          });
          device._switchLightScene
          .registerArgumentAutocompleteListener('lightScene', async (query, args) => {
            device.log('attempt to list available light scenes matching filter ['+query+']');
            let filteredScenes = args.device.lightScenes.options.filter(function(e) { 
              return e.name.toLowerCase().includes(query.toLowerCase()) 
            });
            device.log(JSON.stringify(filteredScenes));
            return filteredScenes.map((scene) => {
              scene.formattedName = scene.name;
              return scene;
            });
          });
          device._switchRandomLightScene = await device.homey.flow.getActionCard('switch-to-random-light-scene.'+device.goveedevicetype); 
          device._switchRandomLightScene
            .registerRunListener(async (args, state) => {
              device.log('collection length '+args.device.lightScenes.options.length+'- Random nr: '+Math.random())
              let randomIndex = Math.floor(Math.random() * args.device.lightScenes.options.length);
              let randomScene = args.device.lightScenes.options[randomIndex];
              device.log('attempt to switch to a random Light Scene on index ('+randomIndex+'): '+randomScene);
              return new Promise((resolve, reject) => {
                  device.log('now send the light scene capability command');
                  device.driver.setLightScene(randomScene.value, "lightScene", args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
                    args.device.setCapabilityValue('lightScenes.'+device.goveedevicetype, randomIndex);
                    resolve(true);
                  }, (_error) => {
                    reject(_error);
                  });
              });
            });
          device._compareLightScene = await device.homey.flow.getConditionCard('lightscene-active.'+device.goveedevicetype); 
          device._compareLightScene
            .registerRunListener(async (args, state) => {
              device.log('attempt to check if Light Scene is active: '+args.lightScene);
                return new Promise((resolve, reject) => {
                  const activeScene=args.device.getCapabilityValue('lightScenes.'+device.goveedevicetype);
                  const sceneIndex= args.device.lightScenes.options.findIndex((obj) => obj.value.id === args.lightScene.value.id);
                  device.log('Compare active index '+activeScene+' with picked index '+sceneIndex);
                  resolve(activeScene==sceneIndex);
                });
              });
            device._compareLightScene
            .registerArgumentAutocompleteListener('lightScene', async (query, args) => {
              device.log('attempt to list available light scenes matching filter ['+query+']');
              let filteredScenes = args.device.lightScenes.options.filter(function(e) { 
                return e.name.toLowerCase().includes(query.toLowerCase()) 
              });
              device.log(JSON.stringify(filteredScenes));
              return filteredScenes.map((scene) => {
                scene.formattedName = scene.name;
                return scene;
              });
            });
    }

    async setupFlowSwitchNightlightScene(device) {
      device.log('Create the flow for the Nightlight scene capability');
      //Now setup the flow cards
      device._switchNightlightScene = await device.homey.flow.getActionCard('switch-to-nightlight-scene.'+device.goveedevicetype); 
      device._switchNightlightScene
        .registerRunListener(async (args, state) => {
          device.log('attempt to switch to a Nightlight Scene: '+args.nightlightScene);
          return new Promise((resolve, reject) => {
              device.log('now send the nightlight scene capability command');
              device.driver.setMode(args.nightlightScene.value, "nightlightScene", args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
                const sceneIndex = args.device.nightlightScenes.options.findIndex((obj) => obj.value.id === args.nightlightScene.value.id);
                args.device.setCapabilityValue('nightlightScene.'+device.goveedevicetype, sceneIndex);
                args.device.setIfHasCapability('lightScenes.'+device.goveedevicetype, null);
                args.device.setIfHasCapability('lightDiyScenes.'+device.goveedevicetype, null);
                resolve(true);
              }, (_error) => {
                reject(_error);
              });
          });
        });
        device._switchNightlightScene
        .registerArgumentAutocompleteListener('nightlightScene', async (query, args) => {
          device.log('attempt to list available light scenes matching filter ['+query+']');
          let filteredScenes = args.device.nightlightScenes.options.filter(function(e) { 
            return e.name.toLowerCase().includes(query.toLowerCase()) 
          });
          device.log(JSON.stringify(filteredScenes));
          return filteredScenes.map((scene) => {
            scene.formattedName = scene.name;
            return scene;
          });
        });
        device._switchRandomNightlightScene = await device.homey.flow.getActionCard('switch-to-random-nightlight-scene.'+device.goveedevicetype); 
        device._switchRandomNightlightScene
          .registerRunListener(async (args, state) => {
            device.log('collection length '+args.device.nightlightScenes.options.length+'- Random nr: '+Math.random())
            let randomIndex = Math.floor(Math.random() * args.device.nightlightScenes.options.length);
            let randomScene = args.device.nightlightScenes.options[randomIndex];
            device.log('attempt to switch to a random Nightlight Scene on index ('+randomIndex+'): '+randomScene);
            return new Promise((resolve, reject) => {
                device.log('now send the nightlight scene capability command');
                device.driver.setMode(randomScene.value, "nightlightScene", args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
                  args.device.setCapabilityValue('nightlightScene.'+device.goveedevicetype, randomIndex);
                  resolve(true);
                }, (_error) => {
                  reject(_error);
                });
            });
          });
        device._compareNightlightScene = await device.homey.flow.getConditionCard('nightlightscene-active.'+device.goveedevicetype); 
        device._compareNightlightScene
          .registerRunListener(async (args, state) => {
            device.log('attempt to check if Nightlight Scene is active: '+args.nightlightScene);
              return new Promise((resolve, reject) => {
                let activeScene=args.device.getCapabilityValue('nightlightScenes.'+device.goveedevicetype);
                const sceneIndex = args.device.nightlightScenes.options.findIndex((obj) => obj.value.id === args.nightlightScene.value.id);
                resolve(activeScene==sceneIndex);
              });
            });
          device._compareNightlightScene
          .registerArgumentAutocompleteListener('nightlightScene', async (query, args) => {
            device.log('attempt to list available nightlight scenes matching filter ['+query+']');
            let filteredScenes = args.device.nightlightScenes.options.filter(function(e) { 
              return e.name.toLowerCase().includes(query.toLowerCase()) 
            });
            device.log(JSON.stringify(filteredScenes));
            return filteredScenes.map((scene) => {
              scene.formattedName = scene.name;
              return scene;
            });
          });
  }

async setupFlowLackWater(device)
{
  device.log('Create the flow for the lack water event capability');
  device._lackWaterTrigger = device.homey.flow.getDeviceTriggerCard('event_lackWater.'+device.goveedevicetype);
}

async setupFlowBodyAppeared(device)
{
  device.log('Create the flow for the body appeared event capability');
  device._bodyAppearedTrigger = device.homey.flow.getDeviceTriggerCard('event_bodyAppearedEvent.'+device.goveedevicetype);
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
    //Add an empty slot
    segmentRange.push({
      value: null,
      name: `Use segment list`
    });
    console.log(JSON.stringify(segmentRange));
    return segmentRange;
  }

  async setupFlowSegmentControlColor(device) {
    device.log('Create the flow for the Segment Color Control capability');
    //Now setup the flow cards
    device._setSegmentColor = await device.homey.flow.getActionCard('set-segment-color.'+device.goveedevicetype); 
    device._setSegmentColor
      .registerRunListener(async (args, state) => {
        return new Promise((resolve, reject) => {
            let segmentArray=null;
            device.log('Started action with '+JSON.stringify(args.segmentArray)+'-'+JSON.stringify(args.segmentNr));
            if(!args.segmentArray && !(args.segmentNr && args.segmentNr.value!=null))
              reject("Select either segment or enter a comma seperated segment nr list");
            if((args.segmentArray && args.segmentArray!=='') && (args.segmentNr && args.segmentNr.value!=null))
              reject("Select either segment or enter a comma seperated segment nr list, dont use both");
            if(args.segmentArray && args.segmentArray!==''  )
              segmentArray = args.segmentArray.split(',').map(Number);
            else
              segmentArray = args.segmentNr.value.split(',').map(Number);
              device.log('attempt to set a device segment ['+segmentArray+']: color '+args.segmentColor);
              device.driver.setSegmentColor(segmentArray, args.segmentColor, args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
        });
      });
      device._setSegmentColor
      .registerArgumentAutocompleteListener('segmentNr', async (query, args) => {
        device.log('attempt to list available segments with ['+query+']');
        //console.log('segmentParameters: '+JSON.stringify(args.device.segmentRGBParameters));
        let segmentRange = this.createSegmentCollection(args.device.segmentRGBParameters.find(function(e) {return e.fieldName == "segment" }));
        let filteredSegments = segmentRange.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        device.log(JSON.stringify(filteredSegments));
        return filteredSegments.map((segment) => {
          segment.formattedName = segment.name;
          return segment;
        });
      });
  }

  async setupFlowSegmentControlBrightness(device) {
    device.log('Create the flow for the Segment Brightness Control capability');
    //Now setup the flow cards
    device._setSegmentBrightness = await device.homey.flow.getActionCard('set-segment-brightness.'+device.goveedevicetype); 
    device._setSegmentBrightness
      .registerRunListener(async (args, state) => {
        return new Promise((resolve, reject) => {
          let segmentArray=null;
          device.log('Started action with '+JSON.stringify(args.segmentArray)+'-'+JSON.stringify(args.segmentNr));
          if(!args.segmentArray && !(args.segmentNr && args.segmentNr.value!=null))
            reject("Select either segment or enter a comma seperated segment nr list");
          if((args.segmentArray && args.segmentArray!=='') && (args.segmentNr && args.segmentNr.value!=null))
            reject("Select either segment or enter a comma seperated segment nr list, dont use both");
          if(args.segmentArray && args.segmentArray!==''  )
            segmentArray = args.segmentArray.split(',').map(Number);
          else
            segmentArray = args.segmentNr.value.split(',').map(Number);
            device.log('attempt to set a device segment ['+segmentArray+']: brightness '+args.segmentBrightness);
            device.driver.setSegmentBrightness(segmentArray, args.segmentBrightness, args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
      device._setSegmentBrightness
      .registerArgumentAutocompleteListener('segmentNr', async (query, args) => {
        device.log('attempt to list available segments with ['+query+']');
        console.log('segmentParameters: '+JSON.stringify(args.device.segmentBrightnessParameters));
        let segmentRange = this.createSegmentCollection(args.device.segmentBrightnessParameters.find(function(e) {return e.fieldName == "segment" }));
        let filteredSegments = segmentRange.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        device.log(JSON.stringify(filteredSegments));
        return filteredSegments.map((segment) => {
          segment.formattedName = segment.name;
          return segment;
        });
      });
  }

  async setupFlowDreamView(device) {
    device.log('Create the flow for the dream view capability');
    //Now setup the flow cards
    device._activateDreamview = await device.homey.flow.getActionCard('activate-dreamview.'+device.goveedevicetype); 
    device._activateDreamview
      .registerRunListener(async (args, state) => {
        device.log('attempt to toggle dreamview: '+args.activate);
        device.setIfHasCapability('dreamViewToggle', args.activate);
        if(args.activate){
          return new Promise((resolve, reject) => {
            device.driver.toggle(1, 'dreamViewToggle', args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
              args.device.setCapabilityValue('dreamViewToggle.'+device.goveedevicetype, true);
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
          });
        } else {
          return new Promise((resolve, reject) => {
            device.driver.toggle(0, 'dreamViewToggle', args.device.data.model,args.device.data.mac, args.device.goveedevicetype).then(() => {
              args.device.setCapabilityValue('dreamViewToggle.'+device.goveedevicetype, false);
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
          });
        }
      });
  }

  async setupFlowNightLight(device) {
    device.log('Create the flow for the nightlight capability');
    //Now setup the flow cards
    device._activateNightlight = await device.homey.flow.getActionCard('activate-nightlight.'+device.goveedevicetype); 
    device._activateNightlight
      .registerRunListener(async (args, state) => {
        device.log('attempt to toggle nightlight: '+args.activate);
        device.setIfHasCapability('nightlightToggle', args.activate);
        if(args.activate){
          return new Promise((resolve, reject) => {
            device.driver.toggle(1, 'nightlightToggle', args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
          });
        } else {
          return new Promise((resolve, reject) => {
            device.driver.toggle(0, 'nightlightToggle', args.device.data.model,args.device.data.mac, args.device.goveedevicetype).then(() => {
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
          });
        }
      });
  }

  async setupFlowSwitchDiyScene(device) {
    //console.log('Create the flow for the DIY Light scene capability');
    //Now setup the flow cards
    device._switchDiyLightScene = await device.homey.flow.getActionCard('switch-to-diy-light-scene.'+device.goveedevicetype); 
    device._switchDiyLightScene
      .registerRunListener(async (args, state) => {
        device.log('attempt to switch to a DIY Light Scene: '+args.diyScene);
        return new Promise((resolve, reject) => {
            device.log('now send the DIY light scene capability command');
            device.driver.setLightScene(args.diyScene.value, "diyScene", args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
            const sceneIndex = args.device.diyScenes.options.findIndex((obj) => obj.value === args.diyScene.value);
            args.device.setIfHasCapability('onoff', true);
            args.device.setCapabilityValue('lightDiyScenes.'+device.goveedevicetype, sceneIndex);
            args.device.setIfHasCapability('lightScenes.'+device.goveedevicetype, null);
            args.device.setIfHasCapability('nightlightScene.'+device.goveedevicetype, null);
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
      device._switchDiyLightScene
      .registerArgumentAutocompleteListener('diyScene', async (query, args) => {
        device.log('attempt to list available DIY light scenes matching filter ['+query+']');
        let filteredScenes = args.device.diyScenes.options.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        device.log(JSON.stringify(filteredScenes));
        return filteredScenes.map((scene) => {
          scene.formattedName = scene.name;
          return scene;
        });
      });
      device._switchRandomDiyLightScene = await device.homey.flow.getActionCard('switch-to-random-diy-light-scene.'+device.goveedevicetype); 
          device._switchRandomDiyLightScene
            .registerRunListener(async (args, state) => {
              device.log('collection length '+args.device.diyScenes.options.length+'- Random nr: '+Math.random())
              let randomIndex = Math.floor(Math.random() * args.device.diyScenes.options.length);
              let randomScene = args.device.diyScenes.options[randomIndex];
              device.log('attempt to switch to a random Diy Light Scene on index ('+randomIndex+'): '+randomScene);
              return new Promise((resolve, reject) => {
                  device.log('now send the light scene capability command');
                  device.driver.setLightScene(randomScene.value, "diyScene", args.device.data.model, args.device.data.mac, args.device.goveedevicetype).then(() => {
                    args.device.setCapabilityValue('lightDiyScenes.'+device.goveedevicetype, randomIndex);
                    resolve(true);
                  }, (_error) => {
                    reject(_error);
                  });
              });
            });
      device._compareDiyLightScene = await device.homey.flow.getConditionCard('lightDiyscene-active.'+device.goveedevicetype); 
      device._compareDiyLightScene
        .registerRunListener(async (args, state) => {
          device.log('attempt to switch to a DIY Light Scene: '+args.diyScene);
            return new Promise((resolve, reject) => {
              let activeScene=args.device.getCapabilityValue('lightDiyScenes.'+device.goveedevicetype);
              const sceneIndex = args.device.diyScenes.options.findIndex((obj) => obj.value === args.diyScene.value);
              resolve(activeScene==sceneIndex);
            });
          });
        device._compareDiyLightScene
        .registerArgumentAutocompleteListener('diyScene', async (query, args) => {
          device.log('attempt to list available DIY light scenes matching filter ['+query+']');
          let filteredScenes = args.device.diyScenes.options.filter(function(e) { 
            return e.name.toLowerCase().includes(query.toLowerCase()) 
          });
          device.log(JSON.stringify(filteredScenes));
          return filteredScenes.map((scene) => {
            scene.formattedName = scene.name;
            return scene;
          });
        });
  }

  async setupFlowSnapshots(device) {
    //console.log('Create the flow for the Snapshots capability');
    //Now setup the flow cards
    device._activateSnapshot = await device.homey.flow.getActionCard('activate-snapshot.'+device.goveedevicetype); 
    device._activateSnapshot
      .registerRunListener(async (args, state) => {
        device.log('attempt to activate snapshot: '+args.snapshot);
        return new Promise((resolve, reject) => {
            device.log('now send the DIY light scene capability command');
            device.driver.setLightScene(args.snapshot.value, "snapshot", args.device.data.model, args.device.data.mac, device.goveedevicetype).then(() => {
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
      device._activateSnapshot
      .registerArgumentAutocompleteListener('snapshot', async (query, args) => {
        device.log('attempt to list available snapshots matching filter ['+query+']');
        var devicelist = await args.device.driver.coudapi.deviceList();
        var thisdevice = devicelist.data.find(function(e) { return e.device === args.device.data.mac })
        console.log("device "+args.device.data.mac+"|"+JSON.stringify(thisdevice));
        let snaphotList = thisdevice.capabilities.find(function(e) { return e.instance === "snapshot" })
        let filteredSnapshots = snaphotList.parameters.options.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        device.log(JSON.stringify(filteredSnapshots));
        return filteredSnapshots.map((snapshot) => {
          snapshot.formattedName = snapshot.name;
          return snapshot;
        });
      });
  }

  async setupFlowMusicMode(device) {
    //console.log('Create the flow for the MusicMode capability');
    //Now setup the flow cards
    device._activateMusicMode = await device.homey.flow.getActionCard('activate-music-mode.'+device.goveedevicetype); 
    device._activateMusicMode
      .registerRunListener(async (args, state) => {
        device.log('attempt to activate music mode: '+args.musicMode);
        return new Promise((resolve, reject) => {
            device.log('now send the music mode capability command');
            device.driver.setMusicMode(args.musicMode.value, args.sensitivity, args.device.data.model, args.device.data.mac).then(() => {
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
      device._activateMusicMode
      .registerArgumentAutocompleteListener('musicMode', async (query, args) => {
        device.log('attempt to list available musicModes matching filter ['+query+']');
        let musicModeCapa = args.device.data.capabilitieslist.find(function(e) { return e.instance == "musicMode" });
        let musicModes = musicModeCapa.parameters.fields.find(function(e) { return e.fieldName == "musicMode" });
        let filteredModes = musicModes.options.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        device.log(JSON.stringify(filteredModes));
        return filteredModes.map((musicModes) => {
          musicModes.formattedName = musicModes.name;
          return musicModes;
        });
      });
  }

  async setupFlowWorkMode(device) {
    //console.log('Create the flow for the WorkcMode capability');
    //Now setup the flow cards
    device._setWorkMode = await device.homey.flow.getActionCard('set-work-mode.'+device.goveedevicetype); 
    device._setWorkMode
      .registerRunListener(async (args, state) => {
        device.log('attempt to set work mode: '+JSON.stringify(args.workMode)+' with value '+JSON.stringify(args.modeValue));
        return new Promise((resolve, reject) => {
            device.log('now send the work mode capability command');
            device.driver.setWorkMode(args.workMode, args.modeValue, args.device.data.model, args.device.data.mac).then(() => {
            resolve(true);
          }, (_error) => {
            reject(_error);
          });
        });
      });
      device._setWorkMode
      .registerArgumentAutocompleteListener('workMode', async (query, args) => {
        device.log('attempt to list available workModes matching filter ['+query+']');
        let workModeCapa = args.device.data.capabilitieslist.find(function(e) { return e.instance == "workMode" });
        let workModes = workModeCapa.parameters.fields.find(function(e) { return e.fieldName == "workMode" });
        let filteredModes = workModes.options.filter(function(e) { 
          return e.name.toLowerCase().includes(query.toLowerCase()) 
        });
        device.log(JSON.stringify(filteredModes));
        return filteredModes.map((workModes) => {
          workModes.formattedName = workModes.name;
          return workModes;
        });
      });
      device._setWorkMode
      .registerArgumentAutocompleteListener('modeValue', async (query, args) => {
        device.log('attempt to list available modeValues matching filter ['+query+']');
        let workModeCapa = args.device.data.capabilitieslist.find(function(e) { return e.instance == "workMode" });
        let modeValuesOptions = workModeCapa.parameters.fields.find(function(e) { return e.fieldName == "modeValue" });
        device.log(JSON.stringify(modeValuesOptions));
        let modeValues = modeValuesOptions.options.find(function(e) { return e.name == args.workMode.name });
        device.log(JSON.stringify(modeValues));
        if(modeValues.hasOwnProperty('options'))
        {
          let filteredModes = modeValues.options.filter(function(e) {
            if (typeof e.value === 'string') {
              return e.value.toLowerCase().includes(query.toLowerCase()) 
            } else {
              return e;
            }
          });
          device.log(JSON.stringify(filteredModes));
          return filteredModes.map((modeValues) => {
            modeValues.formattedName = modeValues.value.toString();
            modeValues.name = modeValues.value.toString();
            return modeValues;
          });
        } else {
          const defaultOption = 
          [{ 
            "name": modeValues.name,
            "formattedName": modeValues.name,
            "value": modeValues.defaultValue
          }]
          return defaultOption 
        }
        
      });
  }
}

exports.SharedDevice = GoveeSharedDeviceClient;