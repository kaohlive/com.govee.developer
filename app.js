'use strict';

const Homey = require('homey');
const mqtt = require('mqtt');
const { EventEmitter } = require('events');

class GoveeApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Govee App has been initialized');
    //Setup global jobs
    this.mqttClient=null;
    this.localApiClient=null;
    //Create an event emitter to send received mqtt to the devices
    this.eventBus = new EventEmitter();

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
}

module.exports = GoveeApp;