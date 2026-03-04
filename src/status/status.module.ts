import { Module } from '@nestjs/common';
import { StatusGateway } from './status.gateway';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StatusController],
  providers: [StatusGateway, StatusService],
})
export class StatusModule {}
