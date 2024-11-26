FROM node:latest
LABEL name="LS25-Discord-Bot"
LABEL authors="Dennis Heinrich"

# Copy the source files
WORKDIR /app
COPY . /app
RUN npm install
RUN npm run build

## Simplyfy the rm commands
RUN rm -rf .ddev/ source/ misc/ .git .gitignore config.example.json Dockerfile docker-compose.yml README.md

CMD ["npm", "run", "start-only"]
ENTRYPOINT ["npm", "run", "start-only"]