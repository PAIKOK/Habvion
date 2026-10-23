import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * A tiny JSON document on disk: read once, writes serialised, each write atomic
 * (temp file + rename) and private to the owner (mode 600).
 */
export class JsonFile<T> {
  #data: T | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly path: string,
    private readonly empty: () => T,
  ) {}
  async read(): Promise<T> {
    if (this.#data) return this.#data;
    try {
      this.#data = JSON.parse(await readFile(this.path, "utf8")) as T;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      this.#data = this.empty();
    }
    return this.#data;
  }
  /** Run a change against the current data and persist it, one at a time. */
  update<R>(change: (data: T) => R): Promise<R> {
    const run = this.#queue.then(async () => {
      const data = await this.read(),
        result = change(data),
        tmp = `${this.path}.${process.pid}.tmp`;
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      await writeFile(tmp, JSON.stringify(data, null, 1), { mode: 0o600 });
      await rename(tmp, this.path);
      await chmod(this.path, 0o600);
      return result;
    });
    this.#queue = run.catch(() => {});
    return run;
  }
}
