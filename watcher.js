#!/usr/bin/env node

var emergence       = require('./lib/emergence'),
    fsevents        = require('fsevents'),
    fs              = require('fs'),
    extend          = require('util')._extend,
    getRelativePath = require('path').relative,
    RelPathList     = require('pathspec').RelPathList,
    async           = require('async'),
    colors          = require('colors/safe'),
    notifier        = require('node-notifier'),

    configPath = process.cwd() + '/.emergence-workspace.json',
    config          = {
        debug:      false,
        logIgnored: false,
        localDir:   '.',

        site: {
            ssl: false
        },

        ignore: {
            global: [],
            watch:  [],
            sync:   [],
            git:    [],
        },

        sound: {
            error:   'Basso',
            success: 'Submarine'
        }
    },

    ignoreList      = {},
    movedOut        = null,
    DEBUG           = false,
    drainSound = null,
    loadedConfig = null;


// Merge default configuration options with .emergence-workspace.json if present
if (fs.existsSync(configPath)) {
    loadedConfig = require(configPath);
    config = extend(config, loadedConfig);
}

var site = new emergence.Site(config.site);

// Build regular expressions from globs
for (var ignoreType in config.ignore) {
    ignoreList[ignoreType] = RelPathList.parse(config.ignore[ignoreType]);
}

function playSound(sound) {
    sound = sound || config.sound.success;
    require('child_process').spawn('afplay', ['/System/Library/Sounds/' + sound + '.aiff']);
}

function shouldIgnore(event, path) {
    var events = ['global'];

    if (typeof path !== 'string') {
        path = event;
    } else {
        events.push(event);
    }

    for (var x = 0, len = events.length; x < len; x++) {
        if (ignoreList[events[x]] && ignoreList[events[x]].matches(path)) {
            return true;
        }
    }

    if (event === 'sync') {
        // HACK: Do not try to sync files to the root directory
        return path.indexOf('/') === -1;
    }

    return false;
}

var watcher = fsevents(config.localDir),
    watcherLogStream;

if (config.watcherLog) {
    watcherLogStream = fs.createWriteStream(config.watcherLog, {flags: 'a'});
}


var q = async.queue(function (task, callback) {
    webDavRequest(task.verb, task.dst, task.src, function(err) {
        task.cb(err);
        callback();
    });
}, 1);

q.drain = function() {
    if (drainSound) {
        playSound(drainSound);
    }
};

function login(callback) {
    site.promptLogin(function(error, sessionData) {
        if (error) {
            callback(new Error('Login failed'));
        } else {
            // write new token to workspace config
            loadedConfig.site.token = sessionData.Handle;

            console.log('Login successful, writing new token to config: ' + configPath + '...');
            fs.writeFile(configPath, JSON.stringify(loadedConfig, null, '  '), callback);
        }
    });
}

function webDavRequest(verb, destination, file, callback) {
    var fileStream,
        request,
        headers = {};

    if (file) {
        if (/move/i.test(verb)) {
            headers['Destination'] = '/develop/' + destination;
            destination = file;
        } else {
            fileStream = fs.createReadStream(file);
            headers['Content-Length'] = fs.statSync(file).size;
        }
    }

    request = site.request({
        method: verb,
        url:    '/develop/' + destination,
        headers: headers
    }, function(error, response, body) {
        // retry after login for a 401
        if (response.statusCode == 401) {
            login(function(error) {
                if (error) {
                    callback(error);
                    return;
                }
 
                // retry request with original callback
                console.log('Config written, retrying request...');
                webDavRequest(verb, destination, file, callback);
            });
        // consider operation failed if status >= 400, with some exceptions..
        } else if (
            response.statusCode >= 400 &&
            !(verb === 'DELETE' && response.statusCode == 404) && // delete a file that doesn't exist
            !(verb === 'MKCOL' && response.statusCode == 405)  // make a directory that already exists
        ) {
            callback(new Error("HTTP " + verb + " failed with code " + response.statusCode + " for " + request.path));
        } else {
            callback();
        }
    });

    if (fileStream) {
        fileStream.pipe(request);
    } else {
        request.end();
    }
}

watcher.on('change', function (path, info) {
    var verb, src, dst, ignore,
        isDir = info.type === 'directory',
        relPath = getRelativePath(config.localDir, path);

    DEBUG && console.error(info);

    if (watcherLogStream) {
        watcherLogStream.write([
            Date.now(),
            info.id,
            info.event,
            info.type,
            Object.keys(info.changes).filter(function(key) { return info.changes[key]; }),
            path
        ].join('\t') + '\n');
    }

    // Add trailing slash to directories
    if (isDir) {
        path = path + '/';
        info.path = path;
        // HACK: fsevent is passing an unknown event for directory creation (deleted works)
        if (info.event === 'unknown') {
            // HACK: fsevent passes an unknown event for directory chowning
            if (info.changes.inode || info.changes.access || info.changes.xattrs || info.changes.finder) {
                console.warn('Ignoring chown/chmod to: ' + path);
                DEBUG && console.log(info);
                return;
            }
            info.event = 'created';
        }
    }

    dst = relPath;
    ignore = shouldIgnore('watch', relPath);

    switch (info.event) {
        case 'modified':
        case 'created':
            verb = isDir ? 'MKCOL' : 'PUT';
            src = path;
            break;
        case 'deleted':
            verb = 'DELETE';
            dst = null;
            break;
        case 'moved-in':
            if (movedOut) {
                dst = relPath;
                src = relPath = getRelativePath(config.localDir, movedOut);
                movedOut = null;
                verb = 'MOVE';
            } else {
                console.log(colors.yellow('[WARNING] moved-in event caught without moved-out pending, doing put for ' + relPath));
                verb = 'PUT';
                src = path;
            }
            break;
        case 'moved-out':
            movedOut = path;
            break;
    }

    if (verb) {
        // Do not log ignored watch events if logIgnored is false
        if (ignore && config.logIgnored === false) {
            return;
        }

        if (verb === 'MKCOL' || verb === 'DELETE') {
            path = relPath;
            dst = path;
            src = null;
        }

        // File was ignored in either global or watch
        if (ignore) {
            console.log((ignore ? colors.yellow('[IGNORED] ') : '') + verb + ': ' + relPath + (dst != relPath ? ' -> ' + dst : ''));
            return;
        }

        // TODO: Memoize should ignore
        if (!shouldIgnore('sync', relPath)) {
            q.push({
                verb: verb, dst: dst, src: src, cb: function (err) {
                    if (err) {
                        playSound(config.sound.error);
                        console.log(colors.red('[FAILED] ') + verb + ': ' + relPath + (dst != relPath ? ' -> ' + dst : '') + ' (' + err + ')');
                        return;
                    }

                    drainSound = (drainSound === null) ? config.sound.success : drainSound;
                    console.log(colors.green('[SUCCESS] ') + verb + ': ' + relPath + (dst != relPath ? ' -> ' + dst : ''));
                }
            });
        }
    }

});

function startWatching() {
    watcher.start();
}

// verify session before watching
if (!config.site.token) {
    // no token, definitely need to login
    login(function(error) {
        if (error) {
            throw error;
        }

        startWatching();
    });
} else {
    // test authentication
    site.request.get('/develop', function(error, response, body) {
        if (response.statusCode == 200) {
            startWatching();
        } else if (response.statusCode == 401) {
            playSound(config.sound.error);
            console.log('Token expired, login required');
            login(function(error) {
                if (error) {
                    throw error;
                }
        
                startWatching();
            });
        } else {
            throw new Error('Failed to connect to site, statusCode='+response.statusCode);
        }
    });
}

// TODO: This is an anti-pattern, but ok for what we're using it for
process.on('uncaughtException', function(err) {
    require('child_process').exec("say -v Boing \"I'm sorry Dave, I'm afraid I can't do that\"");

    notifier.notify({
        'title': 'Emergence-watcher',
        'message': 'The watcher has crashed with an uncaught exception:\n' + err
    });
});
