FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Use the lockfile for reproducible installs.
RUN npm ci --fetch-timeout=600000

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
