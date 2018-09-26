import * as fs from 'fs';
import * as Client from '@icetee/ftp';
import * as path from 'path';
import {Behavior, ICredential} from './types';
import {EventEmitter} from 'events';
import {promisifyAll} from 'bluebird';

export class FtpClient extends EventEmitter {
  private ftp: Client | null = null;
  private connected = false;
  private credential: ICredential;
  private behavior: Behavior = Behavior.Verify;

  constructor(cred: ICredential, behavior: Behavior) {
    super();

    this.credential = cred;
    this.behavior = behavior;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnection(): Promise<Client> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        let ftp = new Client();
        ftp = promisifyAll(ftp);
        this.ftp = ftp;
        this.ftp
          .on('ready', () => {
            this.connected = true;
            resolve(this.ftp as Client);
          })
          .on('error', (error: Error) => {
            this.emit('error', error);
            this.disconnect();
          })
          .on('end', () => {
            this.emit('end');
            this.disconnect();
          })
          .on('close', () => {
            this.emit('close');
            this.disconnect();
          });

        this.ftp.connect(this.credential);
      } else {
        resolve(this.ftp as Client);
      }
    });
  }

  disconnect(): void {
    if (this.connected) {
      this.connected = false;
      (this.ftp as Client).destroy();
      this.ftp = null;
    }
  }

  mkdirRecursive(directory: string): Promise<void> {
    const isWin = process.platform;
    const dir = isWin
      ? path
          .normalize(directory)
          .split('\\')
          .join('/')
      : directory;
    return this.getConnection().then((connection) => {
      return (connection as any).mkdirAsync(dir, true);
    });
  }

  upload(localPath: string | fs.ReadStream, serverPath: string): Promise<any> {
    return this.getConnection().then((connection) => {
      switch (this.behavior) {
        case Behavior.Cover:
          return (connection as any).putAsync(localPath, serverPath);
        case Behavior.Skip:
          return Promise.resolve(null);
        case Behavior.Verify:
        default:
          return this.stat(serverPath).then((stat) => {
            if (stat) {
              const lPath =
                typeof localPath === 'string' ? localPath : localPath.path;
              const localSize = fs.lstatSync(lPath).size;

              if (localSize > stat.size) {
                return (connection as any)
                  .restartAsync(stat.size)
                  .then(() =>
                    (connection as any).putAsync(localPath, serverPath),
                  );
              }
            } else {
              return (connection as any).putAsync(localPath, serverPath);
            }
          });
      }
    });
  }

  readdir(
    directory: string,
  ): Promise<
    Array<{
      size: number;
      filename: string;
      isDirectory: boolean;
      path: string;
    }>
  > {
    return this.getConnection().then((connection) => {
      return (connection as any)
        .listSafeAsync(directory, false)
        .then((list: Client.ListingElement[] | undefined) => {
          const files: Array<{
            size: number;
            filename: string;
            isDirectory: boolean;
            path: string;
          }> = [];

          if (typeof list !== 'undefined') {
            list.forEach((file) => {
              if (file.name !== '.' && file.name !== '..') {
                const dir =
                  directory.substr(-1) !== '/' ? `${directory}/` : directory;

                files.push({
                  size: +file.size,
                  filename: file.name,
                  isDirectory: file.type === 'd',
                  path: dir,
                });
              }
            });
          }

          return files;
        });
    });
  }

  stat(
    filePath: string,
  ): Promise<null | {filename: string; path: string; size: number}> {
    return this.getConnection().then((connection) => {
      const dir = path.win32.dirname(filePath);
      return (connection as any)
        .listSafeAsync(dir, false)
        .then((list: Client.ListingElement[]) => {
          const filename = path.win32.basename(filePath);
          for (let i = 0, j = list.length; i < j; i++) {
            const item = list[i];
            if (item.name === filename) {
              return {
                filename: path.basename(filePath),
                path: filePath,
                size: item.size,
              };
            }
          }
          return null;
        });
    });
  }
}
