import { Project } from '../project';

// Interface зникає після компіляції; Symbol залишається runtime-токеном DI.
export const PROJECTS_REPOSITORY = Symbol('PROJECTS_REPOSITORY');

export interface ProjectsRepository {
  create(project: Project): Promise<Project>;
  findAll(): Promise<Project[]>;
  findOne(id: string): Promise<Project | null>;
  // null / false означають, що запис не існує.
  update(id: string, changes: Partial<Pick<Project, 'name' | 'description' | 'updatedAt'>>): Promise<Project | null>;
  remove(id: string): Promise<boolean>;
}
