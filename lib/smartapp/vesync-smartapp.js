"use strict";

const log = require('../local/log');
const config = require('config');
const SmartApp = require('@smartthings/smartapp');
const vesyncApi = require('../api/vesync');
const vesyncPages = require('./vesync-pages');
const smartThingsApi = require('../api/st');
const db = require('../local/db');

var sleep = require('sleep');
const { reject } = require('bluebird');

var publicUrl = null;

module.exports = {

    defaultDeviceCommandHandler: function(ctx, deviceId, cmd){
        log.warn(`Unhandled command - Device id: ${deviceId}, command: ${cmd}, Context:\n`);
        log.warn(JSON.stringify(ctx));
    },

    splashPage: vesyncPages.splashPage,
    mainPage: vesyncPages.mainPage,
    selectDevicesPage: vesyncPages.selectDevicesPage,
    finalPage: vesyncPages.finalPage,

    appUpdatedHandler: async function(ctx, updateData){
        log.info("Update data:\n"+ JSON.stringify(updateData));

        const { authToken } = updateData;
        const { installedAppId, locationId } = updateData.installedApp;

        var deviceUuidResp, deviceLabelResp;
        var stDevicesToInstall = [];
        var veSyncAccountId, veSyncToken;
        var cloudDeviceToStDeviceIdMap = {};

        return db.get(installedAppId, "deviceLabels").then(function(resp){
            deviceLabelResp = resp;
        })
        .then(function(reply){

            return db.get(installedAppId, "deviceInfo").then(function (resp) {

                deviceUuidResp = resp;
                if (deviceUuidResp == null) {
                    throw new Error("Unable to get list of devices to install");
                }
                var { devices } = deviceUuidResp;

                if (devices == null) {
                    throw new Error("Unable to get list of devices to install");
                }
                if (typeof devices != "string") {
                    throw new Error("Invalid setting for devices, type =" + typeof devices);
                }

                var { labels } = deviceLabelResp;

                if (labels == null) {
                    throw new Error("Unable to get list of device labels to install");
                }
                if (typeof labels != "string") {
                    throw new Error("Invalid setting for labels, type =" + typeof labels);
                }

                var deviceList = devices.split(",");
                var labelList = labels.split(",");

                log.info("Create SmartThings devices for " + deviceList.length + " devices");

                var stDevices = [];

                for(var i = 0;i< deviceList.length; i++){
                    stDevices.push({
                        label: labelList[i],
                        externalId: deviceList[i]
                    });
                }    
                
                stDevicesToInstall = stDevices;
            });
        })
        .then(function(){
            return db.get(installedAppId, "auth").then(function(resp){
                veSyncAccountId = resp.accountId;
                veSyncToken = resp.token;
            })
        })
        .then(function(){
            stDevicesToInstall.forEach(async function (device) {     
                // TODO: Handle multiple devices at once with adding to promise 
                // TODO: Handle different device types           
                await smartThingsApi.createDevice(authToken, config.get("deviceProfiles.airpurifier"), locationId, installedAppId, device.label, device.externalId)
                .then(function(data){
                    log.info("Created SmartThings device id: " + data.deviceId + "\n" + JSON.stringify(data));
                    cloudDeviceToStDeviceIdMap[device.externalId] = data.deviceId;

                    return _sendAllDeviceEvents(installedAppId, authToken, data.deviceId, device.externalId, "airpurifier", veSyncAccountId, veSyncToken);
                })
                .then(function(resp){
                    log.info(`Send events response:\n${JSON.stringify(resp, null, 2)}`);
                })
                .then(function(resp){
                    // Store auth credentials for each device
                    return db.put(cloudDeviceToStDeviceIdMap[device.externalId], "auth", { accountId: veSyncAccountId, token: veSyncToken});
                })
                .catch(function(err){
                    log.error("Error creating SmartThings device");
                    log.error(err);
                });
            });
        })
        .catch(function(err){
            log.error("Failed to complete update handler");
            log.error(err);
        });
    },

    appUninstallHandler: async function(ctx, uninstallData){
        log.info("Uninstall data:\n"+ JSON.stringify(uninstallData));

        // Remove token, account and device ids from persistent store
    },

    subscribedDeviceEventHandler: function(ctx, callback){
        log.info("Subscribed device event handler");

    },

    subscribedDeviceLifecycleEventHandler: function(ctx, callback){
        log.info("Subscribed device lifeycle event handler");
    },

    deviceCommandHandler: async function (ctx, command) {

        var veSyncAccountId;
        var veSyncToken;

        db.get(command.deviceId, "auth").then(function (resp) {
            if (resp == null) {
                log.error("Unable to find auth record for device id: " + command.deviceId);
                throw new Error("Unable to find auth record for device id: " + command.deviceId);
            }

            veSyncAccountId = resp.accountId;
            veSyncToken = resp.token;
        })
            .then(function (resp) {

                command.commands.forEach(function (c) {
                    log.info("Device command handler, event id: " + command.eventId + " deviceId: " + command.deviceId +
                        ", external Id: " + command.externalId + ", capability: " + c.capability);

                    if (c.capability == "fanSpeed") {
                        var level = c.arguments[0];
                        var p;
                        if (level == 0) {
                            p = vesyncApi.turnAirPurifierOff(veSyncAccountId, veSyncToken, command.externalId);
                        }
                        else {
                            p = vesyncApi.setAirPurifierFanSpeed(veSyncAccountId, veSyncToken, command.externalId, level);
                        }

                        return p.then(function (resp) {
                            return smartThingsApi.sendEvents(ctx.authToken,
                                command.deviceId,
                                [vesyncApi.mapVeSyncToSmartThingsFanSpeedCapability(level)]);
                        });


                    }

                    throw new Error("Invalid capability: " + c.capability);
                });

            })
            .then(function (resp) {
                log.info("Successfully set fan speed and sent SmartThings event");
            })
            .then(function(resp){
                return _sendAllDeviceEvents(null, ctx.authToken, command.deviceId, command.externalId, "airpurifier", veSyncAccountId, veSyncToken);
            })
            .catch(function (err) {
                log.error("Error handling device command");
                log.error(err);
            });
    },

    sendDeviceAllEvents: function(installAppId, stToken, deviceId, externalId, deviceType, accountId, token){
        _sendAllDeviceEvents(installAppId, stToken, deviceId, externalId, deviceType, accountId, token);
    },

    setPublicUrl: function(url){
        publicUrl = url;
        vesyncPages.setPublicUrl(url);
    }

};

function _sendAllDeviceEvents(installAppId, stToken, deviceId, externalId, deviceType, accountId, token) {

    log.trace("Sending all device events, device id: " + deviceId);

    var p = new Promise((resolve, reject) => {

        if (accountId == null || token == null) {
            db.get(installAppId, "auth").then(resolve).catch(reject);
        }
        else {
            resolve({ accountId: accountId, token: token });
        }
    })
        .then(function (auth) {
            var { accountId, token } = auth;
            if (deviceType == "airpurifier") {
                return vesyncApi.getAirPurifierInfo(accountId, token, externalId);
            }
            else {
                log.error("Not support device type: " + deviceType);
                throw new Error("Not supported device type: " + deviceType);
            }
        })
        .then(function (deviceStatus) {
            var events = vesyncApi.mapVeSyncToSmartThingsCapabilities(deviceStatus);
            return smartThingsApi.sendEvents(stToken, deviceId, events);
        })
        .catch(function (err) {
            log.error("Error sending all device events");
            log.error(err);
            reject(err);
        });

    return p;
}