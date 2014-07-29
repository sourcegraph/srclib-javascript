FROM ubuntu:14.04

RUN apt-get update -qq
RUN apt-get install -qqy nodejs node-gyp npm git

# Some NPM modules expect the node.js interpreter to be "node", not "nodejs" (as
# it is on Ubuntu).
RUN ln -s /usr/bin/nodejs /usr/bin/node

# Add this toolchain
ADD . /srclib/srclib-javascript/
WORKDIR /srclib/srclib-javascript
RUN npm install
ENV PATH /srclib/srclib-javascript/.bin:$PATH

WORKDIR /src

ENTRYPOINT ["srclib-javascript"]
