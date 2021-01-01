'use strict';

const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const config = require('config');
const fs = require('fs');
const path = require('path')

const SmartApp = require('@smartthings/smartapp');

const ngrok = require('ngrok');

const db = require('./lib/local/db');
const log = require('./lib/local/log');
const vesyncSmartApp = require('./lib/smartapp/vesync-smartapp');

const appId = config.get('connector.appId');
const clientId = config.get('connector.clientId');
const clientSecret = config.get('connector.clientSecret');

const port = process.env.PORT || 3000;

const publicTunnelEnabled = config.get("publicTunnel.enabled");
const publicTunnelSubdomain = config.get("publicTunnel.subdomain");
const publicTunnelAuthtoken = config.get("publicTunnel.authtoken");

(async function () {

    var url = "http://localhost:3000";

    if(publicTunnelEnabled){
        url = await ngrok.connect({
            proto: 'http', // http|tcp|tls, defaults to http
            addr: port, // port or network address, defaults to 80
            subdomain: publicTunnelSubdomain,
            authtoken: publicTunnelAuthtoken
        });

        console.log(`\nngrok URL -- :\n${url}\n`);
    }
    else{
        log.info("Not starting public tunnel");
    }

    var redirectUri =  `${url}/oauth/callback`;

    /*
     * Thew SmartApp. Provides an API for making REST calls to the SmartThings platform and
     * handles calls from the platform for subscribed events as well as the initial app registration challenge.
     */
    const smartThingsConnectorApp = new SmartApp()
        .appId(appId)
        .clientId(clientId)
        .clientSecret(clientSecret)
        .enableEventLogging(4, true)
        .disableCustomDisplayName(true)
        .disableRemoveApp(true)
        .permissions([/*'r:devices:*', 'w:devices:*', 'x:devices:*',*/ "i:deviceprofiles*"])
    //  .redirectUri(redirectUri)
        .defaultDeviceCommandHandler(vesyncSmartApp)
      //  .firstPageId("splashPage")
       // .page("splashPage", vesyncSmartApp.splashPage)
        .page("mainPage", vesyncSmartApp.mainPage)
     //   .page("selectDevicesPage", vesyncSmartApp.selectDevicesPage)
      //  .page("finalPage", vesyncSmartApp.finalPage)
        .installed(vesyncSmartApp.appInstallHandler)
        .updated(vesyncSmartApp.appUpdatedHandler)
        .uninstalled(vesyncSmartApp.appUninstallHandler)
        .subscribedDeviceEventHandler(vesyncSmartApp.subscribedDeviceEventHandler)
        .subscribedDeviceLifecycleEventHandler(vesyncSmartApp.subscribedDeviceLifecycleEventHandler)
        .unhandledRejectionHandler(function(reason){
            log.error("Unhandled error");
            log.error(reason);
        })

    /*
    * Webserver setup
    */
    const server = express()
    server.use(logger('dev'))
    server.use(express.json())
    server.use(express.urlencoded({ extended: false }))

    /*
    * Handles calls to the SmartApp from SmartThings, i.e. registration challenges and device events
    */
    server.post('/', async (req, res) => {
        smartThingsConnectorApp.handleHttpCallback(req, res);
    });

    /**
    * Start the HTTP server and log URLs. Use the "open" URL for starting the OAuth process. Use the "callback"
    * URL in the API app definition using the SmartThings Developer Workspace.
    */
    server.listen(port);
    console.log(`\nWebsite URL -- Use this URL to log into SmartThings and connect this app to your account:\n${url}\n`);
    console.log(`Redirect URI -- Copy this value into the "Redirection URI(s)" field in the Developer Workspace:\n${redirectUri}`);


})();

