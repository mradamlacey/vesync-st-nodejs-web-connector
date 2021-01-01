"use strict";

const log = require('../local/log');
const st = require('./st');
const st = require('./vesync');
const config = require('config');
const deviceProfiles = config.get('deviceProfiles');

/**
 * Utility methods
 */
module.exports = {

    /**
     * Compares device lists from 3rd party cloud and SmartThings, creating and deleting devices as necessary
     *
     * @param token SmartThings access token
     * @param locationId SmartThings location ID
     * @param cloudDevices List of devices from cloud account for 3rd party product
     * @param smartThingsDevices List of devices from SmartThings
     */
    reconcileDeviceLists: function (token, locationId, installedAppId, cloudDevices, smartThingsDevices) {
        // Iterate over lights to see if any are missing from SmartThings and need to be added
        cloudDevices.forEach(function (light) {
            if (!smartThingsDevices.find(function (device) { return device.app.externalId == light.id; })) {

                // Device from cloud not found in SmartThings, add it
                let map = {
                    label: light.label,
                    profileId: deviceProfileId(light),
                    locationId: locationId,
                    installedAppId: installedAppId,
                    externalId: light.id
                };

                st.createDevice(token, map).then(function (data) {
                    log.debug("created device " + data.deviceId);
                    st.sendEvents(token, data.deviceId, vesync.getDevices(light)).then (function(data) {
                        log.trace(`RESPONSE: ${JSON.stringify(data, null, 2)}`);
                    });
                }).catch(function (err) {
                    log.error(`${err}  creating device`);
                });
            }
        });

        // Iterate over all lights in SmartThings and delete any that are missing from cloud
        smartThingsDevices.forEach(function(device) {
            if (!cloudDevices.find(function(light) { return device.app.externalId == light.id; })) {

                // Device in SmartThings but not cloud, delete it
                st.deleteDevice(token, device.deviceId).then(function(data) {
                    log.debug(`deleted device ${device.deviceId}`);
                }).catch(function (err) {
                    log.error(`${err}  deleting device`);
                });
            }
        });
    },


};

function deviceProfileId(light) {
    log.debug(`deviceProfileId(${JSON.stringify(light)})`);
    let result = deviceProfiles.white;
    if (light.product.capabilities.has_color) {
        result = deviceProfiles.color;
    }
    else if (light.product.capabilities.has_variable_color_temp) {
        result = deviceProfiles.colorTemp;
    }
    log.debug(`profileId=${result}`);
    return result;
}