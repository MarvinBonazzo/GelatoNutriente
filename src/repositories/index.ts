import { createIndexedDbRepositories } from './indexed-db'
import type { Repositories } from './contracts'

/** Composition root: inject REST/Supabase repositories here in a future release. */
export const repositories: Repositories = createIndexedDbRepositories()
