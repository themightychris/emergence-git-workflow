#!/bin/bash

find . -not -path '*/.git/*' -not -iname '.*' -type f -print | xargs sha1sum | sed 's/\.\///' | sort > .current_checksums
comm -2 .vfs_checksums .current_checksums | cut -f3 -d' ' > .gitignore && printf ".current_checksums\n.gitignore" >> .gitignore
rm .current_checksums
