import { FileItem } from './FileItem';
export enum ItemStatus {
  Ready = 'Ready',
  Uploading = 'Uploading',
  Complete = 'Complete',
  Error = 'Error',
}

export interface IFileItem {
  isDirectory: boolean;
  name: string;
  localPath: string;
  serverPath: string;
  size: number;
}

export interface ICredential {
  host: string;
  port: number;
  user: string;
  password: string;
}

export enum Behavior {
  Cover = 'Cover',
  Skip = 'Skip',
  Verify = 'Verify',
}

export interface IProgress {
  transferStatus: {
    isUploading: boolean;
    isFinished: boolean;
    speedAverage: number;
    total: number;
    finishedCount: number;
    errorCount: number;
  };
  item: {
    id: number | string;
    isDirectory: boolean;
    name: string;
    localPath: string;
    serverPath: string;

    error: null | string;
    transferred: number;
    status: ItemStatus;
  } | null;
}
