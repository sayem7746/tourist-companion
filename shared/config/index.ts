/** Shared configuration contracts. */

export interface AppEnvironment {
  name: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
}

export const defaultDevEnvironment: AppEnvironment = {
  name: 'development',
  apiBaseUrl: 'http://localhost:3000',
};
