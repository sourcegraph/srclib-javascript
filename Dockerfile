FROM ubuntu:14.04

RUN apt-get update -qq
RUN apt-get install -qqy nodejs node-gyp npm git

# Some NPM modules expect the node.js interpreter to be "node", not "nodejs" (as
# it is on Ubuntu).
RUN ln -s /usr/bin/nodejs /usr/bin/node

ENV IN_DOCKER_CONTAINER true

# Add this toolchain
ADD . /srclib/srclib-javascript/
WORKDIR /srclib/srclib-javascript
ENV PATH /srclib/srclib-javascript/.bin:$PATH

# otherwise these get picked up as being in the jsg package
ENV NODEJS_CORE_MODULES_DIR /tmp/node_core_modules
RUN ln -rs /srclib/srclib-javascript/node_modules/jsg/testdata/node_core_modules $NODEJS_CORE_MODULES_DIR

WORKDIR /src

ENTRYPOINT ["srclib-javascript"]
