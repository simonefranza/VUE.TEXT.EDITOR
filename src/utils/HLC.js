const HybridTimestamp = require('./HybridTimestamp');

module.exports = class HybridClock {
  systemClock;
  latestTime;
  constructor(clock) {
    this.systemClock = clock;
    this.latestTime = new HybridTimestamp(clock.now(), 0);
  }
  
  now() {
    let currentTimeMillis = this.systemClock.now();
    this.latestTime = this.latestTime.getWallClockTime() >= currentTimeMillis ?
      this.latestTime.addTicks(1) :
      new HybridTimestamp(currentTimeMillis, 0);
    return this.latestTime;
  }

  max() {
    let timestamps = Array.from(arguments);
    let maxTime = timestamps[0];
    timestamps.forEach((timestamp) => maxTime = maxTime.max(timestamp));
    return maxTime;
  }

  // HybridTimestamp requestTime
  tick(requestTime) {
    let nowMillis = this.systemClock.now();
    let now = HybridTimestamp.fromSystemTime(nowMillis);
    this.latestTime = this.max(now, requestTime, this.latestTime);
    this.latestTime = this.latestTime.addTicks(1);
    return this.latestTime;
  }
  toString() {
    return 'suck';
  }
};
