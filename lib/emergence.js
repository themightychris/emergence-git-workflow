function Site(options) {
    var site = this;

    if (!options || !options.hostname) {
        throw new Error('Hostname required');
    }

    site.hostname = options.hostname || 'localhost';
    site.useSSL = options.useSSL || false;

    site.request = require('request').defaults({
        baseUrl: site.getBaseUrl(),
        headers: {
            Accept: 'application/json',
            Authorization: options.token ? 'Token ' + options.token : ''
        },
        /**
         * In the future, request's forever: true option should enable keep alive, but the forever-agent
         * class it uses doesn't actually work without a wrapper like elasticsearch-js uses.
         * 
         * For now it seems best to use agentkeepalive which works out of the box rather than ship a copy
         * of the forever-agent wrapper, but in the future it would be nice if forever: true actually worked
         * by itself
         * 
         * Keepalive can be most easily verified by running wireshark and ensuring subsequent requests
         * come from the same source port, or use "follow TCP stream" to verify they're all in the same stream
         */
//        agentClass: require('forever-agent'), // forever-agent wrapper from request -- doesn't actually keepalive, at least for PUT requests
//        agentClass: require('./keep-alive-agent'), // forever-agent wrapper from elasticsearch-js -- keepalive seems to work, but no keepalive packets get fired
        agentClass: require('agentkeepalive'), // keepalive seems to work, but no keepalive packets get fired
        agentOptions: {
            maxSockets: 10,
            maxFreeSockets: 5,
            timeout: 120000,
            keepAliveTimeout: 60000
        }
    });
}

Site.prototype.getBaseUrl = function login() {
    return (this.useSSL ? 'https' : 'http') + '://' + this.hostname;
};

Site.prototype.login = function login(username, password, callback) {
    var site = this;

    site.request({
        method: 'POST',
        url: '/login',
        form: {
            '_LOGIN[returnMethod]': 'POST',
            '_LOGIN[username]': username,
            '_LOGIN[password]': password
        }
    }, function(error, response, body) {
        if (response.statusCode != 200) {
            if (typeof callback == 'function') {
                callback(new Error('Failed to login, got status code ' + response.statusCode));
            }
            return;
        }

        body = JSON.parse(body);
        if (!body || !body.success || !body.data) {
            if (typeof callback == 'function') {
                callback(new Error('Failed to parse login response'));
            }
            return;
        }

        site.request = site.request.defaults({
            headers: {
                Authorization: 'Token ' + body.data.Handle
            }
        });

        if (typeof callback == 'function') {
            callback(null, body.data);
        }
    });
};

exports.Site = Site;