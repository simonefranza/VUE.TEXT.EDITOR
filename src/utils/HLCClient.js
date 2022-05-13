const HybridClock = require('./HLC');
const HybridTimestamp = require('./HybridTimestamp');
const axios = require('axios');

module.exports = class HLCClient {
  clock = null;
  constructor() {
    this.clock = new HybridClock(Date);
    console.log("[+] HLC Client created", this);
  }
  async write() {
    let server1WrittenAt = (await this.sendServer(
      "name",
      "Alice",
      this.clock.now().toJSON()
    )).data;
    let write1Stamp = new HybridTimestamp(
      server1WrittenAt.systemTime,
      server1WrittenAt.ticks
    );

    this.clock.tick(write1Stamp);

    let server2WrittenAt = (await this.sendServer(
      "title",
      "Microservices",
      this.clock.now().toJSON()
    )).data;

    let write2Stamp = new HybridTimestamp(
      server2WrittenAt.systemTime,
      server2WrittenAt.ticks
    );

    if (!(write2Stamp.compareTo(write1Stamp) > 0))
      console.error(`wrong timestamp ${write1Stamp}, ${write2Stamp}`);
    else console.log("Timestamp ok");
  }
  nowToJSON() {
    return this.clock.now().toJSON();
  }
  async sendServer(key, value, time) {
    let res = await axios.post(
      'http://localhost:8000/write', 
      { key, value, time }
    );
    console.log(res);
    return res;
  }
};
