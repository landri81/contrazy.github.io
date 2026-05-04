# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: vendor-approval.spec.ts >> pending vendor cannot create live transactions or start Stripe onboarding
- Location: tests\e2e\vendor-approval.spec.ts:5:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByLabel('Password')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - link "Con trazy" [ref=e6] [cursor=pointer]:
            - /url: /
            - text: Con
            - generic [ref=e7]: trazy
          - paragraph [ref=e8]: Sécurisez toute la transaction, pas seulement le paiement.
          - paragraph [ref=e9]: Contrat, KYC, e-signature, caution et paiement — en un seul lien ou QR code.
        - list [ref=e10]:
          - listitem [ref=e11]:
            - generic [ref=e12]: 🪪
            - generic [ref=e13]: Vérification d'identité automatique
          - listitem [ref=e14]:
            - generic [ref=e15]: 📝
            - generic [ref=e16]: Contrats auto-générés et signés
          - listitem [ref=e17]:
            - generic [ref=e18]: 💳
            - generic [ref=e19]: Cautions et paiements sécurisés
          - listitem [ref=e20]:
            - generic [ref=e21]: 📱
            - generic [ref=e22]: QR Codes dynamiques
      - paragraph [ref=e23]: Connexion sécurisée pour vendeurs, administrateurs et propriétaires de compte
    - main [ref=e24]:
      - generic [ref=e26]:
        - generic [ref=e27]:
          - link "Con trazy" [ref=e28] [cursor=pointer]:
            - /url: /
            - text: Con
            - generic [ref=e29]: trazy
          - heading "Connexion" [level=1] [ref=e30]
          - paragraph [ref=e31]: Accédez à votre espace vendeur
        - generic [ref=e33]:
          - button "Continuer avec Google" [ref=e34] [cursor=pointer]:
            - generic [ref=e35]:
              - img
            - text: Continuer avec Google
          - generic [ref=e38]: ou
          - generic [ref=e40]:
            - generic [ref=e41]:
              - generic [ref=e42]: Email
              - textbox "Email" [active] [ref=e43]:
                - /placeholder: jean@monentreprise.com
                - text: e2e-pending@contrazy.test
            - generic [ref=e44]:
              - generic [ref=e45]:
                - generic [ref=e46]: Mot de passe
                - link "Mot de passe oublié ?" [ref=e47] [cursor=pointer]:
                  - /url: /forgot-password
              - generic [ref=e48]:
                - textbox "Mot de passe" [ref=e49]:
                  - /placeholder: Votre mot de passe
                - button "Afficher le mot de passe" [ref=e50]:
                  - img [ref=e51]
            - button "Se connecter" [ref=e54] [cursor=pointer]:
              - img
              - text: Se connecter
          - paragraph [ref=e55]:
            - text: Pas encore de compte ?
            - link "Créer un compte" [ref=e56] [cursor=pointer]:
              - /url: /register
  - alert [ref=e57]
```

# Test source

```ts
  1  | import { expect, type Page } from "@playwright/test"
  2  | 
  3  | export const E2E_PASSWORD = "Passw0rd!Passw0rd!"
  4  | 
  5  | export const e2eUsers = {
  6  |   admin: "e2e-admin@contrazy.test",
  7  |   pendingVendor: "e2e-pending@contrazy.test",
  8  |   reviewPendingVendor: "e2e-review-pending@contrazy.test",
  9  |   approvedVendor: "e2e-approved@contrazy.test",
  10 | } as const
  11 | 
  12 | export async function loginAs(page: Page, email: string, password = E2E_PASSWORD) {
  13 |   await page.goto("/login")
  14 |   await page.getByLabel("Email").fill(email)
> 15 |   await page.getByLabel("Password").fill(password)
     |                                     ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  16 |   await page.getByRole("button", { name: "Sign In" }).click()
  17 |   await expect(page).not.toHaveURL(/\/login$/)
  18 | }
  19 | 
```