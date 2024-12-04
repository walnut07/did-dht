// bittorrent-dht is written in JavaScript, and does not have types.
declare module 'bittorrent-dht' {
  import { EventEmitter } from 'events';

  interface DHTOptions {
    bootstrap?: string[] | boolean;
    nodeId?: Buffer | string;
    concurrency?: number;
    maxAge?: number;
  }

  export default class DHT extends EventEmitter {
    constructor(options?: DHTOptions);
    listen(port?: number, address?: string, callback?: () => void): void;
    put(opts: object, callback: (err: Error | null, hash: string) => void): void;
    get(hash: string, callback: (err: Error | null, value: Buffer) => void): void;
    destroy(callback?: () => void): void;
  }
}
