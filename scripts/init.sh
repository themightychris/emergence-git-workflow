#!/bin/bash

emergence_username=''
emergence_password=''
emergence_hostname=''

wget -qO- http://$emergence_username:$emergence_password@emergence_hostname/prepare | tar xvz --keep-newer-files
