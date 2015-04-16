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

## Getting started:
1. On OSX: ``brew install md5sha1sum wget`` or ``sudo port install md5sha1sum wget``
2. Install the official Node.JS package from here: https://nodejs.org/download/
3. ``sudo npm install -g`` from this repo's directory
4. Make sure that your Emergence instance is in sync with a GIT branch
5. Check out a local working copy (clone) of that GIT branch on your dev machine
6. cd into the local working directory
7. Run ``emergence-config`` to generate a configuration file (when prompted, upload the tree scripts, export the VFS and update your .gitignore)
8. Run ``git status`` to make sure that everything looks good
9. Run ``emergence-watcher`` to watch the directory and upload changes automatically
