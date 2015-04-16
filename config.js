#!/usr/bin/env node

var inquirer       = require("inquirer"),
    fs             = require('fs'),
    ignorePatterns = {
        required: [
            "**/.emergence/*",
            ".vfs_checksums"
        ],

        git: [
            ".gitignore",
            ".current_checksums",
            ".git/*"
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
            ".idea/*",
            "*.ipr",
            "*.iws",
            ".idea_modules",
            "atlassian-ide-plugins.xml",
            "com_crashlytics_export_strings.xml",
            "crashlytics.properties",
            "crashlytics-build.properties"
        ],

        netbeans: [
            "nbproject/private/*",
            "nbbuild/*",
            "nbdist/*",
            "nbactions.xml",
            "nb-configuration.xml",
            ".nb-gradle/*"
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
    }
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

inquirer.prompt(questions, function (answers) {
    fs.writeFile(answers.configPath, JSON.stringify(generateConfig(answers), null, "  "), function (err) {
        if (err) {
            throw err;
        }

        console.log('Config file written to: ' + answers.configPath);
    });
});
