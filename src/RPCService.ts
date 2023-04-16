interface RPCServiceConfig {
  sendResponse?: (message: any) => void;
  sendRequest?: (message: any) => void;
  attachRequestHandler?: <T>(handler: (message: MessageRequest<T>) => void) => void;
  attachResponseHandler?: <T>(handler: (message: MessageResponse<T>) => void) => void;
}
interface MessageRequest<T> {
  id: number;
  type: "request";
  request: {
    hostName: string;
    methodName: string;
    args: T[];
  }
}
interface MessageResponse<T> {
  id: number;
  type: "response";
  response: {
    returnValue: T;
    err?: unknown;
  }
}

export class RPCService {
  private pendingRequests = new Map<number, any>();
  private hosts = new Map<string, any>();
  private nextMessageId = 0;
  private config: RPCServiceConfig;

  constructor(config: RPCServiceConfig) {
    this.config = config;

    if (this.config.attachRequestHandler) {
      this.config.attachRequestHandler(this.handleRequest.bind(this));
    }
    if (this.config.attachResponseHandler) {
      this.config.attachResponseHandler(this.handleResponse.bind(this));
    }
  }

  async handleRequest<T>(message: MessageRequest<T>) {
    if (message.type !== "request") return
    console.log("Handling request", message);

    try {
      const request = message.request;
      const returnValue = await this.executeHostMethod(request);
      const response: MessageResponse<typeof returnValue> = {
        id: message.id,
        type: "response",
        response: {
          returnValue
        }
      }
      console.log("Sending response", response);
      if (this.config.sendResponse) this.config.sendResponse(response);
    } catch(err) {
      const response: MessageResponse<null> = {
        id: message.id,
        type: "response",
        response: {
          returnValue: null,
          err
        }
      }
      console.log("Sending response", response);
      if (this.config.sendResponse) this.config.sendResponse(response);
    }
  }

  handleResponse<T>(message: MessageResponse<T>) {
    if (message.type !== "response") return
    console.log("Handling response", message);
    const pendingRequest = this.pendingRequests.get(message.id);
    if (!pendingRequest) {
      console.warn("RPCService received a response for a non pending request");
      return;
    }
    this.pendingRequests.delete(message.id);
    const response = message.response;
    if (response.err) {
      pendingRequest.reject(response.err);
    } else {
      pendingRequest.resolve(response.returnValue);
    }
  }

  async executeHostMethod<T>(request: MessageRequest<T>['request']) {
    const host = this.hosts.get(request.hostName);
    if (!host) {
      throw new Error(`Host ${request.hostName} not found`);
    }
    const method = host[request.methodName];
    if (!method) {
      throw new Error(`Method ${request.methodName} not found on host ${request.hostName}`);
    }
    return method.apply(host, request.args);
  }
}