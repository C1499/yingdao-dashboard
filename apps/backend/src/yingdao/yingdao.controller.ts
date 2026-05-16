import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { YingdaoService } from './yingdao.service';
import { CredentialsService } from './credentials.service';

@Controller('yingdao')
export class YingdaoController {
  constructor(
    private readonly yingdaoService: YingdaoService,
    private readonly credentialsService: CredentialsService,
  ) {}

  @Get('status')
  status() {
    return { status: 'ok' };
  }

  @Get('credentials')
  getCredentials() {
    return this.credentialsService.getCredentials();
  }

  @Post('credentials')
  async setCredentials(
    @Body()
    body: {
      accessKeyId: string;
      accessKeySecret: string;
      accountName?: string;
      apiBaseUrl?: string;
    },
  ) {
    return this.credentialsService.saveCredentials(body);
  }

  @Post('token')
  async token() {
    return this.yingdaoService.getToken();
  }

  @Get('apps')
  async apps() {
    return this.yingdaoService.queryApps();
  }

  @Post('apps/run-records')
  async appRunRecords(
    @Body()
    body: { minId?: number; size?: number; beginDate?: string; endDate?: string; appId?: string },
  ) {
    return this.yingdaoService.queryAppRunRecords(
      body.minId || 0,
      body.size || 100,
      body.beginDate,
      body.endDate,
      body.appId,
    );
  }

  @Get('tasks')
  async tasks() {
    return this.yingdaoService.listTasks();
  }

  @Get('robots')
  async robots() {
    return this.yingdaoService.queryRobots();
  }

  @Post('robot/detail')
  async robotDetail(@Body() body: { accountName?: string; robotClientUuid?: string }) {
    return this.yingdaoService.queryRobotDetail(body.accountName, body.robotClientUuid);
  }

  @Post('task/detail')
  async taskDetail(@Body() body: { scheduleUuid: string; robotClientUuid?: string }) {
    return this.yingdaoService.getTaskDetail(body.scheduleUuid, body.robotClientUuid);
  }

  @Post('app/params')
  async appParams(@Body() body: { robotUuid: string }) {
    return this.yingdaoService.getAppParams(body.robotUuid);
  }

  @Post('task/executions')
  async taskExecutions(@Body() body: { sourceUuid: string }) {
    return this.yingdaoService.getTaskExecutions(body.sourceUuid);
  }

  @Post('tasks/newest')
  async newestTaskExecutions(
    @Body()
    body: { page?: number; size?: number; statusList?: string[]; startTime?: string; endTime?: string },
  ) {
    return this.yingdaoService.getNewestTaskExecutions(
      body.page || 1,
      body.size || 100,
      body.statusList,
      body.startTime,
      body.endTime,
    );
  }

  @Post('task/process-detail')
  async taskProcessDetail(@Body() body: { taskUuid: string; robotClientUuid: string }) {
    return this.yingdaoService.getTaskProcessDetail(body.taskUuid, body.robotClientUuid);
  }

  @Post('robot/jobs')
  async robotJobs(
    @Body()
    body: { robotClientUuid: string; cursorId?: number; cursorDirection?: 'pre' | 'next'; size?: number },
  ) {
    return this.yingdaoService.getRobotJobQueue(
      body.robotClientUuid,
      body.cursorId,
      body.cursorDirection || 'next',
      body.size || 20,
    );
  }

  @Post('job/logs/search')
  async searchJobLogs(
    @Body()
    body: { jobUuid: string; page?: number; size?: number; queryFilter?: Record<string, unknown> },
  ) {
    return this.yingdaoService.searchJobLogs(body.jobUuid, body.page || 1, body.size || 20, body.queryFilter);
  }

  @Get('job/logs/query')
  async queryJobLogs(@Query('requestId') requestId?: string) {
    return this.yingdaoService.queryJobLogs(requestId || '');
  }

  @Post('task/start')
  async startTask(@Body() body: { scheduleUuid: string; scheduleRelaParams?: any[] }) {
    return this.yingdaoService.startTask(body.scheduleUuid, body.scheduleRelaParams);
  }

  @Post('task/stop')
  async stopTask(@Body() body: { taskUuid: string }) {
    return this.yingdaoService.stopTask(body.taskUuid);
  }

  @Post('task/retry')
  async retryTask(@Body() body: { taskUuid: string }) {
    return this.yingdaoService.retryTask(body.taskUuid);
  }

  @Post('task/query')
  async queryTaskResult(@Body() body: { taskUuid: string }) {
    return this.yingdaoService.queryTaskResult(body.taskUuid);
  }
}
