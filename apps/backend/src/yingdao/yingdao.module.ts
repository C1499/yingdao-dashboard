import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { YingdaoController } from './yingdao.controller';
import { YingdaoService } from './yingdao.service';
import { CredentialsService } from './credentials.service';

@Module({
  imports: [HttpModule],
  controllers: [YingdaoController],
  providers: [YingdaoService, CredentialsService],
})
export class YingdaoModule {}
