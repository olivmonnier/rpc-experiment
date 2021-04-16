import { RPCService } from '../../src/RPCService.js';

async function run() {
  const worker = new Worker("worker.js", { type: "module" });
  const rpcService = new RPCService({
    sendRequest(message) {
      worker.postMessage(message)
    },
    attachResponseHandler(handler) {
      worker.onmessage = m => {
        handler(m.data)
      }
    }
  });
  const proxy = rpcService.createProxy("DataService");
  const result = await proxy.processData([1, 4, 9]);
  console.log("Result", result);
}

run()