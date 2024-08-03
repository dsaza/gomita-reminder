import { Context } from "hono";
import { ApiResponse, AuthVariables, WorkerBindings } from "@/types";

export async function showTask (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");
		const taskId = c.req.param("id");

		const task = await c.env.DB
			.prepare("SELECT * FROM Tasks WHERE id = ? AND userId = ?")
			.bind(taskId, user.id)
			.first();

		if (task === null) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "Task not found"
			}, 404);
		}

		return c.json<ApiResponse>({
			status: "OK",
			message: "Task fetched successfully",
			data: task
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
