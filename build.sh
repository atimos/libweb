#!/usr/bin/env bash
root=`pwd`

git submodule init
git submodule upgrade --remote

cd $root/sys/polymer/polymer
./bin/pull-all.sh

cd $root/sys/traceur/compiler
npm install
make bin/traceur-runtime.js
make bin/traceur.js
