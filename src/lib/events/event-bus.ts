import { EventEmitter } from 'events';
import type { Task, Project } from '../../../prisma/generated/prisma/client';

type TaskSSEPayload = Omit<Task, 'description'>;
type ProjectSSEPayload = Pick<Project, 'id' | 'name' | 'description' | 'updatedAt'>;

export type TaskEventType = 'task_created' | 'task_updated' | 'task_deleted';
export type ProjectEventType =
  | 'project_created'
  | 'project_updated'
  | 'project_deleted';

class EventBus extends EventEmitter {
  private activeConnections = 0;
  private readonly MAX_CONNECTIONS = 50;
  private readonly MAX_PER_IP = 10;
  private ipConnections = new Map<string, number>();

  canAcceptConnection(clientIp: string): boolean {
    if (this.activeConnections >= this.MAX_CONNECTIONS) return false;
    const ipCount = this.ipConnections.get(clientIp) ?? 0;
    return ipCount < this.MAX_PER_IP;
  }

  registerConnection(clientIp: string): void {
    this.activeConnections++;
    this.ipConnections.set(clientIp, (this.ipConnections.get(clientIp) ?? 0) + 1);
  }

  unregisterConnection(clientIp: string): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    const count = (this.ipConnections.get(clientIp) ?? 1) - 1;
    if (count <= 0) this.ipConnections.delete(clientIp);
    else this.ipConnections.set(clientIp, count);
  }

  getConnectionCount(): number {
    return this.activeConnections;
  }

  emitTaskEvent(type: TaskEventType, payload: TaskSSEPayload | { id: string }): void {
    this.emit(type, payload);
  }

  emitProjectEvent(type: ProjectEventType, payload: ProjectSSEPayload | { id: string }): void {
    this.emit(type, payload);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(100);

/** Strip description from task for SSE payload (bandwidth optimization) */
export function toSSEPayload(task: Task): TaskSSEPayload {
  const { description: _desc, ...rest } = task;
  return rest;
}
