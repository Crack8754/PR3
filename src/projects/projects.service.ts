import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateProjectInput, Project, UpdateProjectInput } from './project';
import { PROJECTS_REPOSITORY, ProjectsRepository } from './ports/projects.repository';

@Injectable()
export class ProjectsService {
  constructor(@Inject(PROJECTS_REPOSITORY) private readonly repository: ProjectsRepository) {}

  create(input: CreateProjectInput): Promise<Project> {
    const now = new Date().toISOString();
    return this.repository.create({
      id: randomUUID(),
      name: this.normalizeName(input.name),
      description: input.description?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
    });
  }

  findAll(): Promise<Project[]> {
    return this.repository.findAll();
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.repository.findOne(id);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    if (input.name === undefined && input.description === undefined) {
      throw new BadRequestException('Provide name or description to update');
    }
    const changes: Partial<Pick<Project, 'name' | 'description' | 'updatedAt'>> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.name !== undefined) changes.name = this.normalizeName(input.name);
    if (input.description !== undefined) changes.description = input.description.trim();
    const project = await this.repository.update(id, changes);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async remove(id: string): Promise<void> {
    if (!await this.repository.remove(id)) throw new NotFoundException('Project not found');
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new BadRequestException('Project name cannot be blank');
    return normalized;
  }
}
