const HybridClock = require('../src/utils/HLC');
const HybridTimestamp = require('../src/utils/HybridTimestamp');

module.exports = class HLCServer {
  #clock = null;
  constructor() {
    this.#clock = new HybridClock(Date);
    console.log("[+] HLC Server created");
  }

  // String key, String value, HybridTimestamp requestTimestamp
  write(data, requestTimestamp) {
    //update own clock to reflect causality
    let reconstructedTimestamp = new HybridTimestamp(
      requestTimestamp.systemTime,
      requestTimestamp.ticks
    );
    console.log('[+] Server write');
    let writeAtTimestamp = this.#clock.tick(reconstructedTimestamp);
    //TODO write to db (key, writeAtTimestamp, value)
    return writeAtTimestamp;
  }

};
