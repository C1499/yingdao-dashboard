import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { YingdaoModule } from './yingdao/yingdao.module';

@Module({
  imports: [YingdaoModule],
  controllers: [AppController],
})
export class AppModule {}
