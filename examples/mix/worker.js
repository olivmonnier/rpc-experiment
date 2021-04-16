import { RPCService } from '../../src/RPCService.js';
import dataService from '../dataService.js';

const channel = new BroadcastChannel('ChannelDataService');
const rpcService = new RPCService({
  attachRequestHandler(handler) {
    self.onmessage = m => handler(m.data)
  },
  sendResponse(message) {
    self.postMessage(message);
    channel.postMessage(message);
  }
});
rpcService.registerHost('DataService', dataService);