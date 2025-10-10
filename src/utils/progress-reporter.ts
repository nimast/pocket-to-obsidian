import chalk from 'chalk';
import type { Ora } from 'ora';

export interface ProgressReporterOptions {
  total: number;
}

export class ProgressReporter {
  private processed = 0;
  private successes = 0;
  private failures = 0;
  private readonly total: number;
  private spinner: Ora | null = null;
  private usingSpinner = false;
  private active = true;
  private fallbackRenderedLength = 0;

  private constructor(total: number) {
    this.total = total;
  }

  static async create(options: ProgressReporterOptions): Promise<ProgressReporter> {
    const reporter = new ProgressReporter(options.total);
    await reporter.initialize();
    return reporter;
  }

  incrementSuccess(): void {
    if (!this.active) return;
    this.processed += 1;
    this.successes += 1;
    this.updateDisplay();
  }

  incrementFailure(): void {
    if (!this.active) return;
    this.processed += 1;
    this.failures += 1;
    this.updateDisplay();
  }

  withTemporaryPause(action: () => void): void {
    if (!this.active) {
      action();
      return;
    }

    if (this.usingSpinner && this.spinner) {
      this.spinner.stop();
      action();
      if (this.active) {
        this.spinner.start();
        this.spinner.text = this.formatMessage();
      }
      return;
    }

    this.clearFallback();
    action();
    this.renderFallback();
  }

  finish(message?: string): void {
    if (!this.active) {
      if (message) {
        console.log(message);
      }
      return;
    }

    this.active = false;
    if (this.usingSpinner && this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    } else {
      this.clearFallback();
    }
    console.log(message ?? this.summaryMessage());
  }

  summaryMessage(): string {
    return this.formatMessage();
  }

  private async initialize(): Promise<void> {
    try {
      const { default: ora } = await import('ora');
      this.spinner = ora({
        text: this.formatMessage(),
        spinner: 'dots'
      });
      this.spinner.start();
      this.usingSpinner = true;
    } catch {
      this.usingSpinner = false;
      this.renderFallback();
    }
  }

  private updateDisplay(): void {
    const message = this.formatMessage();
    if (this.usingSpinner && this.spinner) {
      this.spinner.text = message;
    } else {
      this.renderFallback();
    }
  }

  private renderFallback(): void {
    const message = this.formatMessage();
    const padded =
      message.length < this.fallbackRenderedLength
        ? message + ' '.repeat(this.fallbackRenderedLength - message.length)
        : message;
    process.stdout.write(`\r${padded}`);
    this.fallbackRenderedLength = Math.max(this.fallbackRenderedLength, message.length);
  }

  private clearFallback(): void {
    if (this.fallbackRenderedLength === 0) {
      return;
    }
    const blank = ' '.repeat(this.fallbackRenderedLength);
    process.stdout.write(`\r${blank}\r`);
    this.fallbackRenderedLength = 0;
  }

  private formatMessage(): string {
    const base = `Processing ${this.processed}/${this.total}`;
    const successPart = chalk.green(`${this.successes} ✓`);
    const failurePart = this.failures > 0 ? ` ${chalk.red(`${this.failures} ✗`)}` : '';
    return `${base} — ${successPart}${failurePart}`;
  }
}
