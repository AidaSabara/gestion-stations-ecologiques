declare module 'kuzzle-sdk' {
  export default class Kuzzle {
    constructor(protocol: string, options?: any);
    
    connect(): Promise<void>;
    disconnect(): void;
    
    document: {
      search(
        index: string,
        collection: string,
        query: any,
        options?: any
      ): Promise<any>;
      
      get(
        index: string,
        collection: string,
        id: string
      ): Promise<any>;
      
      create(
        index: string,
        collection: string,
        document: any,
        id?: string,
        options?: any
      ): Promise<any>;
      
      update(
        index: string,
        collection: string,
        id: string,
        document: any,
        options?: any
      ): Promise<any>;
      
      delete(
        index: string,
        collection: string,
        id: string,
        options?: any
      ): Promise<any>;
      
      count(
        index: string,
        collection: string,
        query: any
      ): Promise<number>;
    };
  }
}