import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StatusService } from './status.service';
import { SubscribeToJobDto, UnsubscribeFromJobDto } from './dto/job-status.dto';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
  },
  namespace: '/status',
})
export class StatusGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(StatusGateway.name);
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 2000;

  constructor(
    private readonly statusService: StatusService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('📡 WebSocket Gateway initialized');
    this.startPolling();
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: no token`);
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.user = { userId: payload.sub, email: payload.email };
      this.logger.log(`✅ Client connected: ${client.id} (user: ${payload.email})`);
    } catch (error) {
      this.logger.warn(`Client ${client.id} connection rejected: invalid token`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`❌ Client disconnected: ${client.id}`);
    this.statusService.unsubscribe(client.id);
  }

  @SubscribeMessage('subscribeToJob')
  async handleSubscribe(
    @MessageBody() data: SubscribeToJobDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      // Verify the job belongs to this user
      const job = await this.statusService.getJobById(data.jobId, userId);
      this.statusService.subscribe(client.id, data.jobId);

      // Send initial status
      client.emit('statusUpdate', job);

      return { success: true, job };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('unsubscribeFromJob')
  handleUnsubscribe(
    @MessageBody() data: UnsubscribeFromJobDto,
    @ConnectedSocket() client: Socket,
  ) {
    this.statusService.unsubscribe(client.id, data.jobId);
    return { success: true };
  }

  @SubscribeMessage('getJobStatus')
  async handleGetStatus(
    @MessageBody() data: { jobId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const job = await this.statusService.getJobById(data.jobId, userId);
      return { success: true, job };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('getMyJobs')
  async handleGetMyJobs(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const jobs = await this.statusService.getJobsByUser(userId);
      return { success: true, jobs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private startPolling() {
    this.pollingInterval = setInterval(async () => {
      try {
        const updates = await this.statusService.checkForUpdates();

        for (const update of updates) {
          const socketIds = this.statusService.getSubscribedSocketIds(update.jobId);

          for (const socketId of socketIds) {
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('statusUpdate', update);
              this.logger.debug(`Sent update for job ${update.jobId} to socket ${socketId}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Polling error: ${error.message}`);
      }
    }, this.POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}
