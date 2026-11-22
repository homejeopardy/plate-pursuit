#!/bin/zsh
cd "$(dirname "$0")"
( sleep 1; open "http://localhost:3400/host.html" ) &
node server.js
