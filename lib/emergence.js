var KeepaliveAgent = require('agentkeepalive');


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
        pool: new KeepaliveAgent({
            maxSockets: 100,
            maxFreeSockets: 10,
            timeout: 120000,
            keepAliveTimeout: 60000
        })
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