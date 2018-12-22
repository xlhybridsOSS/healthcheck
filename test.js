var dateformat = require('dateformat');
var HealthCheck = require("./").HealthCheck;
var Table = require('cli-table');

new HealthCheck({
    servers: [
        'google.com',
        'localhost:3000'
    ],
    // https: true,
    delay: 2000,
    send: '/images/ugc/ucenter/login-logo.png',
    onFail: function(server) {
        console.log("failed: "+server)
    },
    onPass: function(server) {
        console.log("passed: "+server)
    },
    logger: function(list) {
        var table = new Table({
            head: ['name', 'owner pid', 'action time', 'since', "status", 'is down?']
        });
        var servers = Object.keys(list);

        servers.forEach(function(s) {
            var hc = list[s];
            var action_time = dateformat(hc.action_time, 'HH:MM:ss');
            var since = dateformat(hc.since, 'HH:MM:ss');
            table.push([s, hc.owner, action_time, since, hc.last_status, hc.down]);
        });
        console.log(table.toString());
    }
});
