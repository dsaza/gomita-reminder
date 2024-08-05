import { sign } from "hono/jwt";
import { ApiResponse, IUser, WorkerBindings } from "@/types";

export async function getUserLoginData (
	env: WorkerBindings, { user, type, now = Date.now() }: { user: IUser, type: 'pre-login' | 'login', now?: number }
) {
	let token: string | undefined
	let refreshToken: string | undefined
	let accountToken: string | undefined

	token = await sign({
		id: user.id,
		email: user.email,
		exp: Math.floor(now / 1000) + (60 * 45) // 45 minutes
	}, env.JWT_SECRET);

	refreshToken = await sign({
		id: user.id,
		email: user.email,
		exp: Math.floor(now / 1000) + (60 * 60 * 24 * 30) // 30 days
	}, env.JWT_REFRESH_SECRET);

	if (type === "login") {
		accountToken = await sign({
			id: user.id,
			email: user.email,
			exp: Math.floor(now / 1000) + (60 * 60 * 24 * 184) // 6 months
		}, env.JWT_ACCOUNT_SECRET);
	}

	return {
		status: type === "pre-login" ? "OK_VALID" : "OK",
		message: "Inicio de sesión correcto",
		data: {
			user: {
				id: user.id,
				name: user.name,
				lastname: user.lastname,
				nickname: user.nickname,
				birthdate: user.birthdate,
				phone: user.phone,
				email: user.email,
				avatar: user.avatar
			},
			token: {
				value: token,
				refresh: refreshToken,
				account: accountToken
			}
		}
	} as ApiResponse;
}
