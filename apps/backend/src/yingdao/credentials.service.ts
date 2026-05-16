import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';

@Injectable()
export class CredentialsService {
  private readonly backendRoot = resolve(__dirname, '..', '..');
  private readonly dataDir = join(this.backendRoot, 'data');
  private readonly credentialsPath = join(this.dataDir, 'credentials.local.json');
  private readonly exampleCredentialsPath = join(this.dataDir, 'credentials.example.json');
  private readonly legacyCredentialsPaths = [
    join(process.cwd(), 'apps/backend/data/credentials.json'),
    join(process.cwd(), 'apps/backend/apps/backend/data/credentials.json'),
  ];

  async getCredentials() {
    for (const path of [
      this.credentialsPath,
      ...this.legacyCredentialsPaths,
      this.exampleCredentialsPath,
    ]) {
      try {
        const raw = await fs.readFile(path, 'utf-8');
        return JSON.parse(raw);
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  async saveCredentials(payload: {
    apiBaseUrl?: string;
    accessKeyId: string;
    accessKeySecret: string;
    accountName?: string;
  }) {
    const data = {
      apiBaseUrl: payload.apiBaseUrl?.trim() || 'https://api.yingdao.com',
      accessKeyId: payload.accessKeyId,
      accessKeySecret: payload.accessKeySecret,
      accountName: payload.accountName?.trim() || '',
      updatedAt: new Date().toISOString(),
    };

    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.credentialsPath, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
}
