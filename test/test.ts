import {
  Uploader,
  ICredential,
  Behavior,
  FileItem,
  IFileItem,
  IProgress,
} from '../src';

const cre: ICredential = {
  host: '127.0.0.1',
  port: 21,
  user: 'uploader',
  password: 'Passw0rd',
};

const uploader = new Uploader({ credentials: cre, behavior: Behavior.Cover });

uploader.onBeforeUploadItem = function before(item: FileItem | null) {
  if (item) {
    console.log('开始上传:', item.localPath);
  }
};

uploader.onAfterUploadItem = function after(item: FileItem | null) {
  if (item) {
    console.log('上传完毕:', item.localPath);
  }
};

uploader.onErrorUploadItem = function error(item: FileItem | null) {
  if (item) {
    console.log(`上传出错: ${item.localPath} ${item.error}`);
  }
};

uploader.onConnectionError = function connectionError(error) {
  console.log(`连接出错: ${error.message}`);
};

/*
uploader.onProgress = function progress(pro: IProgress) {
  console.log(`progress: `, pro);
}; */

const file: IFileItem = {
  name: 'vs2015.com_chs.iso',
  localPath: 'E:\\开发\\环境搭建\\strongloop\\vs2015\\vs2015.com_chs.iso',
  serverPath: '/vs2015.com_chs.iso',
  size: 4013920256,
  isDirectory: false,
};

uploader.upload([file]);
