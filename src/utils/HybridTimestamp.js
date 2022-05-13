module.exports = class HybridTimestamp {
  wallClockTime = null;
  ticks = null;
  constructor(systemTime, ticks) {
    this.wallClockTime = systemTime;
    this.ticks = ticks;
  }
  static fromSystemTime(systemTime) {
    return new HybridTimestamp(systemTime, -1);
  }

  max(other) {
    if (this.getWallClockTime() == other.getWallClockTime())
        return this.getTicks() > other.getTicks() ? this : other;
    return this.getWallClockTime() > other.getWallClockTime() ? this : other;
  }

  getWallClockTime() {
    return this.wallClockTime;
  }

  getTicks() {
    return this.ticks;
  }

  addTicks(ticks) {
    return new HybridTimestamp(this.getWallClockTime(), this.getTicks() + ticks);
  }
  
  compareTo(other) {
    if (this.getWallClockTime() == other.getWallClockTime()) {
      return this.getTicks() - other.getTicks();
    }
    return this.getWallClockTime() - other.getWallClockTime();
  }

  toJSON() {
    return { systemTime: this.getWallClockTime(), ticks: this.getTicks() };
  }

  toString() {
    let date = new Date(this.getWallClockTime());
    return `HybridTimestamp: wallClock ${this.getWallClockTime()} (${date.toLocaleString('de-DE')}), ticks ${this.getTicks()}`;
  }
};
