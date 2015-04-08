#!/bin/bash

webdav_host=''
webdav_user=''
webdav_pass=''

find . -not -path '*/.emergence/*' -not -path '*/.git/*' -not -iname '.*' ! -iname 'mark' -type f -print | xargs sha1sum | sed 's/\.\///' | sort > .current_checksums
comm -2 .vfs_checksums .current_checksums | cut -f3 -d' ' > .gitignore && printf ".current_checksums\n.gitignore" >> .gitignore
echo "The following files differ from the initial VFS state:"
comm -3 .vfs_checksums .current_checksums | cut -f3 -d' ' | while read -r line; do
	if [[ "$line" == *\/* ]]; then
		echo  $line
	fi
done

# Cleanup
rm .current_checksums
git update-index --assume-unchanged .current_checksums

