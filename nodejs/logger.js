const pino = require('pino');
require('dotenv').config();

const streams = [
    { stream: process.stdout },
    { stream: pino.destination(`${__dirname}/combined.log`) },
  ];

module.exports = pino(
    {
      level: process.env.LOGLEVEL || 'info',
    },
    pino.multistream(streams)
  );