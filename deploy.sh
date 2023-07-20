#!/bin/sh

heroku login

heroku container:login

docker buildx build --platform linux/amd64 -t vividly-backend .

docker tag vividly-backend registry.heroku.com/vividly-backend/web

docker push registry.heroku.com/vividly-backend/web

heroku container:release web -a vividly-backend

