#!/usr/bin/env node

var emergence       = require('./lib/emergence'),
    fsevents        = require('fsevents'),
    fs              = require('graceful-fs'),
    path            = require('path'),
    extend          = require('util')._extend,
    RelPathList     = require('pathspec').RelPathList,
    async           = require('async'),
    colors          = require('colors/safe'),
    notifier        = require('node-notifier'),
    _               = require('underscore'),
    inquirer        = require('inquirer'),
    mkdirp          = require('mkdirp'),
    async           = require('async'),

    workingPath = process.cwd(),
    configPath = workingPath + '/.emergence-workspace.json',
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

            console.log('Login successful, writing new token ' + sessionData.Handle + ' to config: ' + configPath + '...');
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

watcher.on('change', function (filePath, info) {
    var verb, src, dst, ignore,
        isDir = info.type === 'directory',
        relPath = path.relative(config.localDir, filePath);

    DEBUG && console.error(info);

    if (watcherLogStream) {
        watcherLogStream.write([
            Date.now(),
            info.id,
            info.event,
            info.type,
            Object.keys(info.changes).filter(function(key) { return info.changes[key]; }),
            filePath
        ].join('\t') + '\n');
    }

    // Add trailing slash to directories
    if (isDir) {
        filePath = filePath + '/';
        info.path = filePath;
        // HACK: fsevent is passing an unknown event for directory creation (deleted works)
        if (info.event === 'unknown') {
            // HACK: fsevent passes an unknown event for directory chowning
            if (info.changes.inode || info.changes.access || info.changes.xattrs || info.changes.finder) {
                console.warn('Ignoring chown/chmod to: ' + filePath);
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
            src = filePath;
            
            // TODO: ignore if matches cached remote hash?
            break;
        case 'deleted':
            verb = 'DELETE';
            dst = null;
            break;
        case 'moved-in':
            if (movedOut) {
                dst = relPath;
                src = relPath = path.relative(config.localDir, movedOut);
                movedOut = null;
                verb = 'MOVE';
            } else {
                verb = 'PUT';
                src = filePath;
            }
            break;
        case 'moved-out':
            movedOut = filePath;
            break;
    }

    if (verb) {
        // Do not log ignored watch events if logIgnored is false
        if (ignore && config.logIgnored === false) {
            return;
        }

        if (verb === 'MKCOL' || verb === 'DELETE') {
            filePath = relPath;
            dst = filePath;
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

function checkIntegrity(callbackCheckIntegrity) {
    console.log('Fetching remote file index...');
    site.request.get('/emergence', function(error, response, body) {
        console.log('Parsing remote file index...');
        var remoteTree = JSON.parse(body),
            remoteFilePaths = Object.keys(remoteTree.files),
            localRootCollections = fs.readdirSync('.').filter(function(localRootPath) {
                return localRootPath != '.git' && fs.lstatSync(localRootPath).isDirectory();
            });
        
        // trim remote files and ignored files
        // TODO: filter remote files at server side in /emergence call
        remoteFilePaths = remoteFilePaths.filter(function(remoteFilePath) {
            return remoteTree.files[remoteFilePath].Site == 'Local' && !shouldIgnore('sync', remoteFilePath);
        });
        console.log('Enumerated ' + remoteFilePaths.length + ' remote files.');

        require('child_process').execFile('find', localRootCollections.concat(['-type', 'f']), function(err, stdout, stderr) {
            var localFilePaths = stdout.trim().split('\n').filter(function(localFilePath) {
                    return !shouldIgnore('sync', localFilePath);
                }),
                needsUpload = _.difference(localFilePaths, remoteFilePaths),
                needsDownload = _.difference(remoteFilePaths, localFilePaths),
                needsResolve = []; // TODO: detect different

            if (needsUpload.length + needsDownload.length + needsResolve.length) {
                console.log(
                    needsUpload.length + ' new files need to be uploaded, ' +
                    needsDownload.length + ' new files need to be downloaded, ' +
                    needsResolve.length + ' conflicting files need to be resolved'
                );

                // TODO: confirm each batch of operations separately?
                inquirer.prompt([{
                    type: 'confirm',
                    default: false,
                    name: 'sync',
                    message: 'Syncronize now?'
                }], function(answers) {
                    if (!answers.sync) {
                        callbackCheckIntegrity(new Error('Cannot start watcher, trees not synchronized.'));
                        return;
                    }

                    async.each(needsDownload, function(filePath, callbackDownloadFile) {
                        var fileDir = path.dirname(filePath);

                        // ensure parent directory exists
                        if (!fs.existsSync(fileDir)) {
                            mkdirp.sync(fileDir);
                        }

                        // stream file
                        site.request({
                            url: '/develop/' + filePath,
                            headers: {
                                Accept: '*/*'
                            }
                        }).pipe(fs.createWriteStream(filePath).on('finish', function(error) {
                            if (!error) {
                                console.log('Downloaded ' + filePath);
                            }

                            callbackDownloadFile(error);
                        }));
                    }, function(error) {
                        if (!error) {
                            console.log('Finished downloading all files.');
                        }

                        // defer for hardcoded 500ms because even using finish event above, starting watcher immediately after sync seems to catch the last file
                        setTimeout(function() {
                            callbackCheckIntegrity(error);
                        }, 500);
                    });
                });
                
                // TODO: handle needsUpload?
            } else {
                callbackCheckIntegrity();
            }
        });
    });
}

function startWatching() {
    checkIntegrity(function(error) {
        if (error) {
            throw error;
        }

        console.log('Starting watcher...');
        watcher.start();
        console.log('Watcher started.');
    });
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
//process.on('uncaughtException', function(err) {
//    require('child_process').exec("say -v Boing \"I'm sorry Dave, I'm afraid I can't do that\"");
//
//    notifier.notify({
//        'title': 'Emergence-watcher',
//        'message': 'The watcher has crashed with an uncaught exception:\n' + err
//    });
//});
