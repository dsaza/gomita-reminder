import { Context } from "hono";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { Resend } from "resend";
import { compare, genSalt, hash } from "bcryptjs";
import { parseBody } from "../utils/request";
import { ApiResponse, WorkerBindings } from "../types";
import { generateOTP } from "../utils/otp";
import { dateToTimestamp } from "../utils/date";
import { isJwtError } from "../utils/jwt";

export async function listUsers (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const query = await c.env.DB
			.prepare("SELECT id, name, lastname, nickname, email FROM Users")
			.all();

		return c.json<ApiResponse>({
			status: "OK",
			message: "Showing users",
			data: query.results
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}

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
		});

		const user = userSchema.parse(body);

		const query = await c.env.DB
			.prepare("SELECT id, pin, email, nickname FROM Users WHERE phone = ?")
			.bind(user.phone)
			.first<{ id: string, pin: string, email: string, nickname: string }>()

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

		const otpCode = generateOTP();
		const resend = new Resend(c.env.RESEND_KEY);

		const { error } = await resend.emails.send({
			from: "Gomita <onboarding@resend.dev>",
			to: [query.email],
			subject: "Tú codigo para iniciar sesión",
			html: `<p>Hola ${query.nickname}!, tu código para iniciar sesión es: ${otpCode}</p>`
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
			status: "OK",
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
					refresh: refreshToken
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

export async function refreshToken (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const body = await parseBody(c);

		if (body === null) {
			return c.json<ApiResponse>({
				status: "INVALID_BODY",
				message: "No body provided"
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
				message: "Invalid token"
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
			message: "Token refreshed successfully",
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
				message: "Invalid token"
			}, 401);
		}

		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
