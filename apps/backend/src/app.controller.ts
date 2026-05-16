import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  status() {
    return { status: 'ok', message: 'Yingdao dashboard backend' };
  }
}
