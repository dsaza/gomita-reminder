import {
	JwtAlgorithmNotImplemented,
	JwtTokenInvalid,
	JwtTokenNotBefore,
	JwtTokenExpired,
	JwtTokenIssuedAt,
	JwtTokenSignatureMismatched
} from "hono/utils/jwt/types"

export function isJwtError (error: any) {
	return error instanceof JwtAlgorithmNotImplemented || error instanceof JwtTokenInvalid || error instanceof JwtTokenNotBefore || error instanceof JwtTokenExpired || error instanceof JwtTokenIssuedAt || error instanceof JwtTokenSignatureMismatched;
}
