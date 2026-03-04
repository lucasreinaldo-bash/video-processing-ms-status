# MS-Status - Video Processing Status Service

Microserviço responsável por fornecer **status em tempo real** dos jobs de processamento de vídeo através de WebSocket e REST API.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Endpoints REST](#endpoints-rest)
- [WebSocket Events](#websocket-events)
- [Autenticação](#autenticação)
- [Configuração](#configuração)
- [Execução](#execução)
- [Testes](#testes)

---

## 🎯 Visão Geral

O **MS-Status** é um microserviço que permite aos clientes acompanhar o progresso do processamento de vídeos em tempo real. Ele se conecta ao banco de dados do MS-Processor (read-only) e monitora mudanças de status, emitindo eventos via WebSocket para clientes conectados.

### Funcionalidades Principais

- ✅ **WebSocket Gateway** - Conexão em tempo real para receber atualizações de status
- ✅ **REST API** - Endpoints para consulta de status e download de resultados
- ✅ **Polling Automático** - Monitora mudanças no banco a cada 2 segundos
- ✅ **Autenticação JWT** - Validação de tokens do MS-Auth
- ✅ **Download URLs** - Geração de URLs presigned do MinIO para download dos ZIPs

---

## 🏗️ Arquitetura

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│    Frontend     │◄──────────────────►│    MS-Status    │
│   (Next.js)     │     REST API       │   (NestJS)      │
└─────────────────┘                    └────────┬────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
           ┌────────────────┐          ┌────────────────┐          ┌────────────────┐
           │   PostgreSQL   │          │     MinIO      │          │    MS-Auth     │
           │  (Processor DB)│          │  (Downloads)   │          │  (JWT Tokens)  │
           └────────────────┘          └────────────────┘          └────────────────┘
```

### Fluxo de Dados

1. **Cliente conecta** via WebSocket com JWT token
2. **Cliente se inscreve** em um ou mais jobs (`subscribeToJob`)
3. **MS-Status faz polling** no banco a cada 2 segundos
4. **Quando status muda**, emite evento `statusUpdate` para clientes inscritos
5. **Cliente pode consultar** via REST API a qualquer momento

---

## 🛠️ Tecnologias

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| NestJS | 10.3.0 | Framework Node.js |
| Socket.io | 4.7.4 | WebSocket |
| Prisma | 5.22.0 | ORM (read-only) |
| PassportJS | 0.7.0 | Autenticação |
| MinIO Client | 8.0.3 | Storage client |
| TypeScript | 5.3.3 | Linguagem |

---

## 📡 Endpoints REST

Todos os endpoints requerem autenticação via header `Authorization: Bearer <token>`.

### Health Check

```http
GET /api/v1/health
```

**Resposta:**
```json
{
  "status": "ok",
  "service": "ms-status",
  "timestamp": "2026-03-04T04:30:00.000Z"
}
```

### Listar Jobs do Usuário

```http
GET /api/v1/status/jobs
Authorization: Bearer <jwt_token>
```

**Resposta:**
```json
[
  {
    "id": "job-uuid",
    "videoId": "video-uuid",
    "userId": "user-uuid",
    "status": "COMPLETED",
    "framesExtracted": "150",
    "outputStorageKey": "processed-zips/video-uuid.zip",
    "errorMessage": null,
    "createdAt": "2026-03-04T04:00:00.000Z",
    "startedAt": "2026-03-04T04:00:05.000Z",
    "completedAt": "2026-03-04T04:01:30.000Z",
    "downloadUrl": "https://minio.../processed-zips/video-uuid.zip?..."
  }
]
```

### Obter Job Específico

```http
GET /api/v1/status/jobs/:id
Authorization: Bearer <jwt_token>
```

### Obter URL de Download

```http
GET /api/v1/status/jobs/:id/download
Authorization: Bearer <jwt_token>
```

**Resposta:**
```json
{
  "downloadUrl": "http://localhost:9000/processed-zips/video-uuid.zip?X-Amz-..."
}
```

### Obter Job por Video ID

```http
GET /api/v1/status/video/:videoId
Authorization: Bearer <jwt_token>
```

---

## 🔌 WebSocket Events

### Conexão

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3003/status', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

### Eventos do Cliente → Servidor

#### `subscribeToJob`

Inscreve-se para receber atualizações de um job específico.

```javascript
socket.emit('subscribeToJob', { jobId: 'job-uuid' }, (response) => {
  console.log(response);
  // { success: true, job: { id: '...', status: 'PROCESSING', ... } }
});
```

#### `unsubscribeFromJob`

Cancela inscrição de um job.

```javascript
socket.emit('unsubscribeFromJob', { jobId: 'job-uuid' }, (response) => {
  console.log(response);
  // { success: true }
});
```

#### `getJobStatus`

Solicita status atual de um job.

```javascript
socket.emit('getJobStatus', { jobId: 'job-uuid' }, (response) => {
  console.log(response);
  // { success: true, job: { ... } }
});
```

#### `getMyJobs`

Lista todos os jobs do usuário autenticado.

```javascript
socket.emit('getMyJobs', (response) => {
  console.log(response);
  // { success: true, jobs: [ ... ] }
});
```

### Eventos do Servidor → Cliente

#### `statusUpdate`

Emitido quando o status de um job inscrito muda.

```javascript
socket.on('statusUpdate', (data) => {
  console.log(data);
  // {
  //   jobId: 'job-uuid',
  //   status: 'COMPLETED',
  //   framesExtracted: '150',
  //   outputStorageKey: 'processed-zips/video.zip',
  //   errorMessage: null,
  //   completedAt: '2026-03-04T04:01:30.000Z',
  //   downloadUrl: 'http://...'
  // }
});
```

---

## 🔐 Autenticação

O MS-Status utiliza JWT tokens emitidos pelo MS-Auth.

### REST API

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3003/api/v1/status/jobs
```

### WebSocket

```javascript
const socket = io('http://localhost:3003/status', {
  auth: { token: '<jwt_token>' }
});

// Ou via header
const socket = io('http://localhost:3003/status', {
  extraHeaders: { authorization: 'Bearer <jwt_token>' }
});
```

### JWT Payload Esperado

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "iat": 1772598499,
  "exp": 1772599399
}
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3003` |
| `DATABASE_URL` | URL do PostgreSQL (processor DB) | - |
| `JWT_SECRET` | Chave secreta JWT (mesma do MS-Auth) | - |
| `MINIO_ENDPOINT` | Endpoint do MinIO | `localhost:9000` |
| `MINIO_ACCESS_KEY` | Access key do MinIO | - |
| `MINIO_SECRET_KEY` | Secret key do MinIO | - |
| `MINIO_BUCKET_PROCESSED` | Bucket dos ZIPs processados | `processed-zips` |
| `CORS_ORIGIN` | Origem permitida para CORS | `http://localhost:3000` |

### Arquivo `.env`

```env
NODE_ENV=development
PORT=3003
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/video_processing_processor
JWT_SECRET=your-super-secret-jwt-key-change-in-production
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_PROCESSED=processed-zips
CORS_ORIGIN=http://localhost:3000
```

---

## 🚀 Execução

### Desenvolvimento

```bash
# Instalar dependências
npm install

# Gerar Prisma Client
npx prisma generate

# Iniciar em modo desenvolvimento
npm run start:dev
```

### Produção

```bash
# Build
npm run build

# Iniciar
npm run start:prod
```

### Docker

```bash
# Build da imagem
docker build -t video-processing-ms-status .

# Executar
docker-compose up -d
```

---

## 🧪 Testes

### Testar Health Check

```bash
curl http://localhost:3003/api/v1/health
```

### Testar REST API

```bash
# Obter token do MS-Auth
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Test123!"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Listar jobs
curl -H "Authorization: Bearer $TOKEN" http://localhost:3003/api/v1/status/jobs
```

### Testar WebSocket

```javascript
// test-websocket.js
const { io } = require('socket.io-client');

const TOKEN = 'seu_jwt_token';

const socket = io('http://localhost:3003/status', {
  auth: { token: TOKEN }
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  
  socket.emit('getMyJobs', (response) => {
    console.log('Jobs:', response);
  });
});

socket.on('statusUpdate', (data) => {
  console.log('📡 Status Update:', data);
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
});
```

---

## 📊 Status do Job

| Status | Descrição |
|--------|-----------|
| `PENDING` | Job criado, aguardando processamento |
| `PROCESSING` | FFmpeg está extraindo frames |
| `COMPLETED` | ZIP gerado com sucesso |
| `FAILED` | Erro durante processamento |

---

## 📁 Estrutura do Projeto

```
video-processing-ms-status/
├── src/
│   ├── main.ts                 # Bootstrap da aplicação
│   ├── app.module.ts           # Módulo raiz
│   ├── app.controller.ts       # Health check
│   ├── auth/
│   │   ├── auth.module.ts      # Módulo de autenticação
│   │   ├── jwt.strategy.ts     # Passport JWT strategy
│   │   └── jwt-auth.guard.ts   # Guards REST e WebSocket
│   ├── prisma/
│   │   ├── prisma.module.ts    # Módulo Prisma
│   │   └── prisma.service.ts   # Prisma client
│   ├── minio/
│   │   ├── minio.module.ts     # Módulo MinIO
│   │   └── minio.service.ts    # Client para download URLs
│   └── status/
│       ├── status.module.ts    # Módulo principal
│       ├── status.gateway.ts   # WebSocket Gateway ⭐
│       ├── status.service.ts   # Lógica de negócio
│       ├── status.controller.ts # REST endpoints
│       └── dto/
│           └── job-status.dto.ts # DTOs e enums
├── prisma/
│   └── schema.prisma           # Schema (read-only)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 🔗 Integração com Outros Microserviços

| Serviço | Porta | Integração |
|---------|-------|------------|
| MS-Auth | 3001 | JWT tokens para autenticação |
| MS-Upload | 3002 | Frontend envia vídeos aqui |
| MS-Processor | 8000 | Fonte dos dados (DB) |
| MS-Status | 3003 | **Este serviço** |
| PostgreSQL | 5432 | Banco `video_processing_processor` |
| MinIO | 9000 | Bucket `processed-zips` |

---

## 📝 Changelog

### v1.0.0 (2026-03-04)

- ✅ WebSocket Gateway com Socket.io
- ✅ REST API para consulta de status
- ✅ Autenticação JWT integrada com MS-Auth
- ✅ Polling automático a cada 2 segundos
- ✅ Geração de URLs presigned para download
- ✅ Dockerfile e docker-compose

---

## 👥 Contribuidores

- FIAP - Pós-Tech Software Architecture

## 📄 Licença

MIT
