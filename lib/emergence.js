var restler = require('restler'),
    request = require('request');

function Manager(host, port, username, password, scheme) {
    this.host = host || '127.0.0.1';
    this.port = port || 9083;
    this.username = username || 'admin';
    this.password = password || 'admin';
    this.scheme = scheme || 'http';
}

Manager.prototype.getSites = function getSites(cb) {
    restler.get(this.scheme + '://' + this.host + ':' + this.port + '/sites', {
        username: this.username,
        password: this.password
    }).on('complete', function(data) {
        var err = (data instanceof Error) ? data : null,
            sites = err ? null : data.data;

        if (typeof cb === 'function') {
            cb(err, sites);
        }
    });
};


Manager.prototype.createSite = function createSite(options, cb) {
    options = options || {};

    var siteData = {
        create_user: {
            Username:  options.username  || '',
            Password:  options.password  || '',
            Email:     options.email     || '',
            FirstName: options.firstName || '',
            LastName:  options.lastName  || ''
        },

        handle:           options.handle          || '',
        hostnames:        options.hostnames       || '',
        inheritance_key:  options.inheritanceKey  || '',
        label:            options.label           || '',
        parent_hostname:  options.parentHostname  || 'skeleton.emr.ge',
        parent_key:       options.parentKey       || '8U6kydil36bl3vlJ',
        primary_hostname: options.primaryHostname || '',
        user_username:    options.username        || ''
    };

    restler.postJson(this.scheme + '://' + this.host + ':' + this.port + '/sites', siteData, {
        username: this.username,
        password: this.password
    }).on('complete', function(data, response) {
        var err = (data instanceof Error) ? data : null,
            site = err ? false : new Site({
                username: siteData.create_user.Username,
                password: siteData.create_user.Password,
                hostname: siteData.primary_hostname
            });

        if (typeof cb === 'function') {
            cb(err, site);
        }
    });
};

function Site(options) {
    options = options || {};

    this.username = options.username || null;
    this.password = options.password || null;
    this.hostname = options.hostname || 'localhost';
    this.scheme   = options.scheme   || 'http';
    this.loggedIn = false;
    this.cookieJar = request.jar();
    this.request = request.defaults({jar: this.cookieJar});

    if (!(this.username && this.password && this.hostname && this.scheme)) {
        throw new Error('Invalid site');
    }
}

Site.prototype.login = function login(cb) {
    var site = this;

    this.request.post(this.scheme + '://' + this.hostname + '/login', {
        form: {
            '_LOGIN[returnMethod]': 'POST',
            '_LOGIN[username]': this.username,
            '_LOGIN[password]': this.password
        }
    }, function(error, response, body) {
        site.loggedIn = !error;

        if (typeof cb === 'function') {
            cb(error, site.loggedIn);
        }
    });
};

Site.prototype.precache = function precache(cb) {
    var site = this;

    if (!this.loggedIn) {
        throw new Error ('precache requires you to login first');
    }

    this.request(this.scheme + '://' + this.hostname + '/site-admin/precache', function(error, response, body) {
        console.log(response);
    });
};

exports.Manager = Manager;

exports.skeletons = {
    "skeleton.emr.ge": {
        "key": "8U6kydil36bl3vlJ",
        "repo": null
    },

    "skeleton-v2.emr.ge": {
        "key":  "lKhjNhwXoM8rLbXw",
        "repo": "git@github.com:JarvusInnovations/Emergence-Skeleton.git"
    },

    "v1.slate.is": {
        "key": "o9B11mbIXY1proH7",
        "repo": "git@github.com:SlateFoundation/slate.git"
    },

    "cbl.v1.slate.is": {
        "key": "SFiBIoNdy5tH5znR",
        "repo": "git@github.com:SlateFoundation/slate-cbl.git"
    },

    "v1.laddr.io": {
        "key": "MaPG1YxorgU6ew64",
        "repo": null
    }
};
