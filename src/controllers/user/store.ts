import { Context } from "hono";
import { z } from "zod";
import { genSalt, hash } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { ApiResponse, WorkerBindings } from "@/types";
import { parseBody } from "@lib/request";
import { dateToTimestamp } from "@utils/date";

export async function storeUser (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const body = await parseBody(c);

		if (body === null) {
			return c.json<ApiResponse>({
				status: "INVALID_BODY",
				message: "No body provided"
			}, 400);
		}

		const userSchema = z.object({
			name: z.string().trim().min(1).max(100),
			lastname: z.string().trim().min(1).max(100),
			nickname: z.string().trim().min(1).max(80),
			pin: z.string().trim().length(4).regex(/^\d+$/),
			birthdate: z.string().trim().length(10).regex(/^\d{4}-\d{2}-\d{2}$/),
			phone: z.string().trim().length(10).regex(/^\d+$/),
			email: z.string().trim().email(),
			avatar: z.string().trim().url().optional(),
			telegramChatId: z.string().trim().regex(/^\d+$/),
		});

		const user = userSchema.parse(body);

		const pinSaltRounds = 10;
		const pinSalt = await genSalt(pinSaltRounds);
		const pinHash = await hash(user.pin, pinSalt);

		const userId = uuid();

		await c.env.DB
			.prepare("INSERT INTO Users (id, name, lastname, nickname, pin, birthdate, phone, email, avatar, telegramChatId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
			.bind(userId, user.name, user.lastname, user.nickname, pinHash, dateToTimestamp(user.birthdate), user.phone, user.email, user.avatar ?? null, user.telegramChatId)
			.run();

		return c.json<ApiResponse>({
			status: "OK",
			message: "User registered successfully"
		})
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstError = error.errors[0];
			return c.json<ApiResponse>({
				status: "VALIDATION_ERROR",
				message: `[${firstError.path}]: ${firstError.message}`,
			}, 400);
		}

		if (error.message?.startsWith("D1_")) {
			if (error.message === "D1_ERROR: UNIQUE constraint failed: Users.email") {
				return c.json<ApiResponse>({
					status: "DUPLICATE_EMAIL",
					message: "Email already exists"
				}, 400);
			}

			if (error.message === "D1_ERROR: UNIQUE constraint failed: Users.phone") {
				return c.json<ApiResponse>({
					status: "DUPLICATE_PHONE",
					message: "Phone already exists"
				}, 400);
			}
		}

		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
