Unofficial app for the Govee WIFI enabled devices. This app supports the main light functions as they are available in the Govee API.
A special thanks to github user chris01b for creating the first steps into consuming the API in a nice way for nodejs that I could easily consume and adapt for the Homey app.

Getting started
You need to use the Govee app to request the API key for you account.
Then after installing this app you can set the API key in the app settings.
Then you can add the Govee devices.

Limitations
The Govee API does only allow basic light operations, these are:
turn on/off
set color
set color temp
set brightness

That means other more advanced operations are not available, so the Flow modes and light bar special operations are not possible at this time.
If you set your bar to a color mode, both bars will use that color in full. There is no way to switch back to video mode without the Govee app.

Govee API v1.3 is used.