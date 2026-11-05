/** Fake only the clock (not timers), so pages that read "today" are stable while async work still runs. */
export function freezeDate(now: Date) {
  jest.useFakeTimers({
    now,
    doNotFake: [
      "nextTick",
      "queueMicrotask",
      "setImmediate",
      "clearImmediate",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "performance",
      "hrtime",
    ],
  });
}
