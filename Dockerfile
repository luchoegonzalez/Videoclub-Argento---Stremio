FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY assets ./assets
ENV PORT=7000
EXPOSE 7000
CMD ["npm", "start"]
