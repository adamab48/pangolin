import { generateId, invalidateAllSessions } from "@server/auth/sessions/app";
import { hashPassword, verifyPassword } from "@server/auth/password";
import config from "@server/lib/config";
import db from "@server/db";
import { users } from "@server/db/schema";
import logger from "@server/logger";
import { eq } from "drizzle-orm";
import moment from "moment";
import { fromError } from "zod-validation-error";
import { passwordSchema } from "@server/auth/passwordSchema";

export async function setupServerAdmin() {
    const {
        server_admin: { email, password }
    } = config.getRawConfig().users;

    const parsed = passwordSchema.safeParse(password);

    if (!parsed.success) {
        throw Error(
            `Invalid server admin password: ${fromError(parsed.error).toString()}`
        );
    }

    const passwordHash = await hashPassword(password);

    await db.transaction(async (trx) => {
        try {
            const [existing] = await trx
                .select()
                .from(users)
                .where(eq(users.email, email));

            if (existing) {
                const passwordChanged = !(await verifyPassword(
                    password,
                    existing.passwordHash
                ));

                if (passwordChanged) {
                    await trx
                        .update(users)
                        .set({ passwordHash })
                        .where(eq(users.userId, existing.userId));

                    // this isn't using the transaction, but it's probably fine
                    await invalidateAllSessions(existing.userId);

                    logger.info(`Server admin (${email}) password updated`);
                }

                if (existing.serverAdmin) {
                    logger.info(`Server admin (${email}) already exists`)
                    return;
                }

                await trx.update(users).set({ serverAdmin: false });

                await trx
                    .update(users)
                    .set({
                        serverAdmin: true
                    })
                    .where(eq(users.email, email));

                logger.info(`Server admin (${email}) set`);
                return;
            }

            const userId = generateId(15);

            await db.insert(users).values({
                userId: userId,
                email: email,
                passwordHash,
                dateCreated: moment().toISOString(),
                serverAdmin: true,
                emailVerified: true
            });

            logger.info(`Server admin (${email}) created`);
        } catch (e) {
            logger.error(e);
            trx.rollback();
        }
    });
}
