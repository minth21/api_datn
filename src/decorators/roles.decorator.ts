/**
 * @Roles() Decorator - NestJS-style intent annotation (Express-compatible)
 * Documents which roles are allowed for a given route handler.
 * The actual enforcement is done by the `rolesGuard` middleware.
 *
 * Usage example (annotation-style comment above route):
 *   // @Roles('ADMIN', 'SPECIALIST')
 *   router.delete('/tests/:id', authMiddleware, rolesGuard(['ADMIN', 'SPECIALIST']), deleteTest);
 */

export type AllowedRole = 'ADMIN' | 'SPECIALIST' | 'REVIEWER' | 'STUDENT';

export const ROLES_KEY = 'roles';

/**
 * Creates a role annotation tag for self-documenting routes.
 * In Express, the actual guard is the rolesGuard middleware.
 */
export const Roles = (..._roles: AllowedRole[]) => {
    // No-op in Express - enforcement is done via rolesGuard middleware.
    // This function exists to provide identical DX to NestJS @Roles() decorator.
    return undefined;
};
