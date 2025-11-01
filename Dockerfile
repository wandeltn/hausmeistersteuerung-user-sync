# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=25.0.0

################################################################################
# Base runtime image (musl/alpine) - small final image
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app

################################################################################
# Stage: install production dependencies only. These will be copied into the final image.
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /usr/src/app
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=yarn.lock,target=yarn.lock \
    --mount=type=cache,target=/root/.yarn \
    yarn install --production --frozen-lockfile

################################################################################
# Stage: build the application. Use a glibc-based image (bullseye) to ensure
# native dev dependencies (e.g. lightningcss) can install their binaries.
FROM node:${NODE_VERSION}-bullseye AS build
WORKDIR /usr/src/app
# Install full dependency tree (dev + prod) for build
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=yarn.lock,target=yarn.lock \
    --mount=type=cache,target=/root/.yarn \
    yarn install --frozen-lockfile

# Copy source and run build
COPY . .
RUN yarn run build

################################################################################
# Final runtime image - copy only production node_modules and built output
FROM base AS final
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Run as non-root user
USER node

# Copy production node_modules from deps stage
COPY --from=deps /usr/src/app/node_modules ./node_modules
# Copy built artifacts from build stage
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 5000
# Run the compiled server directly to avoid requiring yarn or package.json
CMD ["node", "dist/index.js"]
