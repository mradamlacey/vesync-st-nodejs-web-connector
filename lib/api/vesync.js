"use strict";

const qs = require('querystring');
const axios = require('axios');
const log = require('../local/log');
const config = require('config');
const md5 = require('md5');
const vesyncApiEndpoint = config.get('vesync.apiEndpoint');

const defaultTz = "US/Central";
const defaultLanguage = "en"
const currentVeSyncAppVersion = "2.5.1"

const components = {
    "components": [{
            "id": "main", 
            "capabilities": [
                { "id": "airQualitySensor", "version": 1, "attribute": "airQuality" },
                { "id": "filterState", "version": 1, "attribute": "filterLifeRemaining" }, 
                { "id": "fanSpeed", "version": 1, "attribute": "fanSpeed" }
            ]
        }]
};

/**
 * VeSync API calls used by this application
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
    getAirPurifierInfo: function(accountId, token, uuid) {

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
                log.error(err);
                throw new Error(err);
            });
            
    },

    setAirPurifierFanSpeed(accountId, token, uuid, level){
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
            "level": level,
            "uuid": uuid,
            "mobileId": "1234567890123456",
            "accountID": accountId,
            "token": token
        };

        return ax.put("/131airPurifier/v1/device/updateSpeed", data)
            .then(function(res){

                if(res.data.code != 0){
                    console.log(res.data);
                    throw new Error("Error calling VeSync API, code: " + res.data.code);
                }

                console.log(JSON.stringify(res.data));

                return(res.data);
            })
            .catch(function(err){
                log.error(err);
                throw new Error(err);
            });
    },

    turnAirPurifierOff(accountId, token, uuid){
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
            "status": "off",
            "uuid": uuid,
            "mobileId": "1234567890123456",
            "accountID": accountId,
            "token": token
        };

        return ax.put("/131airPurifier/v1/device/deviceStatus", data)
            .then(function(res){

                if(res.data.code != 0){
                    console.log(res.data);
                    throw new Error("Error calling VeSync API, code: " + res.data.code);
                }

                console.log(JSON.stringify(res.data));

                return(res.data);
            })
            .catch(function(err){
                log.error(err);
                throw new Error(err);
            });
    },

    mapVeSyncToSmartThingsCapabilities: mapVeSyncToSmartThingsCapabilities,
    mapVeSyncToSmartThingsFanSpeedCapability: mapVeSyncToSmartThingsFanSpeedCapability

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

function mapVeSyncToSmartThingsCapabilities(vesyncDeviceStatus){

    var capabilities = [
        {
            component: "main",
            capability: "airQualitySensor",
            attribute: "airQuality",
            value: mapVeSyncAirQualityToSmartThings(vesyncDeviceStatus.airQuality)
        },
        {
            component: "main",
            capability: "filterState",
            attribute: "filterLifeRemaining",
            value: vesyncDeviceStatus.filterLife.useHour
        },
        {
            component: "main",
            capability: "fanSpeed",
            attribute: "fanSpeed",
            value: vesyncDeviceStatus.deviceStatus == "off" ? 0 : vesyncDeviceStatus.level  >= 3 ? 3 : vesyncDeviceStatus.level
        }
    ];

    return capabilities;
}

function mapVeSyncAirQualityToSmartThings(airQuality){
    if(airQuality == "bad"){
        return 100;
    }
    if(airQuality == "good"){
        return 50;
    }
    if(airQuality == "excellent"){
        return 0;
    }
    else{
        log.error("Unhandled air quality level: " + airQuality);
        return 10;
    }
}

function mapVeSyncToSmartThingsFanSpeedCapability(level){

    var capability =  {
            component: "main",
            capability: "fanSpeed",
            attribute: "fanSpeed",
            value: level >= 3 ? 3 : level
        };

    return capability;
}

