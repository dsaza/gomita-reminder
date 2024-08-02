import { Context } from "hono";
import { ApiResponse, WorkerBindings, AuthVariables } from "../../types";

export async function deleteTask (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");
		const taskId = c.req.param("id");

		const query = await c.env.DB
			.prepare("DELETE FROM Tasks WHERE id = ? AND userId = ?")
			.bind(taskId, user.id)
			.run();

		if (query.meta.changes === 0) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "Task not found"
			}, 404);
		}

		return c.json<ApiResponse>({
			status: "OK",
			message: "Task deleted successfully"
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
