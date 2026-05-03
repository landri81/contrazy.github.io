import type { Metadata } from "next"

import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Blog | Contrazy",
  description: "Guides pratiques, décryptages juridiques et bonnes pratiques pour sécuriser vos transactions.",
}

const featuredPost = {
  category: "Guide",
  emoji: "📋",
  title: "Comment sécuriser vos cautions en ligne en 2026",
  excerpt:
    "Les méthodes traditionnelles de caution sont risquées et chronophages. Découvrez comment l'empreinte bancaire via pré-autorisation Stripe révolutionne la gestion des garanties.",
  date: "18 avril 2026",
  readTime: "7 min de lecture",
}

const blogPosts = [
  {
    category: "Juridique",
    emoji: "⚖️",
    title: "eIDAS et e-signature : quel niveau de preuve choisir ?",
    excerpt: "Signature simple, avancée ou qualifiée — chaque niveau a ses usages pour vos contrats.",
    date: "15 avr. 2026",
    readTime: "5 min",
  },
  {
    category: "Stripe",
    emoji: "💳",
    title: "Stripe Connect : gérer les flux sans agrément ACPR",
    excerpt: "La pré-autorisation avec capture différée orchestre des cautions sans détenir de fonds.",
    date: "12 avr. 2026",
    readTime: "8 min",
  },
  {
    category: "KYC",
    emoji: "🪪",
    title: "Vérification d'identité : Stripe Identity vs alternatives",
    excerpt: "Comparatif des solutions de KYC. Couverture, coûts, taux de validation.",
    date: "10 avr. 2026",
    readTime: "6 min",
  },
  {
    category: "Business",
    emoji: "💰",
    title: "Pricing SaaS : fixer ses prix en 2026",
    excerpt: "Freemium, abo + usage, commission — les modèles qui fonctionnent.",
    date: "8 avr. 2026",
    readTime: "5 min",
  },
  {
    category: "Produit",
    emoji: "🔗",
    title: "Profil payeur réutilisable : l'avantage décisif",
    excerpt: "Un profil persistant réduit le taux d'abandon de 60%.",
    date: "5 avr. 2026",
    readTime: "4 min",
  },
  {
    category: "RGPD",
    emoji: "🔒",
    title: "Stocker des pièces d'identité : les obligations RGPD",
    excerpt: "Durée de conservation, chiffrement, consentement — le guide complet.",
    date: "3 avr. 2026",
    readTime: "6 min",
  },
  {
    category: "E-Signature",
    emoji: "✍️",
    title: "Le guide complet de la e-signature en France",
    excerpt: "Comment obtenir une signature électronique à valeur juridique opposable.",
    date: "1 avr. 2026",
    readTime: "8 min",
  },
  {
    category: "QR Code",
    emoji: "📱",
    title: "QR Codes dynamiques : automatisez vos transactions",
    excerpt: "Générez des QR codes modifiables pointant vers vos liens de paiement ou caution.",
    date: "28 mars 2026",
    readTime: "5 min",
  },
  {
    category: "Tech",
    emoji: "🔔",
    title: "Webhooks Stripe : automatiser vos notifications",
    excerpt: "Configurer les alertes pour paiement validé, identité vérifiée, caution expirée.",
    date: "25 mars 2026",
    readTime: "7 min",
  },
]

export default function BlogPage() {
  return (
    <PublicShell>
      <div className="min-h-screen bg-[var(--contrazy-bg-muted)]">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">

          {/* Page header */}
          <div className="mb-12 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">Blog</p>
            <h1 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
              Ressources &amp; <em className="italic text-[var(--contrazy-teal)]">guides</em>
            </h1>
            <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
              Guides pratiques, décryptages juridiques et bonnes pratiques pour sécuriser vos transactions.
            </p>
          </div>

          {/* Featured post */}
          <div className="mb-12 grid cursor-pointer overflow-hidden rounded-[20px] border border-border bg-background transition-all hover:-translate-y-0.5 hover:shadow-lg sm:grid-cols-2">
            {/* Image side */}
            <div
              className="flex min-h-[300px] items-center justify-center text-[72px]"
              style={{ background: "linear-gradient(135deg, #0c1e2f, #132d46)" }}
            >
              {featuredPost.emoji}
            </div>
            {/* Content side */}
            <div className="flex flex-col justify-center p-10 sm:p-12">
              <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--contrazy-teal)]">
                {featuredPost.category}
              </p>
              <h2 className="mt-2 text-[22px] font-bold leading-[1.35] text-foreground">
                {featuredPost.title}
              </h2>
              <p className="mt-3 text-[15px] leading-[1.65] text-muted-foreground">
                {featuredPost.excerpt}
              </p>
              <p className="mt-4 text-[12px] text-muted-foreground/70">
                {featuredPost.date} · {featuredPost.readTime}
              </p>
            </div>
          </div>

          {/* Blog grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <article
                key={post.title}
                className="cursor-pointer overflow-hidden rounded-[14px] border border-border bg-background transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Emoji image area */}
                <div className="flex h-[160px] items-center justify-center border-b border-border bg-[var(--contrazy-bg-muted)] text-[44px]">
                  {post.emoji}
                </div>
                {/* Card body */}
                <div className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--contrazy-teal)]">
                    {post.category}
                  </p>
                  <h3 className="mt-2 text-[16px] font-bold leading-[1.35] text-foreground">
                    {post.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <p className="mt-3 text-[12px] text-muted-foreground/60">
                    {post.date} · {post.readTime}
                  </p>
                </div>
              </article>
            ))}
          </div>

        </div>
      </div>
    </PublicShell>
  )
}
