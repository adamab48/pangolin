import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { users } from "@server/db/schema";
import { eq } from "drizzle-orm";
import response from "@server/utils/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";

async function queryUser(userId: string) {
    const [user] = await db
        .select({
            userId: users.userId,
            email: users.email,
            twoFactorEnabled: users.twoFactorEnabled,
            emailVerified: users.emailVerified,
            serverAdmin: users.serverAdmin
        })
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1);
    return user;
}

export type GetUserResponse = NonNullable<
    Awaited<ReturnType<typeof queryUser>>
>;

export async function getUser(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return next(
                createHttpError(HttpCode.UNAUTHORIZED, "User not found")
            );
        }

        const user = await queryUser(userId);

        if (!user) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `User with ID ${userId} not found`
                )
            );
        }

        return response<GetUserResponse>(res, {
            data: user,
            success: true,
            error: false,
            message: "User retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
