import type { ArticlePayload } from './types';

export type ExtractOk = {
  ok: true;
  article: Omit<ArticlePayload, 'id' | 'createdAt'>;
};

export type ExtractFail = {
  ok: false;
  error: 'no-article' | 'not-german' | 'unsupported';
  message: string;
  score?: number;
};

export type ExtractResponse = ExtractOk | ExtractFail;

export type RuntimeMessage = {
  type: 'EXTRACT_ARTICLE';
  forceGerman?: boolean | null;
};
