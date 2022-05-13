const express = require('express');
const app = express();
const bodyParser = require("body-parser");
const session = require('express-session')
const HLCServer = require('./HLCServer');
const cors = require('cors');
const WebSocketHandler = require('./WebSocketHandler');

const clockServer = new HLCServer();

app.use(bodyParser.json());
app.use(
  cors({
    origin: 'http://localhost:8080',
    methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
    credentials: false,
  })
);

const port = 8000;
app.listen(port, () => {
  console.log(`[+] Server started. Listening on ${port}`);
});

app.post('/write', (req, res) => {
  console.log('[+] Write ', req.body)
  const { key, value, time } = req.body;
  let clockResult = clockServer.write(key, value, time);
  console.log(`ResultClock: ${clockResult}`);

  res.json(clockResult.toJSON());
});

const main = async () => {
  const webSocketHandler = new WebSocketHandler();
  await webSocketHandler.start();
}

main();
