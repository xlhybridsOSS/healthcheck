var http = require("http");
var Agent = http.Agent;
var https = require("https");
var url = require("url");
var getDefer = function() {
    var deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
};

var HEALTH_STATE = [
    "OK",                                      // 0. HEALTH_OK
    "Malformed header",                        // 1. HEALTH_BAD_HEADER
    "Bad status line.  Maybe not HTTP",        // 2. HEALTH_BAD_STATUS
    "Bad HTTP body contents",                  // 3. HEALTH_BAD_BODY
    "Internal error.  Bad healthcheck state",  // 4. HEALTH_BAD_STATE
    "Error reading contents.  Bad connection", // 5. HEALTH_BAD_CONN
    "Non 200 HTTP status code",                // 6. HEALTH_BAD_CODE
    "Healthcheck timed out",                   // 7. HEALTH_TIMEOUT
    "Contents could not fit read buffer",      // 8. HEALTH_FULL_BUFFER
    "Connection closed early"                  // 9. HEALTH_EARLY_CLOSE
];

var single;

exports.init = function(opts) {
    if (single) {
        return single;
    } else {
        single = new HealthCheck(opts);
        return single;
    }
};

exports.is_down = function(name) {
    var hc = single ? single.healthchecks_arr[name] : null;
    if (hc) {
        return hc.down;
    } else {
        return new Error("healthcheck: Invalid index to is_down: " + name);
    }
};

exports.status = function() {
    return single ? single.healthchecks_arr : {};
};


exports.HealthCheck = HealthCheck;

function HealthCheck(inopts) {
    const defaults = {
        failthreshold: 2,
        passthreshold: 2,
        timeout: 2000,
        delay: 10000,
        servers: [],
    }
    const opts = {...defaults, ...inopts};
    var self = this;
    this.healthchecks_arr = {};
    
    if (opts.servers.length > 0) {
        this.agent = new Agent({ keepAlive: true, timeout: opts.timeout })

        opts.servers.forEach(function(s) {
            self.healthchecks_arr[s] = {
                action_time: null,
                down: false,
                failcount: 0,
                passcount: 0,
                last_status: "",
                owner: process.pid,
                since: null
            };
        });

        delete opts.servers;
        this.opts = opts;
        this.check();
        setInterval(function() {
            // TODO: don't have overlapping checks for the same server
            self.check();
        }, opts.delay);
    }
}

HealthCheck.prototype.check = async function() {
    var servers = Object.keys(this.healthchecks_arr);
    var opts = this.opts;
    var self = this;

    var checks = servers.map(function(s) {
        var time = new Date();
        var hc = self.healthchecks_arr[s];
        if (!hc.since) hc.since = time;
        hc.action_time = time;

        var u = url.format({
            protocol: (opts.https ? 'https:' : 'http:'),
            host: s,
            pathname: (opts.path || "/")
        });
        u = url.parse(u);

        var library = opts.https ? https : http;
        var req = library.get({
            host: u.hostname,
            port: u.port,
            agent: self.agent,
            path: u.pathname
        });
        
        return new Promise((resolve, reject) => {
            req.on('response', (res) => {
                if(opts.expected && res.statusCode === 200) {
                    let bod = Buffer.alloc(0);
                    res.on('data', (d) => {
                        bod = Buffer.concat([bod, d])
                    });
                    res.on('end', () => {
                        if(bod.equals(opts.expected)) {
                            resolve(1);
                        } else {
                            resolve(-1);
                        }
                    })
                    res.on('error', (e) => reject(e))
                } else if (res.statusCode === 200) {
                    resolve(1);
                } else {
                    resolve(-1);
                }
            })
            req.on('timeout', () => resolve(-1));
            req.on('error', (e) => reject(e));
        }).then((passfail) => {
            if (passfail < 0) {
                hc.failcount = Math.max(hc.failcount + 1, opts.failthreshold);
                hc.passcount = 0;
                if (!hc.down && hc.failcount >= opts.failthreshold) {
                    hc.down = true;
                    if (opts.onFail) opts.onFail.bind({})(s);
                }
            } else {
                hc.passcount = Math.max(hc.passcount + 1, opts.passthreshold);
                hc.failcount = 0;
                if (hc.down && hc.passcount >= opts.passthreshold) {
                    hc.down = false;
                    if (opts.onPass) opts.onPass.bind({})(s);
                }
            }
        }).catch((e) => {
            hc.failcount = Math.max(hc.failcount + 1, opts.failthreshold);
            hc.passcount = 0;
            if (!hc.down && hc.failcount >= opts.failthreshold) {
                hc.down = true;
                if (opts.onFail) opts.onFail.bind({})(s);
            }
        })
    });
    return Promise.all(checks).finally(() => {
        if (opts.logger) opts.logger(self.healthchecks_arr);
    });
}

HealthCheck.prototype.is_down = function(name) {
    var hc = this.healthchecks_arr[name];
    if (hc) {
        return hc.down;
    } else {
        return new Error("healthcheck: Invalid index to is_down: " + name);
    }
};

HealthCheck.prototype.status = function() {
    return this.healthchecks_arr;
};
