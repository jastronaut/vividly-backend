# 1. Base Image
FROM node:16

# 2. Set the working directory
WORKDIR /app

# 3. Copy package.json and yarn.lock into the working directory
COPY package.json yarn.lock ./

# 4. Install the application dependencies
RUN yarn install --frozen-lockfile

# 5. Copy the rest of the application code
COPY . .

# 6. Build the application
RUN yarn build

# 7. The application's port number
EXPOSE 1337

# 8. The command to run the application
CMD [ "yarn", "start" ]
