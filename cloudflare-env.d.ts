type WebsiteConfig = import('cf/config').UnwrapConfig<
  typeof import('./cloudflare.config').default
>;
type WebsiteWorker = import('cf/config').UnwrapConfig<WebsiteConfig['worker']>;
type WebsiteBindings = import('cf/config').InferEnv<WebsiteWorker>;

declare global {
  // OpenNext requires interface merging; binding members come from the config.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface CloudflareEnv extends WebsiteBindings {}
}

export {};
