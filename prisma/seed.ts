import { PrismaClient, TaskStatus, TaskPriority } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.task.deleteMany();
  await prisma.subproject.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Create projects
  const projectAlpha = await prisma.project.create({
    data: {
      name: 'Project Alpha',
      description: 'Main product development project',
    },
  });

  const projectBeta = await prisma.project.create({
    data: {
      name: 'Project Beta',
      description: 'Internal tooling and infrastructure',
    },
  });

  // Create subprojects
  const subFrontend = await prisma.subproject.create({
    data: {
      projectId: projectAlpha.id,
      name: 'Frontend',
      description: 'UI components and pages',
    },
  });

  const subBackend = await prisma.subproject.create({
    data: {
      projectId: projectAlpha.id,
      name: 'Backend',
      description: 'API and services',
    },
  });

  // Create tasks for Project Alpha
  const alphaTasks: Array<{
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: string;
    subprojectId?: string;
  }> = [
    {
      title: 'Implement user authentication',
      description: 'Set up JWT-based auth with refresh tokens',
      status: 'in_work',
      priority: 'high',
      assignee: 'Alice',
      subprojectId: subBackend.id,
    },
    {
      title: 'Design dashboard layout',
      description: 'Create responsive layout with sidebar navigation',
      status: 'in_work',
      priority: 'medium',
      assignee: 'Bob',
      subprojectId: subFrontend.id,
    },
    {
      title: 'API rate limiting',
      description: 'Implement sliding window rate limiter',
      status: 'review',
      priority: 'high',
      assignee: 'Alice',
      subprojectId: subBackend.id,
    },
    {
      title: 'Setup CI/CD pipeline',
      description: 'Configure GitHub Actions for build and deploy',
      status: 'review',
      priority: 'medium',
      assignee: 'Charlie',
    },
    {
      title: 'Database migration scripts',
      description: 'Create initial migration with seed data',
      status: 'done',
      priority: 'high',
      assignee: 'Alice',
      subprojectId: subBackend.id,
    },
    {
      title: 'Logo design',
      description: 'Finalize brand logo and favicon',
      status: 'done',
      priority: 'low',
      assignee: 'Diana',
    },
    {
      title: 'Write unit tests for auth module',
      description: 'Cover login, logout, and token refresh flows',
      status: 'in_work',
      priority: 'medium',
      assignee: 'Charlie',
      subprojectId: subBackend.id,
    },
    {
      title: 'Implement dark mode toggle',
      status: 'review',
      priority: 'low',
      assignee: 'Bob',
      subprojectId: subFrontend.id,
    },
  ];

  for (const task of alphaTasks) {
    await prisma.task.create({
      data: {
        projectId: projectAlpha.id,
        ...task,
      },
    });
  }

  // Create tasks for Project Beta
  const betaTasks: Array<{
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: string;
  }> = [
    {
      title: 'Setup monitoring dashboard',
      description: 'Configure Grafana with key metrics',
      status: 'in_work',
      priority: 'medium',
      assignee: 'Eve',
    },
    {
      title: 'Migrate to PostgreSQL 16',
      status: 'review',
      priority: 'high',
      assignee: 'Frank',
    },
    {
      title: 'Optimize database queries',
      description: 'Profile and fix N+1 queries in task listing',
      status: 'done',
      priority: 'high',
      assignee: 'Eve',
    },
  ];

  for (const task of betaTasks) {
    await prisma.task.create({
      data: {
        projectId: projectBeta.id,
        ...task,
      },
    });
  }

  // Hash default admin password
  const adminPasswordHash = await hash('admin12345', 12);

  // Create users — admin with email/password, agent with API key, stakeholder
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
    },
  });

  await prisma.user.create({
    data: {
      name: 'AI Agent',
      role: 'agent',
      apiKey: process.env.API_KEY ?? 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Stakeholder',
      email: 'viewer@example.com',
      passwordHash: await hash('stakeholder1', 12),
      role: 'stakeholder',
    },
  });

  console.log('Seeding complete!');
  console.log('  Admin:       admin@example.com / admin12345');
  console.log('  Stakeholder: viewer@example.com / stakeholder1');
  console.log('  AI Agent:    uses API key');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
