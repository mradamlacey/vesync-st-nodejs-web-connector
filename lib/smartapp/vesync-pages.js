"use strict";

const log = require('../local/log');
const config = require('config');
const SmartApp = require('@smartthings/smartapp');
const vesyncApi = require('../api/vesync');
const db = require('../local/db');
const vesync = require('../api/vesync');
const { resolve } = require('bluebird');

var publicUrl = null;

module.exports = {


    splashPage: function (ctx, page, configData) {

        page.name("VeSync Connector");
        page.nextPageId("mainPage");
        page.style("SPLASH");
        page.nextText("Next");

        var splashImgUrl = [publicUrl, "images/vesync-logo-2019.png"].join("/");
        log.info(`Image Url: ${splashImgUrl}`);

        // prompts user to select a contact sensor
        page.section('banner', section => {
            section.imageSetting('banner').image(splashImgUrl);
        });

        page.complete(false);

    },

    mainPage: function (ctx, page, configData) {

        page.name("VeSync Account Information");
        page.style("NORMAL");
        page.nextPageId("selectDevicesPage");
        page.previousPageId("splashPage");
        page.nextText("Next");
        page.complete(false);

        // prompts user to select a contact sensor
        page.section('Account Information', section => {
            section.emailSetting("vesyncAccountEmail").name("VeSync Account Email").description("Email address of your VeSync account").required(true);
            section.passwordSetting("vesyncAccountPassword").name("VeSync Account Password").description("Password for your VeSync account").required(true);
        });
    },

    selectDevicesPage: async function(ctx, page, configData) {

        log.info("Select Devices Page, Config:\n" + JSON.stringify(configData));

        // Get VeSync API account and token information
        var accountEmail = configData.config.vesyncAccountEmail[0].stringConfig.value;
        var accountPassword = configData.config.vesyncAccountPassword[0].stringConfig.value;

        log.info(`VeSync account info: ${accountEmail} : ${accountPassword}`);

        log.info("Get API Credentials Page, Config:\n" + JSON.stringify(configData));

        page.name("Select devices");
        page.nextPageId("finalPage");
        page.previousPageId("mainPage");
        page.nextText("Next");
        page.complete(false);

        if(configData.config.vesyncAccountEmail == null){
            log.error("Calling Confirm Account page with invalid config");

            page.section('Error', section => {
                section.paragraphSetting('instructionalText')
                    .name('VeSync Account Error')
                    .description('Unable to find VeSync account information.  Please go to the previous step and try again');
            });

            return;
        }
        else {
            // Get VeSync API account and token information
            var accountEmail = configData.config.vesyncAccountEmail[0].stringConfig.value;
            var accountPassword = configData.config.vesyncAccountPassword[0].stringConfig.value;

            var accountId;
            var token;

            log.info(`VeSync account info: ${accountEmail} : ${accountPassword}`);

            return vesyncApi.getApiCredentials(accountEmail, accountPassword).then(function (resp) {
                log.info("VeSync GetApiCredentials response:\n" + JSON.stringify(resp));

                ({ accountId, token } = resp);

                // Store API credentials for use later
                return db.put(configData.installedAppId, "auth", { accountId: accountId, token: token });
            })
            .then(function(reply){
                log.info("DB put resp: " + JSON.stringify(reply), " credentials stored successfully");

                return vesync.getDevices(accountId, token);
            })
            .then(function(result){
                log.info("VeSync devices:\n" + JSON.stringify(result));

                if (result.total > 0) {

                    result.list.forEach(function (device) {

                        page.section('VeSync Device', section => {
                            section.booleanSetting('device:uuid:' + device.uuid + ':enabled')
                                .name(device.deviceName)
                                .description('Type of device: ' + device.deviceType + ', ' + device.type)
                                .image(device.deviceImg);
                            section.textSetting('device:uuid:' + device.uuid + ':label')
                                .name("deviceName")
                                .description('Name of the device')
                                .defaultValue(device.deviceName);
                        });

                    });
                }   
                else{
                    page.section('VeSync Devices', section => {
                        section.paragraphSetting('instructionalText')
                            .name('No Devices Found')
                            .description('No VeSync devices were found.  Please return the previous page to enter a different VeSync account, or check to ensure your device has been registered successfully with your VeSync account in the mobile app');
                    });

                    page.complete(true);
                }             

            })
            .catch(function(err){
                log.error("Error in SelectDevices page account and device lookup");
                log.error(err);

                page.section('Error', section => {
                    section.paragraphSetting('instructionalText')
                        .name('VeSync Error')
                        .description('Unable to retrieve list of devices from VeSync, please go to previous step and try again');
                });
            });

        }
        
    },

    finalPage:  async function(ctx, page, configData) {

        log.info("Final Page, Config:\n" + JSON.stringify(configData));
        var d, u, uuid, settingName;

        page.name("VeSync Devices");
        page.nextText("Finish");
        page.complete(true);
        page.nextPageId(null);
        page.previousPageId("selectDevicesPage");

        var devices = [];
        var deviceLabels = [];

        var p = new Promise((resolve, reject) => {
            
            try{
                for (const setting in configData.config) {

                    var settingVal = configData.config[setting];
                    log.info(`${setting}: ${settingVal}`);
        
                    if(setting.indexOf("device:uuid:") >= 0){
        
                         ([d, u, uuid, settingName] = setting.split(":"));
    
                         if(settingVal[0] == null){
                             log.warn("Bad setting");
                             return;
                         }
    
                         if(settingName == "enabled" && settingVal[0].stringConfig.value == "true"){
                             log.info(`${uuid} is being added...`);        
                             devices.push({uuid: uuid});
                         }
                         if(settingName == "label"){
                            log.info(`${settingVal[0].stringConfig.value} is being added...`);       
                            deviceLabels.push(settingVal[0].stringConfig.value);
                        }

                    }
                    else{
                        // ignore other settings
                    }
                }
            }
            catch(err){
                log.error("Unable to get device list from config data");
                log.error(err);
                reject(err);
                return;
            }            

            console.log('Register devices for: ' + JSON.stringify(devices));

            page.section('', section => {
                section.paragraphSetting('instructionalText')
                    .name('VeSync Devices')
                    .description(`${devices.length} total devices will be added to the selected Location.`);
            });

            resolve(devices);
        })
        .then(function(devices){

            log.info("Storing device list in persistent store: " + JSON.stringify(devices));

            var deviceUuids = [];
            devices.forEach(function(device){
                deviceUuids.push(device.uuid);
            })
            return db.put(configData.installedAppId, "deviceInfo", {"devices": deviceUuids.join(",")});
        })
        .then(function(reply){
            return db.put(configData.installedAppId, "deviceLabels", {"labels": deviceLabels.join(",")});
        })
        .catch(function(err){
            log.error(err);
        });

        return p;
    },

    setPublicUrl: function(url){
        publicUrl = url;
    }

};
