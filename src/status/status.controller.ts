import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatusService } from './status.service';

@Controller('status')
@UseGuards(JwtAuthGuard)
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get('jobs')
  async getMyJobs(@Request() req: any) {
    const userId = req.user.userId;
    return this.statusService.getJobsByUser(userId);
  }

  @Get('jobs/:id')
  async getJobById(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId;
    return this.statusService.getJobById(id, userId);
  }

  @Get('jobs/:id/download')
  async getDownloadUrl(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId;
    const url = await this.statusService.getDownloadUrl(id, userId);
    return { downloadUrl: url };
  }

  @Get('video/:videoId')
  async getJobByVideoId(@Param('videoId') videoId: string, @Request() req: any) {
    const userId = req.user.userId;
    const job = await this.statusService.getJobByVideoId(videoId, userId);
    if (!job) {
      throw new NotFoundException(`No job found for video ${videoId}`);
    }
    return job;
  }
}
