//A small rip from https://github.com/chris01b/Govee-API-Client/blob/master/index.js
//Seems like a good start for athe api client but is not complete and not published as npm package.
//All credits go to chris01b for this great start

const fetch = require('isomorphic-unfetch');

class GoveeClient {
  constructor(config) {
    this.api_key = config.api_key;
    this.basePath = "https://developer-api.govee.com";
  }

  request(endpoint = "", options = {}) {
    let url = this.basePath + endpoint;

    let headers = {
      'Govee-API-Key': this.api_key,
      'Content-type': 'application/json'
    };

    let config = {
        ...options,
        headers
    };

    return fetch(url, config).then(res => {
      if (res.ok) {
        if (endpoint != "/ping") {
          return res.json();
        } else {
          return res.text();
        }
      }
      throw new Error(res);
    })
  }

  ping() {
    let config = {
      method: 'GET'
    };
    return this.request("/ping", config);
  }

  deviceList() {
    let config = {
      method: 'GET'
    };
    return this.request("/v1/devices", config);
  }

  deviceControl(body) {
    const config = {
      method: 'PUT',
      body: JSON.stringify(body)
    }
    return this.request("/v1/devices/control", config);
  }

  deviceState(options) {
    let qs = options ? "?" + options : "";
    let url = "/v1/devices/state" + qs;
    let config = {
      method: 'GET'
    };
    return this.request(url, config);
  }

  state(model, device) {
    return new Promise((resolve, reject) => {
        console.log('attempt to retrieve state for device ['+device+':'+model+']');
        var params = 'device='+encodeURIComponent(device)+'&model='+model;
        this.deviceState(params).then(res => {
            resolve(res);
        }).catch(e => {reject(e)});
    });
  }

  turn(mode, model, device) {
    return new Promise((resolve, reject) => {
      if ((mode !== 'on' || mode === 'off') && (mode === 'on' || mode !== 'off')) {
        reject(new Error("Incorrect turn parameter"));
      } else {
        console.log('attempt to switch device ['+device+':'+model+'] to new mode: '+mode)
        let params = {
          'device': device,
          'model': model,
          'cmd' : {
            'name': 'turn',
            'value': mode
          }
        };
        this.deviceControl(params).then(res => {
          resolve(res);
        }).catch(e => {reject(e)});
      }
    });
  }

  brightness(dim, model, device) {
    return new Promise((resolve, reject) => {
      if (dim < 0 | dim > 100) {
        reject(new Error("Incorrect dim level"));
      } else {
        console.log('attempt dim device ['+device+':'+model+'] to new level: '+dim)
        let params = {
          'device': device,
          'model': model,
          'cmd' : {
            'name': 'brightness',
            'value': dim
          }
        };
        this.deviceControl(params).then(res => {
          resolve(res);
        }).catch(e => {reject(e)});
      }
    });
  }

  //Ensure that the colortemp fits the range specified by the device properties
  colorTemp(colortemp, model, device) {
    return new Promise((resolve, reject) => {
        console.log('attempt set color temp of device ['+device+':'+model+'] to new temp: '+colortemp)
        let params = {
            'device': device,
            'model': model,
            'cmd' : {
            'name': 'colorTem',
            'value': colortemp
            }
        };
        this.deviceControl(params).then(res => {
            resolve(res);
        }).catch(e => {reject(e)});
    });
  }

  //Color object needs to be { 'r': 255, 'g': 255, 'b': 244 }
  color(color, model, device) {
    return new Promise((resolve, reject) => {
        console.log('attempt set color of device ['+device+':'+model+'] to new color: '+JSON.stringify(color));
        let params = {
          'device': device,
          'model': model,
          'cmd' : {
            'name': 'color',
            'value': color
          }
        };
        this.deviceControl(params).then(res => {
          resolve(res);
        }).catch(e => {reject(e)});
    });
  }

}

exports.GoveeClient = GoveeClient;