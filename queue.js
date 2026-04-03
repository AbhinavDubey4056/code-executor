// queue.js

const MAX_CONCURRENT = 10;    // ek saath max 10 executions
const QUEUE_TIMEOUT = 30000;  // 30 seconds max wait in queue
const MAX_QUEUE_SIZE = 50;    // max 50 requests queue mein wait kar sakte hain

class ExecutionQueue {
  constructor() {
    this.running = 0;       // abhi kitne run ho rahe hain
    this.queue = [];        // waiting requests
  }

  // ── MAIN FUNCTION — yeh call karo code run karne ke liye ──
  async add(executionFn) {
    // Queue full hai?
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error("Server is too busy right now. Please try again in a moment.");
    }

    // Slot available hai toh seedha run karo
    if (this.running < MAX_CONCURRENT) {
      return this._run(executionFn);
    }

    // Warna queue mein daalo aur wait karo
    return this._waitInQueue(executionFn);
  }

  // ── ACTUALLY RUN KARO ──
  async _run(executionFn) {
    this.running++;

    try {
      const result = await executionFn();
      return result;
    } finally {
      // Chahe success ho ya error — running count kam karo
      // Aur queue mein next wala run karo
      this.running--;
      this._next();
    }
  }

  // ── QUEUE MEIN WAIT KARO ──
  _waitInQueue(executionFn) {
    return new Promise((resolve, reject) => {
      // Timeout set karo — agar 30 sec mein slot nahi mila toh reject
      const timer = setTimeout(() => {
        // Queue se remove karo
        this.queue = this.queue.filter(item => item.timer !== timer);
        reject(new Error("Queue timeout. Server is busy, please try again."));
      }, QUEUE_TIMEOUT);

      // Queue mein push karo
      this.queue.push({
        executionFn,
        resolve,
        reject,
        timer,
        addedAt: Date.now()
      });
    });
  }

  // ── NEXT WALA QUEUE SE NIKALO ──
  _next() {
    if (this.queue.length === 0) return;
    if (this.running >= MAX_CONCURRENT) return;

    const next = this.queue.shift(); // pehla wala nikalo
    clearTimeout(next.timer);        // uska timeout cancel karo

    // Run karo aur uske promise ko resolve/reject karo
    this._run(next.executionFn)
      .then(next.resolve)
      .catch(next.reject);
  }

  // ── STATUS CHECK ──
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: MAX_CONCURRENT,
      maxQueueSize: MAX_QUEUE_SIZE,
    };
  }
}

// Ek hi instance banana hai — singleton pattern
const executionQueue = new ExecutionQueue();

module.exports = executionQueue;