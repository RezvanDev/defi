#!/bin/bash
echo "fust push to server"
currdt=$(date +"%Y-%m-%d %H:%M:%S")
git add *
git commit -m "$currdt"
git push
