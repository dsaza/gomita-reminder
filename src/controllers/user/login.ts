import { Context } from "hono";
import { sign } from "hono/jwt";
import { z } from "zod";
import { ApiResponse, WorkerBindings } from "@/types";
import { parseBody } from "@utils/request";

export async function loginUser (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const body = await parseBody(c);

		if (body === null) {
			return c.json<ApiResponse>({
				status: "INVALID_BODY",
				message: "No body provided"
			}, 400);
		}

		const loginSchema = z.object({
			id: z.string().trim().max(100).uuid(),
			email: z.string().trim().email(),
			otpCode: z.string().trim().length(6).regex(/^\d+$/)
		});

		const login = loginSchema.parse(body);

		const query = await c.env.DB
			.prepare("SELECT id, name, lastname, nickname, birthdate, phone, email, avatar, otpExpiration FROM Users WHERE id = ? AND email = ? AND otpCode = ?")
			.bind(login.id, login.email, login.otpCode)
			.first<{ id: string, name: string, lastname: string, nickname: string, birthdate: number, phone: string, email: string, avatar: string | null, otpExpiration: number }>()

		if (query === null) {
			return c.json<ApiResponse>({
				status: "INVALID_CREDENTIALS",
				message: "Invalid credentials"
			}, 400);
		}

		const now = Date.now();
		const otpExpiration = query.otpExpiration;

		if (now > otpExpiration) {
			return c.json<ApiResponse>({
				status: "INVALID_CREDENTIALS",
				message: "Invalid credentials"
			}, 400);
		}

		const token = await sign({
			id: query.id,
			email: login.email,
			exp: Math.floor(now / 1000) + (60 * 45) // 45 minutes
		}, c.env.JWT_SECRET);

		const refreshToken = await sign({
			id: query.id,
			email: login.email,
			exp: Math.floor(now / 1000) + (60 * 60 * 24 * 30) // 30 days
		}, c.env.JWT_REFRESH_SECRET);

		const accountToken = await sign({
			id: query.id,
			email: login.email,
			exp: Math.floor(now / 1000) + (60 * 60 * 24 * 184) // 6 months
		}, c.env.JWT_ACCOUNT_SECRET);

		return c.json<ApiResponse>({
			status: "OK",
			message: "User logged in successfully",
			data: {
				user: {
					id: query.id,
					name: query.name,
					lastname: query.lastname,
					nickname: query.nickname,
					birthdate: query.birthdate,
					phone: query.phone,
					email: query.email,
					avatar: query.avatar
				},
				token: {
					value: token,
					refresh: refreshToken,
					account: accountToken
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

		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
