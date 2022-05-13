const ws = require('ws');
const HLCServer = require('./HLCServer');
const DBConnect = require('./db/DBConnect');

module.exports = class WebSocketHandler {
  #sockets;
  #port;
  #webs;
  #clockServer;
  #docID;
  #docIDUUIDMap;
  constructor() {
    let MONGODB_HOST='mongodb://localhost';
    let MONGODB_PORT=27017;
    let MONGODB_DB_NAME='textEditor';
    this.#sockets = [];
    this.#port = 8001;
    this.#docID = 0;
    this.#docIDUUIDMap = {};
    this.#clockServer = new HLCServer();
    this.#webs = new ws.WebSocketServer({
      port: this.#port,
    });
    this.db = new DBConnect(MONGODB_HOST + ':' + MONGODB_PORT + '/' + MONGODB_DB_NAME);
  }
  async start() {
    await this.db.connect();
    //await this.db.retrieveData(0);
    this.#webs.on('connection', (socket, req) => this.handleConnection(this, socket, req));
    console.log(`[+] Web socket listening on port ${this.#port}`);
  };
  handleConnection(self, socket, req) {
    console.log("[+] New connection");
    this.#sockets.push(socket);
    let currentDocID = Math.floor(this.#docID);
    this.#docID += 0.5;
    console.log("Doc ID", currentDocID);

    socket.on('message', (data, isBinary) =>
      self.waitRegistration(self, socket, currentDocID, data, isBinary)
    );
  }
  waitRegistration(self, socket, docID, rawData, isBinary) {
    console.log("[+] New registration");
    let stringData = isBinary ? rawData : rawData.toString();
    try {
      let { uuid } = JSON.parse(stringData);
      console.log('uuid', uuid);

      this.#docIDUUIDMap[uuid] = docID;
      socket.removeAllListeners('message');
      socket.on('message', (data, isBinary) =>
        self.handleMessage(self, socket, data, isBinary));
    } catch (e) {
      console.log('error while parsing JSON', e);
    }
  }
  async handleMessage(self, ownSocket, rawData, isBinary) {
    console.log("[+] New message");
    let stringData = isBinary ? rawData : rawData.toString();
    console.log(stringData);
    try {
      let content = {};
      let parsed = JSON.parse(stringData);
      if ('data' in parsed && 'time' in parsed) {
        let data = parsed.data;
        let time = parsed.time;
        if (!data.length) return;
        //console.log('data', data, time);
        let newTimestamp = this.#clockServer.write(data, time);
        let uuid = data[0].uniqueID.split('#')[0];
        let docID = this.#docIDUUIDMap[uuid];
        let savedData = await this.db.saveData(docID, data);
        if (savedData === false) {
          console.log("Failed to save data");
          return;
        }
        content.data = data;
        content.time = newTimestamp.toJSON();
      }
      else if ('cursor' in parsed) {
        console.log("New cursor position", parsed.cursor);
        content.cursor = parsed.cursor;
      }
      else {
        console.log("Wrong keys?", Object.keys(parsed));
        return;
      }
      self.#sockets.forEach((socket) => {
        if (socket === ownSocket) return;
        socket.send(JSON.stringify(content));
      });
    } catch (e) {
      console.log('error while parsing JSON', e);
    }
  }
};
