import api from './api';
import config from '../config';

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/ipfs/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export function getIPFSGatewayUrl(cid) {
  return `${config.ipfsGateway}/ipfs/${cid}`;
}
