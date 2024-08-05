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
				message: "El cuerpo de la petición es inválido"
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

		const userBody = userSchema.parse(body);

		const pinSaltRounds = 10;
		const pinSalt = await genSalt(pinSaltRounds);
		const pinHash = await hash(userBody.pin, pinSalt);

		const userId = uuid();

		await c.env.DB
			.prepare("INSERT INTO Users (id, name, lastname, nickname, pin, birthdate, phone, email, avatar, telegramChatId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
			.bind(userId, userBody.name, userBody.lastname, userBody.nickname, pinHash, dateToTimestamp(userBody.birthdate), userBody.phone, userBody.email, userBody.avatar ?? null, userBody.telegramChatId)
			.run();

		return c.json<ApiResponse>({
			status: "OK",
			message: "Usuario creado correctamente",
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
					message: "El correo electrónico ya se encuentra registrado"
				}, 400);
			}

			if (error.message === "D1_ERROR: UNIQUE constraint failed: Users.phone") {
				return c.json<ApiResponse>({
					status: "DUPLICATE_PHONE",
					message: "El número de celular ya se encuentra registrado"
				}, 400);
			}
		}

		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}
