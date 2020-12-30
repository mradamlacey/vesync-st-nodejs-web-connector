"use strict";

const qs = require('querystring');
const rp = require('request-promise');
const log = require('../local/log');
const config = require('config');
const lifxClientId = config.get('lifx.clientId');
const lifxClientSecret = config.get('lifx.clientSecret');
const lifxApiEndpoint = config.get('lifx.apiEndpoint');
const lifxOauthEndpoint = config.get('lifx.oauthEndpoint');

/**
 * LIFX API calls used by this application
 */
module.exports = {


    /** Gets list of all VeSync devices for the account
     * 
     * @param {*} accountId 
     * @param {*} token 
     * @param {*} callback 
     */
    getDevices: function(accountId, token, callback) {

        let options = {
            method: 'GET',
            uri: `${lifxApiEndpoint}/lights/`,
            headers: getApiHeaders(accountId, token),
            transform: function (body) {
                return JSON.parse(body)
            }
        };

        rp(options).then(function(data) {
            let locations = [];
            data.forEach(function(item) {
                locations.push({id: item.location.id, name: item.location.name});
            });
            callback(locations);
        }).error(function(err) {
            log.error(`$err encountered retrieving locations`)
        });

    },

/** Get Air Purifier device info by UUID
 * 
 * @param {*} accountId 
 * @param {*} token 
 * @param {*} uuid 
 * @param {*} callback 
 */
    getAirPurifierInfo: function(accountId, token, uuid, callback) {
        let options = {
            method: 'GET',
            uri: `${lifxApiEndpoint}/lights/id:${externalId}`,
            headers: {
                "User-Agent": "SmartThings Integration",
                "Authorization": `Bearer ${token}`
            },
            transform: function (body) {
                return JSON.parse(body)
            }
        };
        rp(options).then(function(data) {
            callback(data);
        });
    },

    /**
     * Set the state of a specific light
     *
     * @param token
     * @param externalId
     * @param body
     * @param callback
     * @see https://api.developer.lifx.com/docs/set-state
     */
    sendCommand: function(token, externalId, body, callback) {
        let options = {
            method: 'PUT',
            uri: `${lifxApiEndpoint}/lights/id:${externalId}/state`,
            headers: {
                "User-Agent": "SmartThings Integration",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(body),
            transform: function(body) {
                return JSON.parse(body)
            }
        };
        log.debug(`authorization=${options.headers.Authorization}`);
        log.debug(`uri=${options.uri}`);
        rp(options).then(function(data) {
            if (data && callback) {
                callback(data);
            }
        }).catch(function(err){
            log.error(`${err} sending commands to ${externalId}`)
        });
    },

    /**
     * Given a light state object, returns a list of the events to initialize the state on the SmartThings platform.
     * @param light Object returned from getLight or and item from getLights
     * @returns List of event objects
     */
    allLightEvents(light) {
        return fullEventList(light);
    },

    initialLightEvents(light) {
        let events = fullEventList(light);
        /*
        events.push({
            component: "main",
            capability: "healthCheck",
            attribute: "DeviceWatch-Enroll",
            value: '{"protocol": "cloud", "scheme":"untracked"}'
        });
        */
        return events;
    }
};

function getApiHeaders(accountId, token){
    return {
        "account-id": accountId,
        tk: token,
        "Content-Type": "application/json",
        "Accept-Language": "en",
        "tz": "US/Central",
        "app-version": "2.5.1"

    }
}

function fullEventList(light) {
    const healthStatus = light.connected ? "online" : "offline";
    return [
        {
            component: "main",
            capability: "switch",
            attribute: "switch",
            value: light.power
        },
        {
            component: "main",
            capability: "switchLevel",
            attribute: "level",
            value: light.brightness * 100
        },
        {
            component: "main",
            capability: "colorTemperature",
            attribute: "colorTemperature",
            value: light.color.kelvin
        },
        {
            component: "main",
            capability: "colorControl",
            attribute: "hue",
            value: light.color.hue / 3.6
        },
        {
            component: "main",
            capability: "colorControl",
            attribute: "saturation",
            value: light.color.saturation * 100
        },
        {
            component: "main",
            capability: "healthCheck",
            attribute: "DeviceWatch-DeviceStatus",
            value: healthStatus
        },
        {
            component: "main",
            capability: "healthCheck",
            attribute: "healthStatus",
            value: healthStatus
        }
    ];
}
