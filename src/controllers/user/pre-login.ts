import { Context } from "hono";
import { sign, verify } from "hono/jwt";
import { JWTPayload } from "hono/utils/jwt/types";
import { z } from "zod";
import { compare } from "bcryptjs";
import { Resend } from "resend";
import { ApiResponse, IUser, WorkerBindings } from "@/types";
import { parseBody } from "@lib/request";
import { generateOTP } from "@utils/otp";
import { getUserLoginData } from "@/lib/user";

export async function preLoginUser (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const body = await parseBody(c);

		if (body === null) {
			return c.json<ApiResponse>({
				status: "INVALID_BODY",
				message: "El cuerpo de la petición es inválido"
			}, 400);
		}

		const userSchema = z.object({
			phone: z.string().trim().length(10).regex(/^\d+$/),
			pin: z.string().trim().length(4).regex(/^\d+$/),
			tokenAccount: z.string().trim().optional()
		});

		const userBody = userSchema.parse(body);

		const queryLogin = await c.env.DB
			.prepare("SELECT * FROM Users WHERE phone = ?")
			.bind(userBody.phone)
			.first<IUser>()

		if (queryLogin === null) {
			return c.json<ApiResponse>({
				status: "INVALID_CREDENTIALS",
				message: "Credenciales inválidas"
			}, 400);
		}

		const pinMatch = await compare(userBody.pin, queryLogin.pin);

		if (!pinMatch) {
			return c.json<ApiResponse>({
				status: "INVALID_CREDENTIALS",
				message: "El PIN es incorrecto"
			}, 400);
		}


		if (userBody.tokenAccount !== undefined) {
			let jwtPayload: null | JWTPayload = null;

			try {
				const jwtAccountPayload = await verify(userBody.tokenAccount, c.env.JWT_ACCOUNT_SECRET);
				jwtPayload = jwtAccountPayload;
			} catch (error) {
				jwtPayload = null;
			}

			if (jwtPayload !== null) {
				const userData = await getUserLoginData(c.env, {
					user: queryLogin,
					type: "pre-login"
				});

				return c.json(userData);
			}
		}

		const otpCode = generateOTP(4);
		const resend = new Resend(c.env.RESEND_KEY);

		const { error } = await resend.emails.send({
			from: "Gomita <onboarding@resend.dev>",
			to: [queryLogin.email],
			subject: "Tú codigo para iniciar sesión",
			html: `<p>Hola ${queryLogin.nickname}!, el código para válidar tu cuenta es: ${otpCode}</p>`
		});

		if (error !== null) {
			return c.json<ApiResponse>({
				status: "INTERNAL_ERROR",
				message: "Ha ocurrido un error interno"
			}, 500);
		}

		const otpExpiration = Date.now() + (5 * 60 * 1000); // 5 minutes

		await c.env.DB
			.prepare("UPDATE Users SET otpCode = ?, otpExpiration = ? WHERE id = ?")
			.bind(otpCode, otpExpiration, queryLogin.id)
			.run();

		return c.json<ApiResponse>({
			status: "OK_SENT",
			message: "Código de verificación enviado",
			data: {
				id: queryLogin.id,
				email: queryLogin.email,
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
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}
