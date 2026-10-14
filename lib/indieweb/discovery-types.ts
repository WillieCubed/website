export interface OEmbedResponse {
  version: '1.0';
  type: 'rich';
  provider_name: string;
  provider_url: string;
  title: string;
  author_name: string;
  author_url: string;
  html: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  cache_age: number;
}

export interface OEmbedBuildOptions {
  targetUrl: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
}

export interface OEmbedHtmlParts {
  title: string;
  description?: string;
  url: string;
}

export interface WebFingerLink {
  rel: string;
  type?: string;
  href: string;
}

export interface WebFingerResponse {
  subject: string;
  aliases: string[];
  links: WebFingerLink[];
}

export interface HostMetaLink {
  rel: string;
  template: string;
}

export interface HostMetaResponse {
  links: HostMetaLink[];
}
