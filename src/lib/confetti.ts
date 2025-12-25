import confetti from 'canvas-confetti';

// CTF victory confetti celebration
export function celebrateFlag() {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    // Left side burst
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
    });

    // Right side burst
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
    });
  }, 250);
}

// Smaller celebration for each flag found during analysis
export function miniCelebrate() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#22c55e', '#10b981', '#34d399'],
    zIndex: 9999,
  });
}

// Big finale when autopilot completes successfully
export function grandFinale() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ['#22c55e'],
  });

  fire(0.2, {
    spread: 60,
    colors: ['#3b82f6'],
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ['#f59e0b', '#ec4899'],
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ['#8b5cf6'],
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: ['#10b981'],
  });
}
