import { Context } from "hono";
import { ApiResponse, WorkerBindings } from "@/types";

export async function listUsers (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const queryList = await c.env.DB
			.prepare("SELECT id, name, lastname, nickname, email FROM Users")
			.all();

		return c.json<ApiResponse>({
			status: "OK",
			message: "Lista de usuarios",
			data: queryList.results
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}
