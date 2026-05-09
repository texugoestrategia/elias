import NextAuth from "next-auth"
import AzureAd from "next-auth/providers/azure-ad"
import Credentials from "next-auth/providers/credentials"

function hasAzureConfig() {
  return Boolean(
    process.env.AZURE_AD_CLIENT_ID &&
      process.env.AZURE_AD_CLIENT_SECRET &&
      process.env.AZURE_AD_TENANT_ID
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuário", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const expectedUser = process.env.TEST_USER_USERNAME
        const expectedPass = process.env.TEST_USER_PASSWORD

        if (!expectedUser || !expectedPass) return null

        const username = (credentials?.username as string | undefined) ?? ""
        const password = (credentials?.password as string | undefined) ?? ""

        if (username !== expectedUser || password !== expectedPass) return null

        return {
          id: "test-user",
          name: username,
          email: `${username}@local.test`,
          role: "admin",
        }
      },
    }),
    ...(hasAzureConfig()
      ? [
          AzureAd({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user && (user as any).role) token.role = (user as any).role
      return token
    },
    session: async ({ session, token }) => {
      ;(session as any).role = token.role
      return session
    },
  },
})
