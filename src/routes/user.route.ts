import { Hono } from "hono";
import { userRootPrivilege } from "../middlewares/user";
import { storeUser } from "../controllers/user/store";
import { listUsers } from "../controllers/user/list";
import { preLoginUser } from "../controllers/user/pre-login";
import { loginUser } from "../controllers/user/login";
import { refreshToken } from "../controllers/user/refresh";

const user = new Hono();

user.post("/user/register", userRootPrivilege, storeUser);
user.get("/users", userRootPrivilege, listUsers);
user.post("/user/pre-login", preLoginUser);
user.post("/user/login", loginUser);
user.post("/user/refresh-token", refreshToken);

export {
	user as userRoute
}
