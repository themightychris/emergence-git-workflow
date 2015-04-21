#!/usr/bin/env node

var inquirer       = require("inquirer"),
    fs             = require('fs'),
    exec           = require('child_process').exec,
    ignorePatterns = {
        required: [
            ".emergence",
            ".vfs_checksums"
        ],

        git: [
            ".gitignore",
            ".current_checksums",
            ".git"
        ],

        osx: [
            ".DS_Store",
            ".AppleDouble",
            ".LSOverride",
            "Icon\r\r",
            "._*",
            ".DocumentRevisions-V100",
            ".fseventsd",
            ".Spotlight-V100",
            ".TemporaryItems",
            ".Trashes",
            ".VolumeIcon.icns",
        ],

        idea: [
            "*.iml",
            ".idea",
            "*.ipr",
            "*.iws",
            ".idea_modules",
            "atlassian-ide-plugins.xml",
            "com_crashlytics_export_strings.xml",
            "crashlytics.properties",
            "crashlytics-build.properties"
        ],

        netbeans: [
            "nbproject/private",
            "nbbuild",
            "nbdist",
            "nbactions.xml",
            "nb-configuration.xml",
            ".nb-gradle"
        ]
    };

var questions = [
    {
        type:    "input",
        name:    "hostname",
        message: "Emergence hostname (domain only):",
        default: "localhost"
    },
    {
        type:    "confirm",
        name:    "useSSL",
        message: "Is emergence reachable via SSL?",
        default: false
    },
    {
        type:    "input",
        name:    "username",
        message: "Emergence Developer Username:",
        default: process.env.USER
    },
    {
        type:     "password",
        name:     "password",
        message:  "Emergence Developer Password:",
        validate: function (password) {
            return password.length >= 6;
        }
    },
    {
        type:     "input",
        name:     "localDir",
        message:  "Local working directory:",
        default:  process.cwd(),
        validate: function (localDir) {
            return fs.lstatSync(localDir).isDirectory();
        }
    },
    {
        type:     "input",
        name:     "remoteDir",
        message:  "Remote export directory (/tmp/site-handle):",
        validate: function (remoteDir) {
            // TODO: Can we automatically populate this?
            return remoteDir.length >= 2 && remoteDir.indexOf('/') !== -1;
        }
    },
    {
        type:    "checkbox",
        message: "Which files should be ignored?",
        name:    "ignore",
        choices: [
            new inquirer.Separator("IDE:"),
            {
                name:    "PHPStorm/WebStorm (IntelliJ)",
                value:   "idea",
                checked: true,
            },
            {
                name:    "Net Beans",
                value:   "netbeans",
                checked: false
            },
            new inquirer.Separator("VCS"),
            {
                name:    "GIT*",
                value:   "git",
                checked: true
            },
            new inquirer.Separator("OS"),
            {
                name:    "OSX",
                value:   "osx",
                checked: true
            },
            new inquirer.Separator("* Disable at your own risk!"),
        ]
    },
    {
        type:    "input",
        name:    "configPath",
        message: "Where should we write your config file?",
        default: process.cwd() + '/config.json'
    },
    {
        type:    "confirm",
        default: false,
        name:    "overwriteConfig",
        message: "Overwrite existing config file?",
        when:    function (answers) {
            return fs.existsSync(answers.configPath);
        }
    },
    {
        type:    "input",
        name:    "configPath",
        message: "Where should we write your config file?",
        default: process.cwd() + '/config.json',
        when:    function (answers) {
            return answers.overwriteConfig === false;
        }
    },
    {
        type:    "confirm",
        default: true,
        name:    "uploadTreeScripts",
        message: "Should I upload import-tree.php and export-tree.php to your site-root?"
    },
    {
        type:    "confirm",
        name:    "exportVFS",
        default: false,
        message: "Should I export the VFS to your local working directory?",
        when:    function (answers) {
            return answers.uploadTreeScripts;
        }
    },
    {
        type:    "confirm",
        name:    "updateGit",
        default: false,
        message: "Should I update your .gitignore file to exclude unchanged files from your VFS export?",
        when:    function (answers) {
            return answers.exportVFS;
        }
    },
];

function generateConfig(answers) {
    var returnVal = {
        "localDir":  answers.localDir,
        "remoteDir": answers.remoteDir,

        "webdav": {
            "ssl":      answers.useSSL,
            "hostname": answers.hostname,
            "path":     "/develop",
            "username": answers.username,
            "password": answers.password
        },

        "ignore": {
            "global": ignorePatterns.required
        }
    };

    returnVal.ignore.global = answers.ignore.reduce(function (ignore, ignorePattern) {
        return ignore.concat(ignorePatterns[ignorePattern]);
    }, ignorePatterns.required) || ignorePatterns.required;

    return returnVal;
}

function curlUpload(host, src, dst, username, password) {
    var curl = "curl --digest --anyauth" +
        " --user '" + username + ':' + password + "'" +
        " -T " + src +
        " -L " + host + '/develop/' + dst;

    exec(curl, function(err) {
        if (err) {
            throw err;
        } else {
            console.log(src + ' uploaded to ' + dst);
        }
    });
}

inquirer.prompt(questions, function (answers) {
    fs.writeFile(answers.configPath, JSON.stringify(generateConfig(answers), null, "  "), function (err) {
        if (err) {
            throw err;
        }

        console.log('Config file written to: ' + answers.configPath);
    });

    if (answers.uploadTreeScripts) {
        var host = (answers.useSSL ? 'https' : 'http') + '://' + answers.hostname;
        curlUpload(host, __dirname + '/php/import-tree.php', 'site-root/import-tree.php', answers.username, answers.password);
        curlUpload(host, __dirname + '/php/export-tree.php', 'site-root/export-tree.php', answers.username, answers.password);

        if (answers.exportVFS) {
            console.log('Exporting VFS to: ' + answers.localDir + '(this could take a few minutes)...');

            var wget = 'wget -qO- ' + (answers.useSSL ? 'https' : 'http') + '://' + answers.username + ':' + answers.password + '@' +  answers.hostname + '/export-tree | tar xvz --keep-newer-files --warning=none -C ' + answers.localDir;

            exec(wget, function(err) {
                // TODO: Add error handling
                if (err === 'TODO: This always returns an error code when it runs a second time') {
                    throw err;
                } else {
                    console.log('VFS exported to: ' + answers.localDir);

                    if(answers.updateGit) {
                        exec('emergence-update', { cwd: answers.localDir }, function(err) {
                           // TODO: Add error handling
                            console.log('.gitignore updated');
                        });
                    }
                }
            });
        }
    }
});
