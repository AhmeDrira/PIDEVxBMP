FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
