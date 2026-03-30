import Google from "@auth/core/providers/google";
import Apple from "@auth/core/providers/apple";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Apple({
      profile: (appleInfo: any) => {
        const name = appleInfo.user
          ? `${appleInfo.user.name?.firstName ?? ""} ${appleInfo.user.name?.lastName ?? ""}`.trim()
          : undefined;
        return {
          id: appleInfo.sub,
          name: name || undefined,
          email: appleInfo.email,
        };
      },
    }),
    Password({
      verify: ResendOTP,
      reset: ResendOTPPasswordReset,
    }),
  ],
});
