import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CredentialsService } from './credentials.service';

@Injectable()
export class YingdaoService {
  private readonly logger = new Logger(YingdaoService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly credentialsService: CredentialsService,
  ) {}

  private async getBaseUrl(): Promise<string> {
    const saved = await this.credentialsService.getCredentials();
    return saved?.apiBaseUrl ?? 'https://api.yingdao.com';
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRequestLimitExceeded(error: any) {
    const responseData = error?.response?.data;
    const text = JSON.stringify(responseData || error?.message || '');
    return text.includes('RequestLimitExceeded') || error?.response?.status === 429;
  }

  private async createTokenInner(): Promise<string> {
    const creds = await this.credentialsService.getCredentials();
    if (!creds?.accessKeyId || !creds?.accessKeySecret) {
      throw new Error('Missing credentials');
    }

    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}/oapi/token/v2/token/create?accessKeyId=${encodeURIComponent(
      creds.accessKeyId,
    )}&accessKeySecret=${encodeURIComponent(creds.accessKeySecret)}`;

    const response = await firstValueFrom(this.http.get(url));
    const data = response.data;
    const accessToken = data?.accessToken || data?.data?.accessToken;
    if (!accessToken) {
      throw new Error('Unable to resolve access token from response');
    }

    const expiresInSeconds = Number(data?.expiresIn || data?.data?.expiresIn || 300);
    const ttlMs = Math.max(60_000, Math.min(expiresInSeconds * 1000, 10 * 60_000));
    this.cachedToken = {
      value: accessToken,
      expiresAt: Date.now() + ttlMs - 30_000,
    };

    return accessToken;
  }

  private async createToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }

    if (!this.tokenPromise) {
      this.tokenPromise = this.createTokenInner().finally(() => {
        this.tokenPromise = null;
      });
    }

    return this.tokenPromise;
  }

  private async request(method: 'GET' | 'POST', path: string, data?: any, query?: Record<string, string>) {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${path}${query ? `?${new URLSearchParams(query).toString()}` : ''}`;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const token = await this.createToken();
      this.logger.debug(`[api-request] ${method} ${url} (attempt ${attempt}) payloadKeys=${Object.keys(data || {}).join(',')}`);

      const config = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data,
      };

      try {
        const response = await firstValueFrom(this.http.request(config));
        return response.data;
      } catch (error: any) {
        const unauthorized = error?.response?.status === 401;
        if (unauthorized) {
          this.cachedToken = null;
        }

        if (attempt === 3 || (!this.isRequestLimitExceeded(error) && !unauthorized)) {
          throw error;
        }

        const backoffMs = unauthorized ? 300 : 400 * 2 ** (attempt - 1);
        this.logger.warn(`[api-rate-limit] Retrying ${path} after ${backoffMs}ms due to ${unauthorized ? 'unauthorized' : 'rate limit'}`);
        await this.sleep(backoffMs);
      }
    }
  }

  async getToken() {
    return { accessToken: await this.createToken() };
  }

  async queryApps() {
    const firstPage = await this.request('POST', '/oapi/app/open/query/list', {
      page: '1',
      size: '100',
    });
    const data = Array.isArray(firstPage?.data) ? firstPage.data : [];
    const pages = Number(firstPage?.page?.pages || 1);

    if (pages <= 1) {
      return firstPage;
    }

    const restData: any[] = [];
    for (let page = 2; page <= pages; page += 1) {
      await this.sleep(220);
      const result = await this.request('POST', '/oapi/app/open/query/list', {
        page: String(page),
        size: '100',
      });
      if (Array.isArray(result?.data)) {
        restData.push(...result.data);
      }
    }

    return {
      ...firstPage,
      data: [...data, ...restData],
      page: {
        ...firstPage?.page,
        page: 1,
        size: data.length + restData.length,
      },
    };
  }

  async queryAppRunRecords(minId = 0, size = 100, beginDate?: string, endDate?: string, appId?: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const defaultBeginDate = sevenDaysAgo.toISOString().slice(0, 19).replace('T', ' ');
    const defaultEndDate = now.toISOString().slice(0, 19).replace('T', ' ');

    const payload: Record<string, any> = {
      minId,
      size: String(size),
    };

    if (appId) {
      payload.appId = appId;
    } else {
      payload.beginDate = beginDate || defaultBeginDate;
      payload.endDate = endDate || defaultEndDate;
    }

    return this.request('POST', '/oapi/app/open/query/use/record/list', payload);
  }

  async queryRobots() {
    const result = await this.request('POST', '/oapi/dispatch/v2/client/list', {
      page: 1,
      size: 50,
    });
    return result;
  }

  async queryRobotDetail(accountName?: string, robotClientUuid?: string) {
    const payload = accountName ? { accountName } : { robotClientUuid };
    return this.request('POST', '/oapi/dispatch/v2/client/query', payload);
  }

  async listTasks() {
    const result = await this.request('POST', '/oapi/dispatch/v2/schedule/list', {
      key: '',
      enabled: true,
      scheduleType: 'period',
      page: 1,
      size: 50,
    });
    return result;
  }

  async getTaskDetail(scheduleUuid: string, robotClientUuid?: string) {
    return this.request('POST', '/oapi/dispatch/v2/schedule/detail', {
      scheduleUuid,
      robotClientUuid,
    });
  }

  async getAppParams(robotUuid: string) {
    return this.request('GET', '/oapi/robot/v2/queryRobotParam', undefined, {
      robotUuid,
    });
  }

  async getTaskExecutions(sourceUuid: string) {
    return this.request('POST', '/oapi/dispatch/v2/task/list', {
      sourceUuid,
      cursorDirection: 'next',
      size: 20,
    });
  }

  async getNewestTaskExecutions(page = 1, size = 100, statusList?: string[], startTime?: string, endTime?: string) {
    return this.request('POST', '/oapi/dispatch/v2/task/newest/list', {
      page,
      size,
      statusList,
      startTime,
      endTime,
    });
  }

  async getTaskProcessDetail(taskUuid: string, robotClientUuid: string) {
    return this.request('POST', '/oapi/dispatch/v2/task/process/detail', {
      taskUuid,
      robotClientUuid,
    });
  }

  async getRobotJobQueue(robotClientUuid: string, cursorId?: number, cursorDirection = 'next', size = 20) {
    return this.request('POST', '/oapi/dispatch/v2/job/list', {
      robotClientUuid,
      cursorId,
      cursorDirection,
      size,
    });
  }

  async searchJobLogs(jobUuid: string, page = 1, size = 20, queryFilter?: Record<string, unknown>) {
    return this.request('POST', '/oapi/dispatch/v2/job/log/search', {
      jobUuid,
      page,
      size,
      queryFilter,
    });
  }

  async queryJobLogs(requestId: string) {
    return this.request('GET', '/oapi/dispatch/v2/job/log/query', undefined, {
      requestId,
    });
  }

  async startTask(scheduleUuid: string, scheduleRelaParams?: any[]) {
    const body: any = { scheduleUuid };
    if (scheduleRelaParams) {
      body.scheduleRelaParams = scheduleRelaParams;
    }
    return this.request('POST', '/oapi/dispatch/v2/task/start', body);
  }

  async stopTask(taskUuid: string) {
    return this.request('POST', '/oapi/dispatch/v2/task/stop', { taskUuid });
  }

  async retryTask(taskUuid: string) {
    return this.request('POST', '/oapi/dispatch/v2/task/retry', { taskUuid });
  }

  async queryTaskResult(taskUuid: string) {
    return this.request('POST', '/oapi/dispatch/v2/task/query', { taskUuid });
  }

  async taskDetail(scheduleUuid: string): Promise<any> {
    return this.getTaskDetail(scheduleUuid);
  }
}
