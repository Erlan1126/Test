declare const worker: { fetch(request: Request, env: unknown): Promise<Response> };
export default worker;
