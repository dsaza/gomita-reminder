import { Context } from "hono";
import { sign } from "hono/jwt";
import { z } from "zod";
import { ApiResponse, IUser, WorkerBindings } from "@/types";
import { parseBody } from "@lib/request";
import { getUserLoginData } from "@/lib/user";

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
			.prepare("SELECT * FROM Users WHERE id = ? AND email = ? AND otpCode = ?")
			.bind(login.id, login.email, login.otpCode)
			.first<IUser>()

		if (query === null) {
			return c.json<ApiResponse>({
				status: "INVALID_CREDENTIALS",
				message: "Invalid credentials"
			}, 400);
		}

		const now = Date.now();
		const otpExpiration = query.otpExpiration;

		if (otpExpiration !== null && now > otpExpiration) {
			return c.json<ApiResponse>({
				status: "INVALID_CREDENTIALS",
				message: "Invalid credentials"
			}, 400);
		}

		const userData = await getUserLoginData(c.env, {
			user: query,
			type: "login",
			now: now
		});

		return c.json(userData);
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
