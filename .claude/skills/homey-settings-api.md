# Homey App Settings API Guide

This skill documents how to create API endpoints for Homey app settings pages.

## Overview

Homey SDK 3 apps can expose API endpoints that are callable from the settings page HTML. This enables dynamic functionality like testing connections, retrieving status information, and triggering actions.

## Architecture

```
Settings HTML (settings/index.html)
    │
    ├─► Homey.api('GET', '/endpoint')    [Request]
    │
    ▼
App API Handler (api.js)
    │
    ├─► Access homey.app, homey.settings, etc.
    │
    ▼
Response returned to Settings Page
    │
    ▼
Settings page renders the data
```

## File Structure

```
app-root/
├── .homeycompose/
│   └── app.json              # API route definitions
├── settings/
│   └── index.html            # Settings page with JavaScript
├── api.js                    # Backend API handler functions
└── app.js                    # Main app class
```

## 1. Defining API Endpoints

API endpoints must be defined in `.homeycompose/app.json`:

```json
{
  "id": "com.example.app",
  "sdk": 3,
  "api": {
    "getStatus": {
      "method": "GET",
      "path": "/status"
    },
    "triggerAction": {
      "method": "POST",
      "path": "/trigger-action"
    },
    "updateConfig": {
      "method": "PUT",
      "path": "/config/:id"
    }
  }
}
```

**Key points:**
- Keys (e.g., `getStatus`) must match exported function names in `api.js`
- `method`: HTTP method (`GET`, `POST`, `PUT`, `DELETE`)
- `path`: Endpoint path with optional parameters (`:id`)

## 2. Implementing API Handlers

Create `api.js` at the app root:

```javascript
'use strict';

module.exports = {
  /**
   * GET /status - Retrieve app status
   */
  async getStatus({ homey }) {
    const client = homey.app.someClient;

    if (!client) {
      return {
        initialized: false,
        error: 'Client not initialized'
      };
    }

    return {
      initialized: true,
      ready: client.isReady(),
      deviceCount: client.devices.length
    };
  },

  /**
   * POST /trigger-action - Trigger an action
   */
  async triggerAction({ homey, body }) {
    const { actionType } = body;

    try {
      await homey.app.performAction(actionType);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * PUT /config/:id - Update configuration
   */
  async updateConfig({ homey, params, body }) {
    const { id } = params;
    const { value } = body;

    homey.settings.set(`config_${id}`, value);
    return { success: true, id, value };
  },

  /**
   * GET /data?filter=active - Query with parameters
   */
  async getData({ homey, query }) {
    const { filter } = query;
    const data = await homey.app.fetchData(filter);
    return { data };
  }
};
```

### Handler Function Parameters

| Parameter | Description |
|-----------|-------------|
| `homey`   | The Homey instance for accessing app, settings, drivers, etc. |
| `query`   | Query string parameters (for GET requests) |
| `body`    | Request body (for POST/PUT requests) |
| `params`  | URL path parameters (e.g., `:id`) |

### Accessing App Resources

```javascript
async getStatus({ homey }) {
  // Access main app instance
  const app = homey.app;

  // Access app settings
  const apiKey = homey.settings.get('api_key');

  // Access drivers
  const driver = await homey.drivers.getDriver('my-driver');
  const devices = driver.getDevices();

  // Access other Homey APIs
  const zones = await homey.zones.getZones();

  return { /* ... */ };
}
```

## 3. Calling the API from Settings HTML

### Setup

Include Homey script in your settings page:

```html
<head>
  <script type="text/javascript" src="/homey.js" data-origin="settings"></script>
</head>
```

### Initialize with onHomeyReady

```javascript
function onHomeyReady(Homey) {
  Homey.ready();  // Signal settings page is ready - REQUIRED!

  // Your code here
}
```

### API Call Syntax

```javascript
// GET request
Homey.api('GET', '/path', callback);

// GET request with query parameters
Homey.api('GET', '/path?param=value', callback);

// POST request with body
Homey.api('POST', '/path', bodyObject, callback);

// PUT request with body
Homey.api('PUT', '/path', bodyObject, callback);

// DELETE request
Homey.api('DELETE', '/path', null, callback);
```

### Callback Pattern

```javascript
Homey.api('GET', '/status', function(err, result) {
  if (err) {
    console.error('API Error:', err);
    return;
  }
  console.log('Result:', result);
});
```

### Examples

```javascript
function onHomeyReady(Homey) {
  Homey.ready();

  // GET request
  Homey.api('GET', '/local-api-status', function(err, status) {
    if (err) {
      showError(err);
      return;
    }
    updateStatusDisplay(status);
  });

  // POST request with body
  document.getElementById('refresh-btn').addEventListener('click', function() {
    Homey.api('POST', '/trigger-discovery', { force: true }, function(err, result) {
      if (err) return console.error(err);
      console.log('Discovery triggered:', result);
    });
  });

  // GET with query parameters
  Homey.api('GET', '/devices?type=light&status=online', function(err, result) {
    if (err) return showError(err);
    renderDeviceList(result.devices);
  });
}
```

## 4. Homey Settings Methods Reference

### `Homey.ready()`

Signal that the settings page is ready. **Must be called** in `onHomeyReady`.

```javascript
function onHomeyReady(Homey) {
  Homey.ready();  // Always call this first!
}
```

### `Homey.api(method, path, [body], callback)`

Make an API call to the app backend.

```javascript
// GET request (no body)
Homey.api('GET', '/status', function(err, result) { ... });

// POST request with body
Homey.api('POST', '/action', { key: 'value' }, function(err, result) { ... });

// POST request without body
Homey.api('POST', '/trigger', null, function(err, result) { ... });
```

### `Homey.get(key, callback)`

Get an app setting value.

```javascript
Homey.get('api_key', function(err, value) {
  if (err) return Homey.alert(err);
  document.getElementById('apikey').value = value || '';
});
```

### `Homey.set(key, value, callback)`

Set an app setting value.

```javascript
Homey.set('api_key', 'new-api-key-value', function(err) {
  if (err) return Homey.alert(err);
  console.log('Setting saved');
});
```

### `Homey.alert(message)`

Show an alert dialog to the user.

```javascript
Homey.alert('Settings saved successfully!');
Homey.alert('Error: ' + err.message);
```

### `Homey.confirm(message, callback)`

Show a confirmation dialog.

```javascript
Homey.confirm('Are you sure?', function(err, confirmed) {
  if (err) return;
  if (confirmed) {
    // User clicked OK
  }
});
```

## 5. Error Handling

### In API Handlers

Return error information in the response:

```javascript
async getStatus({ homey }) {
  try {
    const data = await homey.app.fetchData();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}
```

### In Settings Page

```javascript
Homey.api('GET', '/status', function(err, result) {
  // Handle transport/network errors
  if (err) {
    showError('Connection error: ' + err);
    return;
  }

  // Handle application-level errors
  if (!result.success) {
    showError(result.error);
    return;
  }

  // Success
  updateUI(result.data);
});
```

## 6. Complete Example

### .homeycompose/app.json

```json
{
  "id": "com.example.myapp",
  "sdk": 3,
  "api": {
    "getLocalApiStatus": {
      "method": "GET",
      "path": "/local-api-status"
    },
    "triggerDiscovery": {
      "method": "POST",
      "path": "/trigger-discovery"
    },
    "testCloudApi": {
      "method": "GET",
      "path": "/test-cloud-api"
    }
  }
}
```

### api.js

```javascript
'use strict';

module.exports = {
  async getLocalApiStatus({ homey }) {
    const client = homey.app.localApiClient;

    if (!client) {
      return {
        initialized: false,
        ready: false,
        error: 'Client not initialized',
        devices: [],
        deviceCount: 0
      };
    }

    const devices = client.deviceList().map(device => ({
      id: device.id,
      name: device.name,
      ip: device.ip,
      isOn: device.state?.isOn
    }));

    return {
      initialized: true,
      ready: client.isReady(),
      error: client.getError()?.message || null,
      devices: devices,
      deviceCount: devices.length,
      udpPort: 4002,
      discoveryInterval: 30000
    };
  },

  async triggerDiscovery({ homey }) {
    const client = homey.app.localApiClient;

    if (!client) {
      return { success: false, error: 'Client not initialized' };
    }

    client.triggerDiscovery();
    return { success: true };
  },

  async testCloudApi({ homey }) {
    const apiKey = homey.settings.get('api_key');

    if (!apiKey) {
      return {
        success: false,
        error: 'No API key configured',
        devices: [],
        deviceCount: 0,
        rawResponse: null,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const CloudClient = require('./api/cloud-client');
      const client = new CloudClient({ api_key: apiKey });
      const response = await client.getDevices();

      return {
        success: true,
        error: null,
        devices: response.data,
        deviceCount: response.data.length,
        rawResponse: JSON.stringify(response, null, 2),
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        devices: [],
        deviceCount: 0,
        rawResponse: JSON.stringify({ error: err.message }, null, 2),
        timestamp: new Date().toISOString()
      };
    }
  }
};
```

### settings/index.html (simplified)

```html
<!DOCTYPE html>
<html>
<head>
  <script type="text/javascript" src="/homey.js" data-origin="settings"></script>
</head>
<body>
  <header class="homey-header">
    <h1 class="homey-title">App Settings</h1>
  </header>

  <fieldset class="homey-form-fieldset">
    <legend class="homey-form-legend">API Configuration</legend>
    <div class="homey-form-group">
      <label class="homey-form-label" for="apikey">API Key</label>
      <input class="homey-form-input" id="apikey" type="text" />
    </div>
  </fieldset>

  <button class="homey-button-primary-full" id="save">Save</button>
  <button class="homey-button-secondary" id="test">Test Connection</button>

  <div id="status"></div>

  <script>
    function onHomeyReady(Homey) {
      Homey.ready();

      // Load existing settings
      Homey.get('api_key', function(err, value) {
        if (!err && value) {
          document.getElementById('apikey').value = value;
        }
      });

      // Save settings
      document.getElementById('save').addEventListener('click', function() {
        const apiKey = document.getElementById('apikey').value;
        Homey.set('api_key', apiKey, function(err) {
          if (err) return Homey.alert('Error: ' + err);
          Homey.alert('Settings saved!');
        });
      });

      // Test connection
      document.getElementById('test').addEventListener('click', function() {
        Homey.api('GET', '/test-cloud-api', function(err, result) {
          const statusEl = document.getElementById('status');

          if (err) {
            statusEl.innerHTML = '<div class="error">Error: ' + err + '</div>';
            return;
          }

          if (result.success) {
            statusEl.innerHTML = '<div class="success">Connected! Found ' +
              result.deviceCount + ' devices.</div>';
          } else {
            statusEl.innerHTML = '<div class="error">' + result.error + '</div>';
          }
        });
      });
    }
  </script>
</body>
</html>
```

## Key Files in This Project

- [.homeycompose/app.json](.homeycompose/app.json) - API route definitions
- [api.js](api.js) - API handlers for settings page
- [settings/index.html](settings/index.html) - Settings page with tabs
- [app.js](app.js) - Main app class

## Related Skills

- See [homey-css-style-guide.md](homey-css-style-guide.md) for CSS styling documentation
