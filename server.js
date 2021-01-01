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

//const publicKey = fs.readFileSync('./config/smartthings_rsa.pub', 'utf8');
const httpSignature = require('http-signature');

//const configurationLifecycle = require('./lib/lifecycle/configuration');
//const oauthLifecycle = require('./lib/lifecycle/oauth');
//const crudLifecycle = require('./lib/lifecycle/crud');
//const eventLifecycle = require('./lib/lifecycle/event');

const appId = config.get('connector.appId');
const clientId = config.get('connector.clientId');
const clientSecret = config.get('connector.clientSecret');
//const serverUrl = config.get('connector.serverUrl');
const port = process.env.PORT || 3000;
//const redirectUri =  `${serverUrl}/oauth/callback`;

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
   // server.set('views', path.join(__dirname, 'views'))
    //server.set('view engine', 'ejs')
    server.use(logger('dev'))
    server.use(express.json())
    server.use(express.urlencoded({ extended: false }))
    //server.use(express.static(path.join(__dirname, 'public')))

    /*
    * Handles calls to the SmartApp from SmartThings, i.e. registration challenges and device events
    */
    server.post('/', async (req, res) => {
        smartThingsConnectorApp.handleHttpCallback(req, res);
    });


    /*
    * Handles OAuth redirect
    */
    server.get('/oauth/callback', async (req, res) => {

        // Store the SmartApp context including access and refresh tokens. Returns a context object for use in making
        // API calls to SmartThings
        const ctx = await smartThingsConnectorApp.handleOAuthCallback(req)

        // Remove any existing subscriptions and subscribe to device switch events
        await ctx.api.subscriptions.unsubscribeAll()
        await ctx.api.subscriptions.subscribeToCapability('switch', 'switch', 'switchHandler');

        // Get the location name (for display on the web page)
        const location = await ctx.api.locations.get(ctx.locationId)

        // Set the cookie with the context, including the location ID and name
        req.session.smartThings = {
            locationId: ctx.locationId,
            locationName: location.name,
            installedAppId: ctx.installedAppId
        }

        // Redirect back to the main page
        res.redirect('/')

    })

    function handleCallback(req, response) {
        let evt = req.body;
        switch (evt.lifecycle) {

            // DEPRECATED!!!
            // PING happens during app creation. Respond with challenge to verify app
            case 'PING': {
                log.trace(`${evt.lifecycle}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                log.response(response, { statusCode: 200, pingData: { challenge: evt.pingData.challenge } });
                break;
            }

            // CONFIRMATION happens during registration of application to verify
            case 'CONFIRMATION':
                log.trace(`${evt.lifecycle}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                log.response(response, { statusCode: 200, confirmationUrl: { challenge: evt.confirmationData.confirmationUrl } });
                break;

            // CONFIGURATION is once with INITIALIZE and then for each PAGE
            case 'CONFIGURATION': {
                let configurationData = evt.configurationData;
                switch (configurationData.phase) {
                    case 'INITIALIZE':
                        log.trace(`${evt.lifecycle}/${configurationData.phase}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                        configurationLifecycle.initialize(configurationData, response);
                        break;
                    case 'PAGE':
                        log.trace(`${evt.lifecycle}/${configurationData.phase}/${configurationData.pageId}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                        configurationLifecycle.page(configurationData, response);
                        break;
                    default:
                        throw new Error(`Unsupported config phase: ${configurationData.phase}`);
                }
                break;
            }

            case 'OAUTH_CALLBACK': {
                log.trace(`${evt.lifecycle}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                log.debug(JSON.stringify(evt));
                oauthLifecycle.handleOauthCallback(evt.oauthCallbackData);
                log.trace(`RESPONSE: ${JSON.stringify(evt, null, 2)}`);
                log.response(response, { statusCode: 200, oAuthCallbackData: {} });
                break;
            }

            case 'INSTALL': {
                log.trace(`${evt.lifecycle}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                crudLifecycle.install(evt.installData);
                log.trace(`RESPONSE: ${JSON.stringify(evt, null, 2)}`);
                log.response(response, { statusCode: 200, installData: {} });
                break;
            }

            case 'UPDATE': {
                log.trace(`${evt.lifecycle}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                crudLifecycle.update(evt.updateData);
                log.trace(`RESPONSE: ${JSON.stringify(evt, null, 2)}`);
                log.response(response, { statusCode: 200, updateData: {} });
                break;
            }

            case 'UNINSTALL': {
                log.trace(`${evt.lifecycle}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                crudLifecycle.uninstall(evt.uninstallData);
                log.trace(`RESPONSE: ${JSON.stringify(evt, null, 2)}`);
                log.response(response, { statusCode: 200, uninstallData: {} });
                break;
            }

            case 'EVENT': {
                log.trace(`${evt.lifecycle}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                evt.eventData.events.forEach(function (event) {
                    switch (event.eventType) {
                        case "DEVICE_EVENT": {
                            break;
                        }
                        case "TIMER_EVENT": {
                            eventLifecycle.handleScheduledEvent(evt.eventData, event);
                            break;
                        }
                        case "DEVICE_COMMANDS_EVENT": {
                            eventLifecycle.handleDeviceCommand(evt.eventData, event);
                            break;
                        }
                        default: {
                            console.warn(`Unhandled event of type ${event.eventType}`)
                        }
                    }
                });
                log.response(response, { statusCode: 200, eventData: {} });
                break;
            }

            case 'EXECUTE': {
                log.trace(`${evt.lifecycle}\nREQUEST: ${JSON.stringify(evt, null, 2)}`);
                break;
            }


            default: {
                console.log(`Lifecycle ${evt.lifecycle} not supported`);
            }
        }
    }

    /**
    * Start the HTTP server and log URLs. Use the "open" URL for starting the OAuth process. Use the "callback"
    * URL in the API app definition using the SmartThings Developer Workspace.
    */
    server.listen(port);
    console.log(`\nWebsite URL -- Use this URL to log into SmartThings and connect this app to your account:\n${url}\n`);
    console.log(`Redirect URI -- Copy this value into the "Redirection URI(s)" field in the Developer Workspace:\n${redirectUri}`);


})();

