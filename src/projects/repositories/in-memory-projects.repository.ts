import { Injectable } from '@nestjs/common';
import { Project } from '../project';
import { ProjectsRepository } from '../ports/projects.repository';

@Injectable()
export class InMemoryProjectsRepository implements ProjectsRepository {
  private readonly projects = new Map<string, Project>();

  async create(project: Project): Promise<Project> {
    this.projects.set(project.id, { ...project });
    return { ...project };
  }

  async findAll(): Promise<Project[]> {
    return [...this.projects.values()].map((project) => ({ ...project }));
  }

  async findOne(id: string): Promise<Project | null> {
    const project = this.projects.get(id);
    return project ? { ...project } : null;
  }

  async update(id: string, changes: Partial<Pick<Project, 'name' | 'description' | 'updatedAt'>>): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;
    const updated = { ...project, ...changes };
    this.projects.set(id, updated);
    return { ...updated };
  }

  async remove(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }
}
