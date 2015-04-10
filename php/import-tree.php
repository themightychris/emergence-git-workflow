<?php

namespace Emergence;

use Emergence\People\User;

// Authenticate a developer using HTTP auth (easier to use from the shell)
function basicAuth() {
    $authEngine = new \Sabre\HTTP\BasicAuth();
    $authEngine->setRealm('Develop ' . \Site::$title);
    $authUserPass = $authEngine->getUserPass();

    $userClass = User::$defaultClass;
    $User = $userClass::getByLogin($authUserPass[0], $authUserPass[1]);

    if (!$User || !$User->hasAccountLevel('Developer')) {
        $authEngine->requireLogin();
        die("Authentication required\n");
    }
}

function importTree($exportDir) {
    $topLevelDirectories = \DB::allRecords('SELECT DISTINCT(handle) FROM _e_file_collections WHERE ParentID IS NULL');

    foreach ($topLevelDirectories as $collection) {
        $handle = $collection['handle'];

        $srcDir = $exportDir . '/' . $handle;
        if (is_dir($srcDir)) {
            \Emergence_FS::importTree($srcDir, $handle);
            print "Importing $srcDir<br>";
        }
    }
}

\Site::$autoPull = true;
\Site::$debug = true;
set_time_limit(0);

$exportDir = isset($_GET['dir']) ? $_GET['dir'] : ('/tmp/' . \Site::$title);

basicAuth();
importTree($exportDir);
