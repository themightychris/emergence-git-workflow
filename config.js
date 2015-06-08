#!/usr/bin/env node

var inquirer       = require("inquirer"),
    fs             = require('fs'),
    exec           = require('child_process').exec,
    emergence       = require('./lib/emergence'),
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
        type:    "confirm",
        name:    "updateGit",
        default: false,
        message: "Should I update your .gitignore file to exclude unchanged files from your VFS export?",
        when:    function (answers) {
            return answers.exportVFS;
        }
    },
    {
        type:    "input",
        name:    "configPath",
        message: "Where should we write your config file?",
        default: function(answers) {
            return answers.localDir + '/.emergence-workspace.json';
        }
    },
    {
        type:    "confirm",
        default: false,
        name:    "overwriteConfig",
        message: "Overwrite existing config file?",
        when:    function (answers) {
            return fs.existsSync(answers.configPath);
        }
    }
];

function generateConfig(answers, sessionData) {

    var config = {
        "localDir": answers.localDir,

        "site": {
            "ssl": answers.useSSL,
            "hostname": answers.hostname,
            "token": sessionData && sessionData.Handle || null
        },

        "ignore": {
            "global": ignorePatterns.required
        }
    };

    config.ignore.global = answers.ignore.reduce(function (ignore, ignorePattern) {
        return ignore.concat(ignorePatterns[ignorePattern]);
    }, ignorePatterns.required) || ignorePatterns.required;

    return config;
}

inquirer.prompt(questions, function (answers) {
    if (answers.overwriteConfig === false) {
        console.log('Aborting.');
        return;
    }

    var site = new emergence.Site({
        hostname: answers.hostname,
        useSSL: answers.useSSL
    });

    console.log('Logging in to site...');
    site.login(answers.username, answers.password, function(error, sessionData) {
        if (error) {
            throw error;
        }

        console.log('Login successful, writing config to: ' + answers.configPath + '...');
        fs.writeFile(answers.configPath, JSON.stringify(generateConfig(answers, sessionData), null, "  "), function (error) {
            if (error) {
                throw error;
            }
    
            console.log('Config written');
        });
    });
});
