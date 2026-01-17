import type { AppRouter } from '@/src/server';
import type { inferRouterOutputs } from '@trpc/server';

type RouterOutput = inferRouterOutputs<AppRouter>;

export type GetCollectionOutput = RouterOutput['collection']['getCollection'];

export type RichCollectionEntry = GetCollectionOutput['entries'][number];
