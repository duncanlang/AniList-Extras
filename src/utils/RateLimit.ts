import { sleep } from './Helpers';

export default class RateLimit {
	private readonly queue: (() => Promise<void> | void)[] = [];

	private readonly rateLimit: number;

	private readonly interval: number;

	private tokens: number;

	private lastRefill: number = Date.now();

	private processing: boolean = false;

	/**
	 * Creates a new RateLimit instance with the given token count and refill interval in milliseconds.
	 */
	public constructor(rateLimit: number, interval: number) {
		this.rateLimit = rateLimit;
		this.interval = interval;
		this.tokens = rateLimit;
	}

	/**
	 * Adds a callback to the queue and triggers queue processing.
	 */
	public push(callback: () => Promise<void> | void): void {
		console.log('RateLimit: Pushing new callback to queue. Tokens available:', this.tokens);
		this.queue.push(callback);
		void this.processQueue();
	}

	/**
	 * Drains the queue, executing callbacks as tokens permit and sleeping when exhausted.
	 */
	private async processQueue(): Promise<void> {
		if (this.processing) return;
		this.processing = true;

		while (this.queue.length > 0) {
			this.refillTokens();

			if (this.tokens >= 1) {
				this.tokens--;
				const callback = this.queue.shift();
				if (callback) {
					try {
						console.log('RateLimit: Executing callback from queue. Tokens left:', this.tokens);
						await callback();
					} catch (error) {
						console.error('Callback failed inside queue:', error);
					}
				}
			} else {
				const timePerToken = this.interval / this.rateLimit;
				const now = Date.now();
				const timeSinceRefill = now - this.lastRefill;
				const waitTime = timePerToken - (timeSinceRefill % timePerToken);

				console.log(`RateLimit: No tokens available. Waiting for ${waitTime}ms before retrying.`);

				await sleep(waitTime);
			}
		}

		this.processing = false;
	}

	/**
	 * Gradually refills tokens proportional to elapsed time, preventing fixed-window bursts.
	 */
	private refillTokens(): void {
		const now = Date.now();
		const diff = now - this.lastRefill;
		const tokensToAdd = Math.floor((diff / this.interval) * this.rateLimit);

		if (tokensToAdd > 0) {
			this.tokens = Math.min(this.rateLimit, this.tokens + tokensToAdd);
			this.lastRefill += tokensToAdd * (this.interval / this.rateLimit);
		}
	}
}
