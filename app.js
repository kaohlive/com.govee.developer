'use strict';

const Homey = require('homey');
const mqtt = require('mqtt');
const { EventEmitter } = require('events');
const gvCloud = require('./api/govee-api-v2');

class GoveeApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Govee App has been initialized');
    //Setup global jobs
    this.mqttClient=null;
    this.localApiClient=null;
    this.cloudApi=null;
    //Create an event emitter to send received mqtt to the devices
    this.eventBus = new EventEmitter();

    // Initialize cloud API for app-level flow cards
    this.initCloudApi();

    // Listen for API key changes to reinitialize cloud API
    this.homey.settings.on('set', (key) => {
      if (key === 'api_key') {
        this.cloudApi = null; // Force reinit on next use
        this.log('API key updated, cloud API will reinitialize on next use');
      }
    });

    // Register Dreamview toggle action card
    this._toggleDreamviewDevice = this.homey.flow.getActionCard('toggle-dreamview-device');
    this._toggleDreamviewDevice.registerRunListener(async (args) => {
      // args.state is the dropdown ID string directly (e.g., "on" or "off")
      return this.toggleDreamviewDevice(args.device, args.state);
    });
    this._toggleDreamviewDevice.registerArgumentAutocompleteListener('device', async (query, args) => {
      return this.getDreamviewDevices(query);
    });

    // Register Dreamview Scenes widget autocomplete
    this.homey.dashboards.getWidget('dreamview-scenes')
      .registerSettingAutocompleteListener('scenes', async (query, settings) => {
        return this.getDreamviewDevices(query);
      });

    // Handle uncaught errors from the govee-lan-control library
    // This prevents the app from crashing due to library bugs or network issues
    process.on('uncaughtException', (err) => {
      // Handle UDP port already in use
      if (err.code === 'EADDRINUSE' && err.message.includes('4002')) {
        this.error('[GoveeApp] UDP port 4002 is already in use - local API disabled');
        this.error('[GoveeApp] Another application (Home Assistant, another Govee app) may be using this port');
        // Mark the local API client as failed if it exists
        if (this.localApiClient) {
          this.localApiClient.initError = err;
          this.localApiClient.isReady = false;
        }
        return; // Don't re-throw, handle gracefully
      }

      // Handle govee-lan-control library bug: accessing state of undefined device
      // This happens when the library receives a UDP message for an unknown device
      if (err instanceof TypeError && err.message.includes("Cannot read properties of undefined (reading 'state')") &&
          err.stack && err.stack.includes('govee-lan-control')) {
        this.error('[GoveeApp] Govee LAN library received message for unknown device (ignoring)');
        return; // Don't re-throw, this is a known library bug
      }

      // Handle JSON parsing errors from corrupted UDP messages in govee-lan-control
      // This happens when the library receives garbled or partial network data
      if (err instanceof SyntaxError && err.stack && err.stack.includes('govee-lan-control')) {
        this.error('[GoveeApp] Govee LAN library received malformed data (ignoring):', err.message);
        return; // Don't re-throw, network corruption is expected occasionally
      }

      // Handle other govee-lan-control errors gracefully
      if (err.stack && err.stack.includes('govee-lan-control')) {
        this.error('[GoveeApp] Govee LAN library error (ignoring):', err.message);
        return; // Don't re-throw library errors
      }

      // Re-throw other uncaught exceptions
      this.error('[GoveeApp] Uncaught exception:', err.message);
      throw err;
    });
  }

  async onUninit() {
    //We need to disconnect our hosts
    if (this.mqttClient != null) {
      try {
        this.mqttClient.end();
        this.mqttClient.destroy();
      } catch (err) {
        this.error('Error cleaning up MQTT client:', err.message);
      }
    }
    if (this.localApiClient != null) {
      try {
        this.localApiClient.destroy();
      } catch (err) {
        this.error('Error cleaning up Local API client:', err.message);
      }
    }
    //Kill the eventbus, this prevents subscribed events from trying to fire while we are destroying hosts
    this.eventBus.removeAllListeners();
    this.log('Cleaned up open connections');
  }

  async setupMqttReceiver(){
    //We only need to do this once for cloud devices
    if(this.mqttClient!==null)
      return;
    const emqx_url = 'mqtt.openapi.govee.com'; 

    const options = {  
        clean: true,  
        username: this.homey.settings.get('api_key'),  
        password: this.homey.settings.get('api_key'),  
    }
    this.log('Connecting the mqtt broker for status updates');

    const connectUrl = 'mqtts://' + emqx_url  
    const client = mqtt.connect(connectUrl, options)
    client.on('connect', () => {  
      this.log('Connected to the mqtt broker.')  
      client.subscribe("GA/"+this.homey.settings.get('api_key'), (err) => {  
          if (!err) {  
            this.log('Subscribed to mqtt topic apiKey')  
          }  
      })  
    })
    this.mqttClient=client;
    this.mqttClient.on('message', (topic, message) => {
      this.log(`Received message from topic ${topic}`)
      const jsonString = message.toString();
      const payload = JSON.parse(jsonString);
      this.log(JSON.stringify(payload));
      this.log('Message is for device ['+payload.device+']');
      this.eventBus.emit('device_event_'+payload.device, payload);
    })
  }

  /**
   * Initialize the cloud API client for app-level flow cards
   */
  initCloudApi() {
    const apiKey = this.homey.settings.get('api_key');
    if (apiKey) {
      this.cloudApi = new gvCloud.GoveeClient({ api_key: apiKey });
      this.log('Cloud API initialized for app-level flow cards');
    }
  }

  /**
   * Get list of DreamViewScenic scenes from cloud API for autocomplete
   */
  async getDreamviewDevices(query) {
    const apiKey = this.homey.settings.get('api_key');
    if (!apiKey) {
      throw new Error('Cloud API key not configured. Please add your Govee API key in the app settings.');
    }

    if (!this.cloudApi) {
      this.initCloudApi();
    }

    try {
      const response = await this.cloudApi.deviceList();
      // Filter for DreamViewScenic virtual device groups
      const dreamviewScenes = response.data.filter(device => {
        return device.sku === 'DreamViewScenic';
      });

      // Filter by query and map to autocomplete format
      return dreamviewScenes
        .filter(device => device.deviceName.toLowerCase().includes(query.toLowerCase()))
        .map(device => ({
          name: device.deviceName,
          description: 'Dreamview Scene',
          id: device.device,
          sku: device.sku
        }));
    } catch (error) {
      this.error('Failed to fetch Dreamview scenes:', error);
      throw new Error('Failed to fetch Dreamview scenes from Govee cloud. Please check your API key.');
    }
  }

  /**
   * Activate or deactivate a Dreamview scene via cloud API
   */
  async toggleDreamviewDevice(device, state) {
    const apiKey = this.homey.settings.get('api_key');
    if (!apiKey) {
      throw new Error('Cloud API key not configured. Please add your Govee API key in the app settings.');
    }

    if (!this.cloudApi) {
      this.initCloudApi();
    }

    const mode = state === 'on' ? 1 : 0;
    const action = state === 'on' ? 'activated' : 'deactivated';

    try {
      await this.cloudApi.devicesTurn(mode, device.sku, device.id);
      this.log(`Dreamview scene "${device.name}" ${action}`);
      return true;
    } catch (error) {
      this.error('Failed to toggle Dreamview scene:', error);
      throw new Error(`Failed to ${state === 'on' ? 'activate' : 'deactivate'} scene: ${error.message}`);
    }
  }
}

module.exports = GoveeApp;