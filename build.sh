#!/bin/bash

# Clear out the `dist` directory
rm -rf dist
mkdir dist

# Move the source files
cp *.js dist
cp *.html dist
cp *.css dist
cp *.ttf dist
cp favicons/* dist
cp .nojekyll dist

# Build microtonal-utils and move its dist
cd microtonal-utils
npm install && npm run build:all
cd ..
mkdir dist/microtonal-utils
cp -R microtonal-utils/dist dist/microtonal-utils/dist
cp -R microtonal-utils/README.md dist/microtonal-utils/README.md
