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
  }

  async onUninit() {
    //We need to disconnect our hosts
    if(this.mqttClient!=null)
    {
      this.mqttClient.end();
      this.mqttClient.destroy();
    }
    if((this.localApiClient!=null))
      this.localApiClient.destroy();
    //Kill the eventbus, this prevents subscribed events from trying to fire while we are destorying hosts
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