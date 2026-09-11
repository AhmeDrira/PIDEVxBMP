# Node 20 minimum : mongoose 9 exige >= 20.19.0 et sharp 0.35 >= 20.9.0.
# Node 18 ne satisfaisait plus ni l'un ni l'autre.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
