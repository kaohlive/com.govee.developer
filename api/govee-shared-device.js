class GoveeSharedDeviceClient {
    constructor() {
    }

    async createDynamicCapabilities(model,mac,capabilitieslist,device)
    {
        device.log('Start adding dynamic cloud capabilities');
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
            "uiComponent": "slider",
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
            "uiComponent": "slider",
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

  async setupFlowSegmentControlColor(device) {
    device.log('Create the flow for the Segment Color Control capability');
    //Now setup the flow cards
    device._setSegmentColor = await device.homey.flow.getActionCard('set-segment-color.'+device.goveedevicetype); 
    device._setSegmentColor
      .registerRunListener(async (args, state) => {
        return new Promise((resolve, reject) => {
            let segmentArray=null;
            if(!args.segmentArray && !args.segmentNr)
              reject("Select either segment or enter a comma seperated segment nr list");
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
          if(!args.segmentArray && !args.segmentNr)
            reject("Select either segment or enter a comma seperated segment nr list");
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
              resolve(true);
            }, (_error) => {
              reject(_error);
            });
          });
        } else {
          return new Promise((resolve, reject) => {
            device.driver.toggle(0, 'dreamViewToggle', args.device.data.model,args.device.data.mac, args.device.goveedevicetype).then(() => {
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
        var devicelist = await device.driver.coudapi.deviceList();
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
}

exports.SharedDevice = GoveeSharedDeviceClient;