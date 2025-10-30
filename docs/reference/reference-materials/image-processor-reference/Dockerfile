FROM node:18-bullseye-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libglib2.0-0 \
      gobject-introspection \
      pkg-config \
      build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libgdk-pixbuf2.0-0 \
      gdk-pixbuf2.0-plugins \
      libglib2.0-0 \
      gobject-introspection \
      pkg-config \
      build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src

ENV GC_BUCKET=perkieprints-processing-cloudbuild

EXPOSE 8080
CMD ["node", "src/index.js"]
