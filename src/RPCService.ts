interface RPCClientConfig {
  sendRequest?: <T>(message: MessageRequest<T>) => void;
  attachResponseHandler?: <T>(
    handler: (message: MessageResponse<T>) => void
  ) => void;
}
interface RPCServerConfig {
  sendResponse?: <T>(message: MessageResponse<T>) => void;
  attachRequestHandler?: <T>(
    handler: (message: MessageRequest<T>) => void
  ) => void;
}
interface MessageRequest<T> {
  id: number;
  type: "request";
  request: {
    hostName: string;
    methodName: string;
    args: T[];
  };
}
interface MessageResponse<T> {
  id: number;
  type: "response";
  response: {
    returnValue: T;
    err?: unknown;
  };
}

class RPCCore {
  hosts = new Map<string, any>();
  pendingRequests = new Map<number, any>();
  constructor() {}
  /**
   * Associate an existing service/object to a host name.
   * We'll use that hostName to create the proxy
   * @param {string} hostName
   * @param {any} host
   */
  registerHost<T>(hostName: string, host: T) {
    this.hosts.set(hostName, host);
  }
}
export class RPCClient extends RPCCore {
  private nextMessageId = 0;
  config: RPCClientConfig;
  constructor(config: RPCClientConfig) {
    super();
    this.config = config;
    if (this.config.attachResponseHandler) {
      this.config.attachResponseHandler(this.handleResponse.bind(this));
    }
  }
  /**
   * Create a proxy over a given host
   * @param {sring} hostName The host name of the host to proxy
   */
  createProxy<TObj extends object>(hostName: string, service: TObj) {
    const proxyedObject = {
      hostName: hostName,
      ...service,
    };

    return new Proxy(proxyedObject, {
      get: (obj: typeof proxyedObject, methodName: string) => {
        if (methodName === "then" || methodName === "catch") return undefined;

        return <TData>(...args: TData[]) => {
          return this.sendRequest({
            methodName,
            args,
            hostName: obj.hostName,
          });
        };
      },
    });
  }

  sendRequest<T>(request: { hostName: string; methodName: string; args: T[] }) {
    return new Promise((resolve, reject) => {
      const message: MessageRequest<T> = {
        id: this.nextMessageId++,
        type: "request",
        request,
      };
      this.pendingRequests.set(message.id, {
        resolve,
        reject,
        methodName: request.methodName,
        args: request.args,
        id: message.id,
      });
      if (this.config.sendRequest) this.config.sendRequest(message);
    });
  }
  async handleResponse<T>(message: MessageResponse<T>) {
    if (message.type !== "response") return;
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
}
export class RPCServer extends RPCCore {
  config: RPCServerConfig;
  constructor(config: RPCServerConfig) {
    super();
    this.config = config;

    if (this.config.attachRequestHandler) {
      this.config.attachRequestHandler(this.handleRequest.bind(this));
    }
  }
  async handleRequest<T>(message: MessageRequest<T>) {
    if (message.type !== "request") return;
    console.log("Handling request", message);

    try {
      const request = message.request;
      const returnValue = await this.executeHostMethod(request);
      const response: MessageResponse<typeof returnValue> = {
        id: message.id,
        type: "response",
        response: {
          returnValue,
        },
      };
      console.log("Sending response", response);
      if (this.config.sendResponse) this.config.sendResponse(response);
    } catch (err) {
      const response: MessageResponse<null> = {
        id: message.id,
        type: "response",
        response: {
          returnValue: null,
          err,
        },
      };
      if (this.config.sendResponse) this.config.sendResponse(response);
    }
  }
  async executeHostMethod<T>(request: MessageRequest<T>["request"]) {
    const host = this.hosts.get(request.hostName);
    if (!host) {
      throw new Error(`Host ${request.hostName} not found`);
    }
    const method = host[request.methodName];
    if (!method) {
      throw new Error(
        `Method ${request.methodName} not found on host ${request.hostName}`
      );
    }
    return method.apply(host, request.args);
  }
}
