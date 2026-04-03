FROM node:18-slim

# Python aur GCC install karo
RUN apt-get update && apt-get install -y \
    python3 \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# python3 ko default banao
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]