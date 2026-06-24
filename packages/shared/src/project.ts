import { z } from "zod";
import { Slug } from "./organization.js";

export const Project = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: Slug,
  description: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
});
export type Project = z.infer<typeof Project>;

export const CreateProject = Project.pick({
  orgId: true,
  name: true,
  slug: true,
  description: true,
});
export type CreateProject = z.infer<typeof CreateProject>;

export const UpdateProject = Project.pick({
  name: true,
  slug: true,
  description: true,
}).partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "At least one field must be provided" },
);
export type UpdateProject = z.infer<typeof UpdateProject>;
