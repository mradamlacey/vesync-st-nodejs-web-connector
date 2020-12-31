"use strict";

const qs = require('querystring');
const axios = require('axios');
const log = require('../local/log');
const config = require('config');
const md5 = require('md5');
const vesyncAccountId = config.get('vesync.accountId');
const vesyncToken = config.get('vesync.token');
const vesyncApiEndpoint = config.get('vesync.apiEndpoint');

const defaultTz = "US/Central";
const defaultLanguage = "en"
const currentVeSyncAppVersion = "2.5.1"

/**
 * LIFX API calls used by this application
 */
module.exports = {

    getApiCredentialsFromConfig(){

        return({
            accountId: vesyncAccountId,
            token: vesyncToken
        });
    },

    getApiCredentials(email, password){
        const ax = axios.create({
            baseURL: vesyncApiEndpoint,
            timeout: 30000,
            headers: getLoginHeaders()
          });

        var data = {
            "timeZone": defaultTz,
            "acceptLanguage": defaultLanguage,
            "appVersion": currentVeSyncAppVersion,
            "phoneBrand": "SM N9005",
            "phoneOS": "Android",
            "traceId": new Date().getUTCMilliseconds(),
            "email": email,
            "password": md5(password),
            "devToken": "",
            "userType": "1",
            "method": "login"
        };

        return ax.post("cloud/v1/user/login", data)
            .then(function(res){
                
                if(res.data.code != 0){
                    throw new Error("Error calling VeSync API, code: " + res.data.code);
                }

                console.log(res.data);

                return({
                    accountId: res.data.result.accountID,
                    token: res.data.result.token
                });
            })
            .catch(function(err){
                console.error(err);
                return err;
            });

    },

    /** Gets list of all VeSync devices for the account
     * 
     * @param {*} accountId 
     * @param {*} token 
     * @param {*} callback 
     */
    getDevices: function(accountId, token) {

        const ax = axios.create({
            baseURL: vesyncApiEndpoint,
            timeout: 30000,
            headers: getLoginHeaders()
          });

        var data = {
            "timeZone": defaultTz,
            "acceptLanguage": defaultLanguage,
            "appVersion": currentVeSyncAppVersion,
            "phoneBrand": "SM N9005",
            "phoneOS": "Android",
            "traceId": "1608862411829",
            "userType": "1",
            "method": "devices",
            "pageNo": "1",
            "pageSize": "50",
            "accountID": accountId,
            "token": token
        };

        return ax.post("/cloud/v1/deviceManaged/devices", data)
            .then(function(res){

                if(res.data.code != 0){
                    console.log(res.data);
                    throw new Error("Error calling VeSync API, code: " + res.data.code);
                }

                console.log(JSON.stringify(res.data.result));

                return(res.data.result);
            })
            .catch(function(err){
                console.error(err);
                return err;
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

        const ax = axios.create({
            baseURL: vesyncApiEndpoint,
            timeout: 30000,
            headers: getLoginHeaders()
          });

        var data = {
            "timeZone": defaultTz,
            "acceptLanguage": defaultLanguage,
            "appVersion": currentVeSyncAppVersion,
            "phoneBrand": "SM N9005",
            "phoneOS": "Android",
            "traceId": "1608862411829",
            "userType": "1",
            "method": "devicedetail",
            "uuid": uuid,
            "mobileId": "1234567890123456",
            "accountID": accountId,
            "token": token
        };

        return ax.post("/131airPurifier/v1/device/deviceDetail", data)
            .then(function(res){

                if(res.data.code != 0){
                    console.log(res.data);
                    throw new Error("Error calling VeSync API, code: " + res.data.code);
                }

                console.log(JSON.stringify(res.data));

                return(res.data);
            })
            .catch(function(err){
                console.error(err);
                return err;
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

function getLoginHeaders(email, password){
    return {
        "Content-Type": "application/json",
        "Accept-Language": defaultLanguage,
        "tz": defaultTz,
        "app-version": currentVeSyncAppVersion

    }
}

function getApiHeaders(accountId, token){
    return {
        "account-id": accountId,
        tk: token,
        "Content-Type": "application/json",
        "Accept-Language": defaultLanguage,
        "tz": defaultTz,
        "app-version": currentVeSyncAppVersion

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
