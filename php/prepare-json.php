<?php

namespace Emergence;

use Emergence\People\User;

// retrieve authentication attempt
$authEngine = new \Sabre\HTTP\BasicAuth();
$authEngine->setRealm('Develop ' . \Site::$title);
$authUserPass = $authEngine->getUserPass();

// try to get user
$userClass = User::$defaultClass;
$User = $userClass::getByLogin($authUserPass[0], $authUserPass[1]);

// send auth request if login is inadequate
if (!$User || !$User->hasAccountLevel('Developer')) {
    $authEngine->requireLogin();
    die("Authentication required\n");
}

$startTime = microtime(true);

\Site::$autoPull = true;
\Site::$debug = true;

set_time_limit(0);

global $collectionResults, $aggregateResults, $exportDir;

$exportDir = '/tmp/jmealo/slate-cbl-pr';

$collectionResults = [];

$aggregateResults = [
    'written' => 0,
    'analyzed' => 0,
    'deleted' => 0,
    'cached' => 0
];

function retrieveRemoteFiles()
{
    global $aggregateResults, $collectionResults;

    $totalFilesCached = 0;
    $collectionRecords = \DB::allRecords('SELECT DISTINCT(handle) FROM _e_file_collections WHERE ParentID IS NULL AND handle NOT LIKE "sencha-%%" AND site="Remote";');
    $cacheCollections = ['sencha-workspace/pages', 'sencha-workspace/packages'];

    foreach ($collectionRecords as $record) {
        $cacheCollections[] = $record['handle'];
    }

    foreach ($cacheCollections as $collection) {
        if (!isset($collectionResults[$collection])) {
            $collectionResults[$collection] = [];
        }
        $filesCached = \Emergence_FS::cacheTree($collection, true);
        $totalFilesCached += $filesCached;
        $collectionResults[$collection]['cached'] = $filesCached;
    }

    $aggregateResults['cached'] += $totalFilesCached;

    return $totalFilesCached;
}

function exportTree($exportDir)
{
    global $aggregateResults, $collectionResults;

    $topLevelDirectories = \DB::allRecords('SELECT DISTINCT(handle) FROM _e_file_collections WHERE ParentID IS NULL AND handle NOT LIKE "sencha-%%"');
    $topLevelDirectories = array_merge($topLevelDirectories, [
        ['handle' => 'sencha-workspace/pages'],
        ['handle' => 'sencha-workspace/packages']
    ]);

    foreach ($topLevelDirectories as $collection) {
        $handle = $collection['handle'];

        $destDir = $exportDir . '/' . $handle;
        $result = \Emergence_FS::exportTree($handle, $destDir);

        if (!isset($collectionResults[$handle])) {
            $collectionResults[$handle] = $result;
        } else {
            $collectionResults[$handle] = array_merge($collectionResults[$handle], $result);
        }

        $aggregateResults['written'] += $result['written'];
        $aggregateResults['deleted'] += $result['deleted'];
        $aggregateResults['analyzed'] += $result['analyzed'];
    }
}

function recursiveSha1($dir)
{
    $result = [];
    $checksums = explode("\n", shell_exec("cd $dir && find . -type f -print | xargs sha1sum | sed 's/\.\///'"));

    foreach ($checksums as $checksum) {
        list($filename, $checksum) = preg_split('/\s+/', $checksum);
        $result[$filename] = $checksum;
    }

    return $result;
}

function writeRecursiveSha1($dir, $filename) {
    shell_exec("cd $dir && find . -not -path '*/.emergence/*' -not -path '.git' -not -iname '.*' ! -iname 'mark' -type f -print | xargs sha1sum | sed 's/\.\///' | sort > .vfs_checksums");
}

function outputTarball() {
    global $exportDir;

    $exportPath = explode('/', $exportDir);
    $exportChildDir = array_pop($exportPath);
    $exportParentDir = implode('/', $exportPath);

    ob_end_clean();

    header('Content-Type: application/x-gzip');

    chdir($exportDir);

    $fp = popen("tar -cvzf - .", "r");

    while (!feof($fp)) {
        echo fread($fp, 8192);
    }

    pclose($fp);
}

retrieveRemoteFiles();
exportTree($exportDir);
writeRecursiveSha1($exportDir, '.vfs_checksums');
outputTarball();


/*
print json_encode([
    'aggregate' => $aggregateResults,
    'perCollection' => $collectionResults,
    'sha1' => recursiveSha1($exportDir),
    'timeElapsed' => microtime(true) - $startTime
], JSON_UNESCAPED_SLASHES);*/
