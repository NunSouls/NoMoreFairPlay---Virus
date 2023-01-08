"use strict";

const ms = require("ms");
const chalk = require("chalk");
const startTime = Date.now();
const { timings } = require("./config.json");

let totalCrashes = 0;
let accountBans = 0;

module.exports.updateTotalCrashes = () => {
    totalCrashes++;
    statsMessage();
};

module.exports.updateAccountBans = () => {
    accountBans++;
    statsMessage();
};

function statsMessage() {
    const uptime = ms(Date.now() - startTime, { long: true });
	
	process.stdout.write(`NoMoreFairPlay | ` + chalk.yellowBright(`Total Crashes: `) + chalk.green(totalCrashes) + chalk.yellowBright(` - Account Bans: `) + chalk.red(accountBans) + "\r");
    process.title = `NoMoreFairPlay // created by ussr (discord id: 952810893698301973) | Uptime: ${uptime} - Total Crashes: ${totalCrashes}`;
}

setInterval(() => {
	const uptime = ms(Date.now() - startTime, { long: true });
	process.title = `NoMoreFairPlay // created by ussr (discord id: 952810893698301973) | Uptime: ${uptime} - Total Crashes: ${totalCrashes}`;
}, timings.ms_update_title_delay);