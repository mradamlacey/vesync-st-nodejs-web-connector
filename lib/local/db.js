"use strict"

const redis = require("redis");
const config = require('config');
const log = require("./log");
const redisClient = redis.createClient({host: config.get('redis.host'), port: config.get('redis.port')});

function key(installedAppId) {
	return "vesync:" + installedAppId;
}

redisClient.on("error", function(err){

	log.error("~~~");
	log.error("Error from Redis client:");
	log.error(err);
	log.error("~~~");

	//throw err;
});

/**
 * Redis-based storage and retrival of account data
 */
module.exports = {

	/**
	 * Saves data map associated with an installed instance of the app
	 */
	put: function(installedAppId, name, map) {

		var partialKey = `${installedAppId}:${name}`;

		log.info(`DB Put ${partialKey}`);

		let args = [key(partialKey)];
		for (let key in map) {
			if (map.hasOwnProperty(key)) {
				args.push(key);
				args.push(map[key]);
			}
		}

		var p = new Promise((resolve, reject) => {
			redisClient.hmset(args, function(err, reply) {
				if (err) {
					console.log("REDIS ERROR " + JSON.stringify(err));
					reject(err);
				}
				else{
					resolve(reply);
				}
	
			});
		});

		return p;
	},

	/**
	 * Delete the entry
	 */
	delete: function(installedAppId, name) {

		var partialKey = `${installedAppId}:${name}`;

		log.info(`DB Delete ${partialKey}`);

		var p = new Promise((resolve, reject) => {
			redisClient.del(key(partialKey), function(err, reply) {
				if (err) {
					console.log("REDIS ERROR " + JSON.stringify(err));
					reject({code:1, error: err});
				}
				else {
					resolve({code:0, response: reply});
				}
			});
		});

		return p;
	},

	/**
	 * Gets the entry for an installed app instance
	 */
	get: function(installedAppId, name) {

		var partialKey = `${installedAppId}:${name}`;

		log.info(`DB Get ${partialKey}`);

		var p = new Promise((resolve, reject) => {
			redisClient.hgetall(key(partialKey), function(err, reply) {
				if (err) {
					console.log("REDIS ERROR " + JSON.stringify(err));
					reject(err);
				}
				else {
					resolve(reply);
				}
			});
		});



		return p;
	}
};
