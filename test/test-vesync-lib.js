var expect = require('chai').expect;
var assert = require('chai').assert;
var vesync = require('../lib/api/vesync');
var config = require('config');

const accountEmail = process.env.VESYNC_ACCOUNT_EMAIL;
const accountPassword = process.env.VESYNC_ACCOUNT_PASSWORD;
const vesyncAccountId = process.env.VESYNC_ACCOUNT_ID;
const vesyncToken = process.env.VESYNC_TOKEN;

describe("Test Suite", function () {

    this.timeout(10000);

    it('Default test', function (done) {
        expect(true).to.equal(true);
        done();
    });

    it('Get VeSync API Credentials', function (done) {

        var p = vesync.getApiCredentials(accountEmail, accountPassword);
        
        expect(p).to.not.be.null;

        p.then(
            function (res) {
                console.log(res.accountId +  ", " + res.token);

                expect(res.accountId, "Account Id: " + res.accountId).to.not.be.undefined;
                expect(res.token,"Token: " + res.token).to.not.be.undefined;
                done();
            })
            .catch(function(err){
                console.log(err);
                assert.fail(err, null, "Request failed, err: " + JSON.stringify(err));
            });

    });

    it('VeSync List devices', function (done) {

        var p = vesync.getDevices(vesyncAccountId, vesyncToken);

        expect(p).to.not.be.null;

        p.then(
            function (res) {
                console.log("Total in list: " + res.total);

                expect(res.total, "Total: " + res.total).to.not.be.undefined;
                expect(res.list, "List: " + res.token).to.not.be.undefined;
                done();
            })
            .catch(function(err){
                console.log(err);
                assert.fail(err, null, "Request failed, err: " + JSON.stringify(err));
            });
    });

    it('VeSync Get Air Purifier info', function (done) {

        // Find the first air purifier in the list and get info for it
        vesync.getDevices(vesyncAccountId, vesyncToken)
            .then(function(res){
                for(var i = 0; i < res.list.length; i++){
                    // "type": "wifi-air",
                    if(res.list[i].type == "wifi-air"){

                        var p = vesync.getAirPurifierInfo(vesyncAccountId, vesyncToken, res.list[i].uuid);

                        expect(p).to.not.be.null;
                        
                        p.then(
                            function (res) {
               
                                expect(res.deviceName, "Device Name: " + res.deviceName).to.not.be.null;
                                done();
                            })
                            .catch(function(err){
                                console.log(err);
                                assert.fail(err, null, "Request failed, err: " + JSON.stringify(err));
                            });

                    }
                }
            });


    });

});