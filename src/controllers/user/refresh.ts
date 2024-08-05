import { Context } from "hono";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { ApiResponse, WorkerBindings } from "@/types";
import { parseBody } from "@lib/request";
import { isJwtError } from "@lib/jwt";

export async function refreshToken (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const body = await parseBody(c);

		if (body === null) {
			return c.json<ApiResponse>({
				status: "INVALID_BODY",
				message: "El cuerpo de la petición es inválido"
			}, 400);
		}

		const schema = z.object({
			refreshToken: z.string().trim()
		})

		const data = schema.parse(body);
		const token = data.refreshToken.split("Bearer ")[1];

		if (token === undefined || typeof token !== "string") {
			return c.json<ApiResponse>({
				status: "INVALID_TOKEN",
				message: "El token es inválido"
			}, 401);
		}

		const jwtPayload = await verify(token, c.env.JWT_REFRESH_SECRET);

		const newToken = await sign({
			id: jwtPayload.id,
			email: jwtPayload.email,
			exp: Math.floor(Date.now() / 1000) + (60 * 45) // 45 minutes
		}, c.env.JWT_SECRET);

		return c.json<ApiResponse>({
			status: "OK",
			message: "Token actualizado correctamente",
			data: {
				token: {
					value: newToken,
					refresh: data.refreshToken
				}
			}
		});
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstError = error.errors[0];
			return c.json<ApiResponse>({
				status: "VALIDATION_ERROR",
				message: `[${firstError.path}]: ${firstError.message}`,
			}, 400);
		}

		if (isJwtError(error)) {
			return c.json<ApiResponse>({
				status: "INVALID_TOKEN",
				message: "El token es inválido"
			}, 401);
		}

		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}
