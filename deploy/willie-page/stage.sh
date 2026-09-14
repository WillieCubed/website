#!/bin/sh
# Copies the static site from public/ into the folder the Worker serves.
set -eu
cd "$(dirname "$0")"
rm -rf site
mkdir -p site
cp ../../public/home.html site/index.html
cp -R ../../public/assets ../../public/brand site/
cp ../../public/favicon.ico ../../public/icon.svg ../../public/apple-touch-icon.png ../../public/manifest.webmanifest site/
cp static/404.html static/robots.txt site/
