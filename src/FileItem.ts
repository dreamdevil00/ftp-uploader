import { IFileItem, ItemStatus } from './types';
import * as uuidv1 from 'uuid/v1';
export class FileItem {
  id: number | string = uuidv1();
  isDirectory = false;
  name = '';
  localPath = '';
  serverPath = '/';
  size = 0;
  error: null | string = null;
  transferred = 0;
  status: ItemStatus = ItemStatus.Ready;

  constructor(item: IFileItem) {
    Object.assign(this, item);
  }

  setTransferred(transferred: number): void {
    this.transferred = transferred;
  }
}
