"use strict";

const log = require('../local/log');
const config = require('config');
const SmartApp = require('@smartthings/smartapp');


module.exports = {

    defaultDeviceCommandHandler: function(ctx, deviceId, cmd){
        log.warn(`Unhandled command - Device id: ${deviceId}, command: ${cmd}, Context:\n`);
        log.warn(JSON.stringify(ctx));
    },

    splashPage: function (ctx, page, configData) {

        page.name("VeSync Connector");
        page.nextPageId("mainPage");
        page.style("SPLASH");
        page.nextText("Next");
        page.complete(false);

    },

    mainPage: function (ctx, page, configData) {

        page.name("VeSync Account Information");
        page.style("NORMAL");
       // page.nextPageId("selectDevicesPage");
       // page.previousPageId("splashPage");
       // page.nextText("Next");
        page.complete(true);

        // prompts user to select a contact sensor
        page.section('Account Information', section => {
            section.emailSetting("VeSync Account Email").name("vesyncAccountEmail").description("Email address of your VeSync account").required(true);
            section.passwordSetting("VeSync Account Password").name("vesyncAccountPassword").description("Password for your VeSync account").required(true);
        });
    },

    selectDevicesPage: function (ctx, page, configData) {

        page.name("Select devices");
        page.nextPageId("finalPage");
        page.previousPageId("mainPage");
        page.nextText("Next");
        page.complete(false);

        // prompts user to select a contact sensor
        page.section('types', section => {
            section.booleanSetting('scenes')
            section.booleanSetting('switches')
            section.booleanSetting('locks')
        });
    },

    finalPage: function (ctx, page, configData) {

        page.name("Confirm VeSync Devices");
        page.nextText("Finish");
        page.complete(true);
        page.nextPageId(null);
        page.previousPageId(null);

    },

    appInstallHandler: function(ctx, installData){
        log.info("Update data:\n"+ JSON.stringify(installData));

        // Store token and account id in persistent store, store device id/types that are subscribed to
    },

    appUpdatedHandler: function(ctx, updateData){
        log.info("Update data:\n"+ JSON.stringify(updateData));

        // Store token and account id in persistent store, store device id/types that are subscribed to
    },

    appUninstallHandler: function(ctx, uninstallData){
        log.info("Uninstall data:\n"+ JSON.stringify(uninstallData));

        // Remove token, account and device ids from persistent store
    },

    subscribedDeviceEventHandler: function(ctx, callback){

    },

    subscribedDeviceLifecycleEventHandler: function(ctx, callback){

    }

};
