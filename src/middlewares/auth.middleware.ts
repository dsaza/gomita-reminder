import { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { ApiResponse, WorkerBindings, AuthVariables } from "../types";
import { isJwtError } from "../utils/jwt";

export async function authMiddleware (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>, next: Next) {
	try {
		const authorization = c.req.header("Authorization") ?? "";
		const tokenStr = authorization.split("Bearer ")[1] ?? "";
		const token = tokenStr.trim();

		if (token === "") {
			return c.json<ApiResponse>({
				status: "UNAUTHORIZED",
				message: "Unauthorized"
			}, 401);
		}

		const jwtPayload = await verify(token, c.env.JWT_SECRET);

		const user = {
			id: `${jwtPayload.id}`,
			email: `${jwtPayload.email}`
		};

		c.set("user", user);

		await next();
	} catch (error: any) {
		if (isJwtError(error)) {
			return c.json<ApiResponse>({
				status: "INVALID_TOKEN",
				message: "Invalid token"
			}, 401);
		}

		return c.json<ApiResponse>({
			status: "INTERNAL_SERVER_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
