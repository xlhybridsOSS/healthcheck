var Promise = require('es6-promise').Promise;
var http = require("http");
var https = require("https");

var HEALTH_STATE = [
    "OK",                                      // HEALTH_OK
    "Malformed header",                        // HEALTH_BAD_HEADER
    "Bad status line.  Maybe not HTTP",        // HEALTH_BAD_STATUS
    "Bad HTTP body contents",                  // HEALTH_BAD_BODY
    "Internal error.  Bad healthcheck state",  // HEALTH_BAD_STATE
    "Error reading contents.  Bad connection", // HEALTH_BAD_CONN
    "Non 200 HTTP status code",                // HEALTH_BAD_CODE
    "Healthcheck timed out",                   // HEALTH_TIMEOUT
    "Contents could not fit read buffer",      // HEALTH_FULL_BUFFER
    "Connection closed early"                  // HEALTH_EARLY_CLOSE
];


var healthchecks_arr = {};

exports.init = function(opts) {
    if (opts && opts.servers && opts.servers.length > 0) {
        if (opts.delay === undefined) opts.delay = 10000;
        if (opts.failcount === undefined) opts.failcount = 2;
        if (opts.timeout === undefined) opts.timeout = 2000;

        opts.servers.forEach(function(s) {
            healthchecks_arr[s] = {
                action_time: null,
                concurrent: 0,
                down: false,
                down_code: 0,
                failcount: 0,
                owner: process.pid,
                since: null
            };
        });

        delete opts.servers;
        this.opts = opts;
    }

    return null;
};

exports.is_down = function(name) {
    var hc = healthchecks_arr[name];
    if (hc) {
        return hc.down;
    } else {
        return new Error("healthcheck: Invalid index to is_down: " + name);
    }
};

exports.status = function() {
    return healthchecks_arr;
};

function check() {
    var servers = Object.keys(healthchecks_arr);

    servers.forEach(function(s) {
    });
}
