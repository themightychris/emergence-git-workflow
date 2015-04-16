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
3. ``sudo npm install -g`` from this repo's directory
5. Upload ``php/export-tree.php`` to ``site-root``
6. Upload ``php/import-tree.php`` to ``site-root``

## Getting started:
1. Install and upload the pre-requisites above
2. Make sure that your Emergence instance is in sync with a GIT branch
3. Check out a local working copy (clone) of that GIT branch on your dev machine
4. cd into the local working directory
5. ``wget -qO- http://$emergence_username:$emergence_password@$emergence_host/export-tree | tar xvz --keep-newer-files``
6. The VFS has now been extracted over your local working copy. Since they should be the same right now, this shouldn't result in any changes.
7. Copy scripts/update.sh from this repo into your working directory
8. Edit the variables in update.sh to point to your emergence instance
9. Run ``./update.sh`` from inside your working directory
10. Run ``git status`` you should only see update.sh as a modified file, if anything else has changed something is out of sync.
11. Run ``emergence-config`` to generate a configuration file
12. Run ``emergence-watcher`` to watch a directory
