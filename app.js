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
      this.log(`Received message ${message} from topic ${topic}`)
      let payload = message.toJSON();
      this.eventBus.emit('device_event_'+payload.device, payload);
    })
    // //Send a test event
    // setTimeout(function() {
    //   this.log('App: Test send a device message'); // This will execute after 5 seconds
    //   this.eventBus.emit('device_event_'+'19:05:D4:AD:FC:86:95:14', {
    //     "sku":"H7140",
    //     "device":"19:05:D4:AD:FC:86:95:14",
    //     "deviceName":"Smart Humidifier Lite",
    //     "capabilities":
    //     [
    //       {
    //         "type":"devices.capabilities.event",
    //         "instance":"lackWaterEvent",
    //         "state":
    //         [
    //           {
    //             "name":"lack",
    //             "value":1,
    //             "message":"Lack of Water"
    //           }
    //         ]
    //       }
    //     ]
    //     });
    // }.bind(this), 5000);
  }
}

module.exports = GoveeApp;