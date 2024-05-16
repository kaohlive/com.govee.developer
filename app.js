'use strict';

const Homey = require('homey');
const mqtt = require('mqtt');

class GoveeApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Govee App has been initialized');
    //Setup global jobs
    this.mqttClient=null;
    this.localApiClient=null;
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
    this.log('Cleaned up open connections');
  }

  async setupMqttReceiver(){
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
      client.subscribe(this.homey.settings.get('api_key'), (err) => {  
          if (!err) {  
            this.log('Subscribed to mqtt topic apiKey')  
          }  
      })  
    })
    this.mqttClient=client;
    this.mqttClient.on('message', (topic, message) => {  
      console.log(`Received message ${message} from topic ${topic}`)  
    })
  }
}

module.exports = GoveeApp;