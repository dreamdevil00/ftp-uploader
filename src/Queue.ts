import { FileItem } from './FileItem';
import { IFileItem, ItemStatus } from './types';
import { EventEmitter } from 'events';
export class Queue extends EventEmitter {
  private queue: FileItem[] = [];
  constructor() {
    super();
  }

  get size(): number {
    return this.queue.length;
  }

  get statusCount(): { finished: number; error: number } {
    let finishedCount = 0;
    let errorCount = 0;
    for (const item of this.queue) {
      switch (item.status) {
        case ItemStatus.Complete:
          finishedCount++;
          break;
        case ItemStatus.Error:
          errorCount++;
          break;
        default:
      }
    }
    return {
      finished: finishedCount,
      error: errorCount,
    };
  }

  /**
   * 添加传输文件到队列中
   * @param {IFileItem} item 文件项
   * @returns {number} 添加文件项后的队列长度
   */
  addItem(item: IFileItem): number {
    this.queue.push(new FileItem(item));

    this.emit('itemAdded', item);

    return this.size;
  }

  /**
   *
   * 删除文件项， 并返回删除的文件项
   * @param {(number | string)} id 文件项ID
   * @returns {(FileItem | null)} 删除的文件项
   * @memberof Queue
   */
  removeItemById(id: number | string): FileItem | null {
    const { item, position } = this.getItemWithPosition(id);

    if (position !== -1) {
      this.queue.splice(position, 1);
    }

    this.emit('itemRemoved');

    return item;
  }

  /**
   * 根据ID获取文件项
   *
   * @param {(string | number)} id
   * @returns {(FileItem | null)}
   * @memberof Queue
   */
  getItemById(id: string | number): FileItem | null {
    for (const item of this.queue) {
      if (item.id === id) {
        return Object.assign({}, item);
      }
    }
    return null;
  }

  /**
   * 获取所有文件项
   *
   * @returns {FileItem[]}
   * @memberof Queue
   */
  getItems(): FileItem[] {
    return this.queue.map((item) => Object.assign({}, item));
  }

  /**
   * 批量添加文件项
   *
   * @param {IFileItem[]} items
   * @memberof Queue
   */
  bulkAddItems(items: IFileItem[]) {
    const bulk = items.map((item) => new FileItem(item));
    this.queue.push(...bulk);

    this.emit('bulkItemsAdded', bulk);
  }

  /**
   * 清空传输队列
   *
   * @memberof Queue
   */
  clear() {
    this.queue = [];

    this.emit('queueCleared');
  }

  /**
   * 设置文件项状态
   *
   * @param {(number | string)} id
   * @param {ItemStatus} status
   * @param {string} [error]
   * @memberof Queue
   */
  setItemStatusById(
    id: number | string,
    status: ItemStatus,
    error?: string,
  ): void {
    const { position } = this.getItemWithPosition(id);
    if (position !== -1) {
      this.queue[position].status = status;
      this.queue[position].error = error || null;
    }
  }

  /**
   * 设置文件项状态
   *
   * @param {FileItem} item
   * @param {ItemStatus} status
   * @param {string} [error]
   * @memberof Queue
   */
  setItemStatus(item: FileItem, status: ItemStatus, error?: string): void {
    const { id } = item;
    this.setItemStatusById(id, status, error);
  }

  /**
   * 设置文件项已传输字节数
   *
   * @param {FileItem} item
   * @param {number} transferred
   * @memberof Queue
   */
  setItemTransferred(item: FileItem, transferred: number): void {
    const { id } = item;
    for (const obj of this.queue) {
      if (obj.id === id) {
        obj.setTransferred(transferred);
      }
    }
  }

  /**
   * 更新文件项已传输字节数
   *
   * @param {FileItem} item
   * @param {number} transferred
   * @memberof Queue
   */
  updateItemTransferred(item: FileItem, transferred: number): void {
    const { id } = item;
    for (const obj of this.queue) {
      if (obj.id === id) {
        obj.setTransferred(transferred);
      }
    }
  }

  /**
   * 获取下一个准备就绪的文件项
   *
   * @returns {(FileItem | null)}
   * @memberof Queue
   */
  nextReadyItem(): FileItem | null {
    for (const item of this.queue) {
      if (item.status === ItemStatus.Ready) {
        return Object.assign({}, item);
      }
    }
    return null;
  }

  private getItemWithPosition(
    id: number | string,
  ): { item: FileItem | null; position: number } {
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item.id === id) {
        return {
          item,
          position: i,
        };
      }
    }
    return {
      item: null,
      position: -1,
    };
  }
}
