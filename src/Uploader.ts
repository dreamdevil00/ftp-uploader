import * as fs from 'fs';
import * as path from 'path';
import {Behavior, ICredential, IFileItem, ItemStatus, IProgress} from './types';
import {FileItem} from './FileItem';
import {FtpClient} from './FtpClient';
import {Queue} from './Queue';

export class Uploader {
  private isUploading = false;
  private isFinished = false;

  private lastTransferred = 0;
  private lastProcessTime = 0;
  private currentUploadingPath = '';
  private currentUploadingId: number | string = -1;
  private speedAverageArr: number[] = [];
  private speedAverage = 0;

  private queue: Queue;
  private ftpClient: FtpClient;

  private stepTimeout: NodeJS.Timer | null = null;
  private rdStream: fs.ReadStream | null = null;

  constructor(config: {credentials: ICredential; behavior: Behavior}) {
    const {credentials, behavior} = config;
    this.queue = new Queue();
    this.ftpClient = new FtpClient(credentials, behavior);

    this.ftpClient.on('error', (error) => {
      this.onConnectionError(error);
    });

    this.ftpClient.on('end', () => {
      this.onConnectionEnd();
    });

    this.ftpClient.on('close', () => {
      this.onConnectionClose();
    });

    this.onInit();
  }

  get transferStatus() {
    return {
      isUploading: this.isUploading,
      isFinished: this.isFinished,
      speedAverage: this.speedAverage,
      total: this.queue.size,
      finishedCount: this.queue.statusCount.finished,
      errorCount: this.queue.statusCount.error,
    };
  }

  upload(files: IFileItem[]) {
    if (files.length > 0) {
      this.queue.bulkAddItems(files);
      if (this.currentUploadingId === -1) {
        this.isUploading = true;
        this.isFinished = false;
        this.startUpload();
      }
    }
  }

  onInit(): void {}
  onBeforeUploadItem(item: FileItem | null): void {}
  onAfterUploadItem(item: FileItem | null): void {}
  onErrorUploadItem(item: FileItem | null): void {}
  onConnectionError(error: Error): void {}
  onConnectionEnd(): void {}
  onConnectionClose(): void {}
  onFinished(): void {}

  onProgress(progress: IProgress): void {}

  private startUpload(): void {
    const item = this.queue.nextReadyItem();

    if (item) {
      this.uploadItem(item);
    } else {
      this.uploadQueueFinished();
    }
  }

  private step(rdStreamOrSize: fs.ReadStream | number, item: FileItem): void {
    const transferred =
      typeof rdStreamOrSize === 'number'
        ? rdStreamOrSize
        : rdStreamOrSize.bytesRead;

    this.queue.setItemTransferred(item, transferred);

    const currentPath = item.localPath;

    if (this.currentUploadingPath === '') {
      this.currentUploadingPath = currentPath;
    }

    const isSameFile = this.currentUploadingPath === currentPath;

    if (this.lastProcessTime > 0) {
      let delta = 0;

      if (isSameFile) {
        // 上传流为同一文件， 传输字节数为 读取的字节数差值
        delta = transferred - this.lastTransferred;
      } else {
        // 上传流和上次不是同一文件， 传输字节数为 transferred， 此处会有误差
        delta = transferred;
        this.currentUploadingPath = currentPath;
      }
      const speed =
        delta / ((new Date().getTime() - this.lastProcessTime) / 1000);
      this.speedAverageArr.push(speed);
      this.speedAverageArr = this.speedAverageArr.slice(-5);

      const sum = this.speedAverageArr.reduce((pre, cur) => pre + cur, 0);
      const speedAverage = Math.round(sum / this.speedAverageArr.length);
      this.speedAverage = speedAverage;

      this.onProgress({
        transferStatus: this.transferStatus,
        item: this.queue.getItemById(item.id),
      });
    }
    this.lastProcessTime = new Date().getTime();
    this.lastTransferred = transferred;
  }

  private uploadItem(item: FileItem): void {
    const {localPath, isDirectory, serverPath} = item;
    const serverDirectory = path.dirname(serverPath);

    this.onBeforeUploadItem(item);
    this.readyUploadItem(item);

    if (!fs.existsSync(localPath)) {
      this.error(item, `${localPath} 不存在!`);
      return;
    }

    if (isDirectory) {
      this.ftpClient
        .mkdirRecursive(serverDirectory)
        .then(() => this.completeUploadItem(item))
        .catch((err) => this.error(item, err.message));
      return;
    }

    this.makeSureDirExist(serverDirectory).then(
      () => this.startTransfer(item),
      (err) => {
        this.error(item, err.message);
      },
    );
  }

  private makeSureDirExist(dir: string): Promise<void> {
    return this.ftpClient
      .readdir(dir)
      .then(() => {})
      .catch((err) => this.ftpClient.mkdirRecursive(dir));
  }

  private error(item: FileItem, err: string): void {
    if (this.stepTimeout) {
      clearTimeout(this.stepTimeout);
      this.stepTimeout = null;
    }
    this.errorUploadItem(item, err);
  }

  private complete(item: FileItem): void {
    this.step(item.size, item);
    if (this.stepTimeout) {
      clearTimeout(this.stepTimeout);
      this.stepTimeout = null;
    }
    this.completeUploadItem(item);
  }

  private stepRecursive(item: FileItem): void {
    const self = this;
    this.stepTimeout = setTimeout(function statFunc() {
      if (self.rdStream) {
        self.step(self.rdStream, item);
      }
      self.stepTimeout = setTimeout(statFunc, 500);
    }, 500);
  }

  private startTransfer(item: FileItem): void {
    const {localPath, serverPath} = item;
    this.rdStream = fs.createReadStream(localPath);

    this.ftpClient
      .upload(this.rdStream, serverPath)
      .then(() => {
        this.complete(item);
      })
      .catch((err) => {
        this.error(item, err.message);
      });
    this.stepRecursive(item);
  }

  private readyUploadItem(item: FileItem): void {
    this.currentUploadingId = item.id;
    this.queue.setItemStatus(item, ItemStatus.Uploading);
  }

  private completeUploadItem(item: FileItem): void {
    this.queue.setItemStatus(item, ItemStatus.Complete);
    this.queue.setItemTransferred(item, item.size);

    this.onAfterUploadItem(this.queue.getItemById(item.id));

    this.startUpload();
  }

  private errorUploadItem(item: FileItem, errMessage: string): void {
    this.queue.setItemStatus(item, ItemStatus.Error, errMessage);
    this.onErrorUploadItem(this.queue.getItemById(item.id));

    this.startUpload();
  }

  private uploadQueueFinished(): void {
    this.isUploading = false;
    this.isFinished = true;

    this.ftpClient.disconnect();

    this.currentUploadingPath = '';
    this.currentUploadingId = -1;

    this.lastTransferred = 0;
    this.lastProcessTime = 0;

    this.speedAverageArr = [];
    this.speedAverage = 0;

    this.onFinished();
  }
}
