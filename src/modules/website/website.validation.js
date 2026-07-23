import { z } from 'zod';

export const addWebsiteSchema = z.object({
  url: z.string().url('Invalid URL'),
  widgetConfig: z.object({
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    buttonText: z.string().max(50).optional(),
    icon: z.enum(['chat', 'bug', 'feedback']).optional(),
    darkMode: z.boolean().optional(),
  }).optional(),
});

export const updateWebsiteSchema = z.object({
  url: z.string().url('Invalid URL').optional(),
  isActive: z.boolean().optional(),
  widgetConfig: z.object({
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    buttonText: z.string().max(50).optional(),
    icon: z.enum(['chat', 'bug', 'feedback']).optional(),
    darkMode: z.boolean().optional(),
  }).optional(),
});
