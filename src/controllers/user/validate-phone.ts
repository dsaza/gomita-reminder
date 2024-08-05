import { Context } from "hono";
import { ApiResponse, WorkerBindings } from "@/types";

export async function validatePhone (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const phone = c.req.param("phone");

		const queryValidate = await c.env.DB
			.prepare("SELECT phone FROM Users WHERE phone = ?")
			.bind(phone)
			.first();

		if (queryValidate === null) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "El número de celular no está registrado"
			}, 404);
		}

		return c.json<ApiResponse>({
			status: "OK",
			message: "Número de celular validado"
		}, 200);
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}