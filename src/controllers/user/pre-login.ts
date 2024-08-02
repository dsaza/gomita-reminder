import { Context } from "hono";
import { sign, verify } from "hono/jwt";
import { JWTPayload } from "hono/utils/jwt/types";
import { z } from "zod";
import { compare } from "bcryptjs";
import { Resend } from "resend";
import { ApiResponse, WorkerBindings } from "../../types";
import { parseBody } from "../../utils/request";
import { generateOTP } from "../../utils/otp";

export async function preLoginUser (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const body = await parseBody(c);

		if (body === null) {
			return c.json<ApiResponse>({
				status: "INVALID_BODY",
				message: "No body provided"
			}, 400);
		}

		const userSchema = z.object({
			phone: z.string().trim().length(10).regex(/^\d+$/),
			pin: z.string().trim().length(4).regex(/^\d+$/),
			tokenAccount: z.string().trim().optional()
		});

		const user = userSchema.parse(body);

		const query = await c.env.DB
			.prepare("SELECT id, pin, name, lastname, nickname, birthdate, phone, email, avatar FROM Users WHERE phone = ?")
			.bind(user.phone)
			.first<{ id: string, pin: string, name: string, lastname: string, nickname: string, birthdate: number, phone: string, email: string, avatar: string | null }>()

		if (query === null) {
			return c.json<ApiResponse>({
				status: "INVALID_CREDENTIALS",
				message: "Invalid credentials"
			}, 400);
		}

		const pinMatch = await compare(user.pin, query.pin);

		if (!pinMatch) {
			return c.json<ApiResponse>({
				status: "INVALID_CREDENTIALS",
				message: "Invalid credentials"
			}, 400);
		}


		if (user.tokenAccount !== undefined) {
			let jwtPayload: null | JWTPayload = null;

			try {
				const jwtAccountPayload = await verify(user.tokenAccount, c.env.JWT_ACCOUNT_SECRET);
				jwtPayload = jwtAccountPayload;
			} catch (error) {
				jwtPayload = null;
			}

			if (jwtPayload !== null) {
				const now = Date.now();

				const token = await sign({
					id: query.id,
					email: query.email,
					exp: Math.floor(now / 1000) + (60 * 45) // 45 minutes
				}, c.env.JWT_SECRET);

				const refreshToken = await sign({
					id: query.id,
					email: query.email,
					exp: Math.floor(now / 1000) + (60 * 60 * 24 * 30) // 30 days
				}, c.env.JWT_REFRESH_SECRET);

				return c.json<ApiResponse>({
					status: "VALID_ACCOUNT",
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
							refresh: refreshToken
						}
					}
				});
			}
		}

		const otpCode = generateOTP();
		const resend = new Resend(c.env.RESEND_KEY);

		const { error } = await resend.emails.send({
			from: "Gomita <onboarding@resend.dev>",
			to: [query.email],
			subject: "Tú codigo para iniciar sesión",
			html: `<p>Hola ${query.nickname}!, el código para válidar tu cuenta es: ${otpCode}</p>`
		});

		if (error !== null) {
			return c.json<ApiResponse>({
				status: "INTERNAL_ERROR",
				message: "Internal server error"
			}, 500);
		}

		const otpExpiration = Date.now() + (5 * 60 * 1000); // 5 minutes

		await c.env.DB
			.prepare("UPDATE Users SET otpCode = ?, otpExpiration = ? WHERE id = ?")
			.bind(otpCode, otpExpiration, query.id)
			.run();

		return c.json<ApiResponse>({
			status: "EMAIL_SENT",
			message: "User OTP sent successfully",
			data: {
				id: query.id,
				email: query.email,
				otpExpiration: otpExpiration
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
