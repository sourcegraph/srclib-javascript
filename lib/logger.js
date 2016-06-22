var winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
          level: 'error',
          handleExceptions: true,
          humanReadableUnhandledException: true,
          timestamp: true,
          stderrLevels: ['silly', 'debug', 'verbose', 'info', 'warn', 'error']
      })
    ]
  });

module.exports = logger;
