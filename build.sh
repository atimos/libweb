#!/usr/bin/env bash
root=`pwd`

git submodule init
git submodule update --remote

cd $root/sys/polymer
./bin/pull-all.sh

cd $root/sys/traceur
npm install
make bin/traceur-runtime.js
make bin/traceur.js
