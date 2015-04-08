# emergence-git-workflow

The Git workflow is designed to allow you to work with Emergence using a locally checked out copy of a Git repository.
It provides you with a one, or two-way syncronized (not tested) copy of the VFS locally.

## Benefits:
1. Your IDE's auto complete and introspection tools will work correctly
2. You can use GIT locally
3. Your normal backup strategy (timemachine, zfs, rsync) can be carried out like normal
4. ``git status`` will only files that have a different checksum than the VFS
5. The entire VFS is never checked into git
6. You can use ``git stash`` and all your other favorite GIT commands

## Pre-requisites:
1. On OSX: ``brew install md5sha1sum wget`` or ``sudo port install md5sha1sum wget``
2. Install the official Node.JS package from here: https://nodejs.org/download/
3. Upload ``php/prepare.php`` to ``site-root``

## Getting started:
1. Make sure that your Emergence instance is in sync with a GIT branch
2. Check out a local working copy (clone) of that GIT branch on your dev machine
3. cd into the local working directory
4. ``wget -qO- http://$emergence_username:$emergence_password@$emergence_host/prepare | tar xvz --keep-newer-files``
5. The VFS has now been extracted over your local working copy. Since they should be the same right now, this shouldn't result in any changes.
6. Copy scripts/update.sh from this repo into your working directory
7. Edit the variables in update.sh to point to your emergence instance
8. Run ``./update.sh`` from inside your working directory
9. Run ``git status`` you should only see update.sh as a modified file, if anything else has changed something is out of sync.
10. Set up a file watcher to run update.sh whenever a file changes (see below for phpstorm)
11. You must choose a transport method, each has pros and cons, choose wisely:

## Using with PHPStorm
1. Set up a file watcher for your project that automatically runs update.sh
2. Add the remote emergence server as a server to your deployment options
3. Map your /tmp/label directory to your local working directory
4. Make sure that "Auto upload" is checked off in the main menu (Tools -> Deployment -> Auto Upload)
5. -- You need to make sure that when a file is uploaded, it also is imported back into the tree a remote or local file watcher is ideal here --
6. Optionally: set up a file watcher for sass that calls /sass/compile
7. Optionally: set up a file watcher for javascript files that require a build

| Transport | Attempted | Tested | Pros                                                                                                       | Cons                                                                                                          |
|-----------|-----------|--------|------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| webdav    | Yes       | No     | * Removes need to "import tree" on the remote server                                                       | * Cannot batch files Slow Sends entire file, not a delta Requires server-side handling of "garbage IDE files" |
| ssh       |           |        | * Widely supported in IDEs Hooks into your IDEs save functionality allowing for build tools to run locally | * Cannot batch files Sends entire file, not a delta                                                           |
| rsync     |           | 2      | * Supported in some IDEs with plugins Very efficient use of bandwidth and CPU (uses deltas when possible)  | * Unaware of IDE "garbage files" Possible issues with thrashing when multiple changes, or "Safe writes" occur |
