import { z } from "zod";

export const Slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase kebab-case slug");

export const Organization = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: Slug,
  createdAt: z.string().datetime(),
});
export type Organization = z.infer<typeof Organization>;

export const CreateOrganization = Organization.pick({ name: true, slug: true });
export type CreateOrganization = z.infer<typeof CreateOrganization>;
